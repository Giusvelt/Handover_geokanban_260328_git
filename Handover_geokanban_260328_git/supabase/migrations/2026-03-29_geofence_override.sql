-- ═══════════════════════════════════════════════════════════════
-- GeoKanban V3 — Phase 29 Migration
-- Override Geofence Logic & Operational Times
-- ═══════════════════════════════════════════════════════════════

-- 1. Add Operational Times to vessel_activity
ALTER TABLE vessel_activity 
ADD COLUMN IF NOT EXISTS commence_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS complete_time TIMESTAMP WITH TIME ZONE;

-- 2. Update materialize_vessel_activity to prioritize Standby Schedule
CREATE OR REPLACE FUNCTION materialize_vessel_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_nature TEXT;
    v_activity_type TEXT;
    v_existing_id UUID;
    v_standby_reason_name TEXT;
BEGIN
    -- 1. DETERMINA TIPO ATTIVITÀ DALLA NATURA DEL GEOFENCE (Default Spaziale)
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

    -- 2. [OVERRIDE] PRIORITÀ STAND-BY (Controllo Dichiarativo)
    -- Se esiste uno stand-by programmato per questa data e questa nave, vince lui.
    SELECT sr.name INTO v_standby_reason_name
    FROM vessel_standby_schedule vss
    JOIN standby_reasons sr ON sr.id = vss.standby_reason_id
    WHERE vss.vessel_id = NEW.vessel_id 
      AND vss.standby_date = DATE(timezone('utc'::text, NEW.timestamp))
    LIMIT 1;

    IF v_standby_reason_name IS NOT NULL THEN
        -- Lo Stand-by sovrascrive sempre la natura della Geofence
        v_activity_type := v_standby_reason_name;
    END IF;

    -- 3. GESTIONE EVENTI (ENTER/EXIT)
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
        -- Popoliamo SEMPRE start_event_id per risolvere l'anomalia di System Health
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

        -- Crea Navigation automatica (solo se non c'è già un'altra activity attiva)
        IF NOT EXISTS (
            SELECT 1 FROM vessel_activity
            WHERE vessel_id = NEW.vessel_id
              AND status = 'active'
        ) THEN
            -- Anche in navigazione controlliamo lo stand-by (es. mare mosso che ferma la flotta)
            IF v_standby_reason_name IS NOT NULL THEN
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
