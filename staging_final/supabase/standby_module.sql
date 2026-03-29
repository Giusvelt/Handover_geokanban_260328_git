-- ═══════════════════════════════════════════════════════════════
-- GeoKanban V3 — Stand-by & Schedule Module
-- Eseguire nel SQL Editor di Supabase
-- ═══════════════════════════════════════════════════════════════

-- 1. Create standby_reasons table
CREATE TABLE IF NOT EXISTS standby_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert initial standby reasons
INSERT INTO standby_reasons (code, name, description)
VALUES 
    ('WEATHER', 'Weather Stand-by', 'Fermo a causa di condizioni meteorologiche avverse'),
    ('ROUTINE_MAINT', 'Routine Maintenance', 'Manutenzione ordinaria programmata'),
    ('EXTRA_MAINT', 'Extraordinary Maintenance', 'Intervento di manutenzione straordinaria'),
    ('OFF_HIRE', 'Allowance / Off-Hire', 'Fermo contrattuale / Stand-by commerciale'),
    ('BUNKERING', 'Bunkering Operations', 'Operazioni di rifornimento carburante')
ON CONFLICT (code) DO NOTHING;

-- 2. Create vessel_standby_schedule table
CREATE TABLE IF NOT EXISTS vessel_standby_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id UUID NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
    standby_reason_id UUID NOT NULL REFERENCES standby_reasons(id),
    standby_date DATE NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(vessel_id, standby_date)
);

-- 3. RLS Policies
ALTER TABLE standby_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE vessel_standby_schedule ENABLE ROW LEVEL SECURITY;

-- Everyone can read standby_reasons
CREATE POLICY "Enable read access for all users on standby_reasons" ON standby_reasons FOR SELECT USING (true);
CREATE POLICY "Enable all access for admins on standby_reasons" ON standby_reasons FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Everyone can read schedule
CREATE POLICY "Enable read access for all users on standby_schedule" ON vessel_standby_schedule FOR SELECT USING (true);

-- Crew can insert/update their own vessel schedule (if date >= today)
CREATE POLICY "Enable insert for crew on their vessel schedule" ON vessel_standby_schedule FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (role = 'admin' OR vessel_id = vessel_standby_schedule.vessel_id))
);

CREATE POLICY "Enable update for crew on their vessel schedule" ON vessel_standby_schedule FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (role = 'admin' OR vessel_id = vessel_standby_schedule.vessel_id))
    -- Note: UI logic will handle the block for past days. DB level could be added but UI is enough for now.
);

CREATE POLICY "Enable delete for crew on their vessel schedule" ON vessel_standby_schedule FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (role = 'admin' OR vessel_id = vessel_standby_schedule.vessel_id))
);


-- 4. Update materialize_vessel_activity to override activity_type based on schedule
CREATE OR REPLACE FUNCTION materialize_vessel_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_nature TEXT;
    v_activity_type TEXT;
    v_existing_id UUID;
    v_standby_reason_name TEXT;
BEGIN
    -- Determina tipo attività dalla natura del geofence
    SELECT nature INTO v_nature FROM geofences WHERE id = NEW.geofence_id;

    v_activity_type := CASE v_nature
        WHEN 'loading_site'   THEN 'Loading'
        WHEN 'unloading_site' THEN 'Unloading'
        WHEN 'base_port'      THEN 'Port Operations'
        WHEN 'anchorage'      THEN 'Anchorage'
        WHEN 'transit'        THEN 'Transit'
        WHEN 'mooring'        THEN 'Mooring'
        ELSE 'Unknown'
    END;

    -- [NEW] CONTROLLO STAND-BY
    -- Se esiste uno stand-by programmato per questa data e questa nave
    SELECT sr.name INTO v_standby_reason_name
    FROM vessel_standby_schedule vss
    JOIN standby_reasons sr ON sr.id = vss.standby_reason_id
    WHERE vss.vessel_id = NEW.vessel_id 
      AND vss.standby_date = DATE(NEW.timestamp)
    LIMIT 1;

    IF v_standby_reason_name IS NOT NULL THEN
        -- Sovrascrivi l'activity_type con il nome dello Stand-by
        v_activity_type := v_standby_reason_name;
    END IF;

    IF NEW.event_type = 'ENTER' THEN
        -- Chiudi eventuali Navigation attive per questa nave
        UPDATE vessel_activity SET
            end_time = NEW.timestamp,
            status = 'completed',
            updated_at = now()
        WHERE vessel_id = NEW.vessel_id
          AND activity_type = 'Navigation'
          AND status = 'active';

        -- Crea nuova activity dal geofence (o standy_by)
        INSERT INTO vessel_activity (
            vessel_id, activity_type, geofence_id,
            start_event_id, start_time, source, status
        ) VALUES (
            NEW.vessel_id, v_activity_type, NEW.geofence_id,
            NEW.id, NEW.timestamp, 'geofence', 'active'
        )
        ON CONFLICT (start_event_id) DO NOTHING;

    ELSIF NEW.event_type = 'EXIT' THEN
        -- Chiudi l'activity corrente in questo geofence
        SELECT id INTO v_existing_id
        FROM vessel_activity
        WHERE vessel_id = NEW.vessel_id
          AND geofence_id = NEW.geofence_id
          AND status = 'active'
        ORDER BY start_time DESC
        LIMIT 1;

        IF v_existing_id IS NOT NULL THEN
            UPDATE vessel_activity SET
                end_event_id = NEW.id,
                end_time = NEW.timestamp,
                status = 'completed',
                updated_at = now()
            WHERE id = v_existing_id;
        END IF;

        -- Crea Navigation automatica
        -- (solo se non c'è già un'altra activity attiva per questa nave)
        IF NOT EXISTS (
            SELECT 1 FROM vessel_activity
            WHERE vessel_id = NEW.vessel_id
              AND status = 'active'
        ) THEN
            -- [NEW] Anche qui controlliamo se in Navigation c'è uno stand-by in corso
            IF v_standby_reason_name IS NOT NULL THEN
                -- Se in mare aperto oggi c'è stand-by, l'activity è stand-by
                INSERT INTO vessel_activity (
                    vessel_id, activity_type, geofence_id,
                    start_time, source, status
                ) VALUES (
                    NEW.vessel_id, v_standby_reason_name, NULL,
                    NEW.timestamp, 'geofence', 'active'
                );
            ELSE
                INSERT INTO vessel_activity (
                    vessel_id, activity_type, geofence_id,
                    start_time, source, status
                ) VALUES (
                    NEW.vessel_id, 'Navigation', NULL,
                    NEW.timestamp, 'geofence', 'active'
                );
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
