-- ═══════════════════════════════════════════════════════════════
-- GeoKanban V3.2 — Schema Migration (FIXED)
-- Eseguire nel SQL Editor di Supabase
-- Data: 28 Feb 2026
-- ═══════════════════════════════════════════════════════════════

-- ═══ STEP 0: PULIZIA ═══
DROP VIEW IF EXISTS activity_export CASCADE;
DROP VIEW IF EXISTS crew_vessel_activity CASCADE;
DROP TRIGGER IF EXISTS trg_freeze_logbook ON logbook_entries;
DROP TRIGGER IF EXISTS trg_materialize_activity ON geofence_events;
DROP FUNCTION IF EXISTS freeze_logbook_submission CASCADE;
DROP FUNCTION IF EXISTS materialize_vessel_activity CASCADE;
DROP TABLE IF EXISTS logbook_services CASCADE;
DROP TABLE IF EXISTS logbook_entries CASCADE;
DROP TABLE IF EXISTS activity_messages CASCADE;
DROP TABLE IF EXISTS vessel_activity CASCADE;


-- ═══ STEP 1: VESSEL_ACTIVITY (Tabella Madre) ═══

CREATE TABLE vessel_activity (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id       UUID NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
    activity_type   VARCHAR NOT NULL,
    geofence_id     UUID REFERENCES geofences(id) ON DELETE SET NULL,
    start_event_id  UUID UNIQUE REFERENCES geofence_events(id) ON DELETE SET NULL,
    end_event_id    UUID REFERENCES geofence_events(id) ON DELETE SET NULL,
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ,
    duration_minutes INTEGER GENERATED ALWAYS AS (
        CASE WHEN end_time IS NOT NULL
            THEN EXTRACT(EPOCH FROM (end_time - start_time))::INTEGER / 60
            ELSE NULL
        END
    ) STORED,
    source          VARCHAR NOT NULL DEFAULT 'geofence'
        CHECK (source IN ('geofence', 'manual', 'override')),
    status          VARCHAR NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed')),
    export_flag     BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_va_vessel_time ON vessel_activity(vessel_id, start_time DESC);
CREATE INDEX idx_va_status ON vessel_activity(status);
CREATE INDEX idx_va_export ON vessel_activity(export_flag) WHERE export_flag = true;

ALTER TABLE vessel_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_va" ON vessel_activity
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_va" ON vessel_activity
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "service_va" ON vessel_activity
    FOR ALL USING (auth.role() = 'service_role');


-- ═══ STEP 2: ACTIVITY_MESSAGES ═══

CREATE TABLE activity_messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_activity_id  UUID NOT NULL REFERENCES vessel_activity(id) ON DELETE CASCADE,
    sender_id           UUID NOT NULL REFERENCES user_profiles(id),
    sender_role         VARCHAR NOT NULL CHECK (sender_role IN ('admin', 'crew')),
    message_text        TEXT NOT NULL,
    visibility          VARCHAR NOT NULL DEFAULT 'internal'
        CHECK (visibility IN ('internal', 'exported')),
    included_in_logbook BOOLEAN DEFAULT false,
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_am_activity ON activity_messages(vessel_activity_id, created_at);
CREATE INDEX idx_am_logbook ON activity_messages(vessel_activity_id) WHERE included_in_logbook = true;

ALTER TABLE activity_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_am" ON activity_messages
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_am" ON activity_messages
    FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());
CREATE POLICY "auth_update_am" ON activity_messages
    FOR UPDATE TO authenticated USING (sender_id = auth.uid());
CREATE POLICY "service_am" ON activity_messages
    FOR ALL USING (auth.role() = 'service_role');


-- ═══ STEP 3: LOGBOOK_ENTRIES (Snapshot Notarile) ═══

CREATE TABLE logbook_entries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id           UUID NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
    vessel_activity_id  UUID NOT NULL REFERENCES vessel_activity(id),
    crew_id             UUID NOT NULL REFERENCES user_profiles(id),
    narrative_text      TEXT,
    structured_fields   JSONB DEFAULT '{}',
    message_snapshot    JSONB DEFAULT '[]',
    activity_snapshot   JSONB DEFAULT '{}',
    status              VARCHAR NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
    submitted_at        TIMESTAMPTZ,
    approved_by_admin   UUID REFERENCES user_profiles(id),
    approved_at         TIMESTAMPTZ,
    rejection_reason    TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_le_vessel ON logbook_entries(vessel_id, created_at DESC);
CREATE INDEX idx_le_crew ON logbook_entries(crew_id, created_at DESC);
CREATE INDEX idx_le_status ON logbook_entries(status);
CREATE INDEX idx_le_activity ON logbook_entries(vessel_activity_id);

ALTER TABLE logbook_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_le" ON logbook_entries
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "crew_insert_le" ON logbook_entries
    FOR INSERT TO authenticated WITH CHECK (crew_id = auth.uid());
CREATE POLICY "crew_update_le" ON logbook_entries
    FOR UPDATE TO authenticated USING (crew_id = auth.uid() AND status = 'draft');
CREATE POLICY "admin_all_le" ON logbook_entries
    FOR ALL TO authenticated USING (true);
CREATE POLICY "service_le" ON logbook_entries
    FOR ALL USING (auth.role() = 'service_role');


-- ═══ STEP 4: LOGBOOK_SERVICES ═══

CREATE TABLE logbook_services (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    logbook_entry_id    UUID NOT NULL REFERENCES logbook_entries(id) ON DELETE CASCADE,
    service_id          UUID NOT NULL REFERENCES services(id),
    quantity            INTEGER DEFAULT 1 CHECK (quantity >= 0),
    start_time          TIMESTAMPTZ,
    end_time            TIMESTAMPTZ,
    notes               TEXT
);

CREATE INDEX idx_ls_entry ON logbook_services(logbook_entry_id);

ALTER TABLE logbook_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_ls" ON logbook_services
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_ls" ON logbook_services
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "service_ls" ON logbook_services
    FOR ALL USING (auth.role() = 'service_role');


-- ═══ STEP 5: TRIGGER — Auto-materializzazione ═══

CREATE OR REPLACE FUNCTION materialize_vessel_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_nature TEXT;
    v_activity_type TEXT;
    v_existing_id UUID;
BEGIN
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

    IF NEW.event_type = 'ENTER' THEN
        INSERT INTO vessel_activity (
            vessel_id, activity_type, geofence_id,
            start_event_id, start_time, source, status
        ) VALUES (
            NEW.vessel_id, v_activity_type, NEW.geofence_id,
            NEW.id, NEW.timestamp, 'geofence', 'active'
        )
        ON CONFLICT (start_event_id) DO NOTHING;

    ELSIF NEW.event_type = 'EXIT' THEN
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
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_materialize_activity
    AFTER INSERT ON geofence_events
    FOR EACH ROW
    EXECUTE FUNCTION materialize_vessel_activity();


-- ═══ STEP 6: TRIGGER — Freeze al submit ═══

CREATE OR REPLACE FUNCTION freeze_logbook_submission()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'submitted' AND OLD.status = 'draft' THEN
        NEW.message_snapshot := (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'role', am.sender_role,
                    'text', am.message_text,
                    'at', am.created_at
                ) ORDER BY am.created_at
            ), '[]'::jsonb)
            FROM activity_messages am
            WHERE am.vessel_activity_id = NEW.vessel_activity_id
              AND (am.included_in_logbook = true OR am.visibility = 'exported')
        );

        NEW.activity_snapshot := (
            SELECT jsonb_build_object(
                'activity_type', va.activity_type,
                'auto_start', va.start_time,
                'auto_end', va.end_time,
                'geofence', g.name,
                'source', va.source,
                'duration_minutes', va.duration_minutes
            )
            FROM vessel_activity va
            LEFT JOIN geofences g ON g.id = va.geofence_id
            WHERE va.id = NEW.vessel_activity_id
        );

        NEW.submitted_at := now();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_freeze_logbook
    BEFORE UPDATE ON logbook_entries
    FOR EACH ROW
    EXECUTE FUNCTION freeze_logbook_submission();


-- ═══ STEP 7: CREW VIEW ═══

CREATE OR REPLACE VIEW crew_vessel_activity AS
SELECT va.*
FROM vessel_activity va
WHERE va.vessel_id = (
    SELECT vessel_id FROM user_profiles WHERE id = auth.uid()
);


-- ═══ STEP 8: EXPORT VIEW ═══

CREATE OR REPLACE VIEW activity_export AS
SELECT
    va.id AS activity_id,
    v.name AS vessel_name,
    v.mmsi,
    va.activity_type,
    g.name AS geofence_name,
    va.start_time,
    va.end_time,
    va.duration_minutes,
    va.source,
    va.status,
    le.narrative_text,
    le.structured_fields,
    le.status AS logbook_status,
    le.submitted_at,
    le.approved_at,
    (SELECT jsonb_agg(jsonb_build_object(
        'service', ns.name,
        'code', ns.code,
        'qty', ls.quantity,
        'start', ls.start_time,
        'end', ls.end_time
    )) FROM logbook_services ls
    JOIN services ns ON ns.id = ls.service_id
    WHERE ls.logbook_entry_id = le.id
    ) AS services,
    (SELECT string_agg(
        am.sender_role || ' [' ||
        to_char(am.created_at, 'DD/MM HH24:MI') ||
        ']: ' || am.message_text,
        E'\n' ORDER BY am.created_at
    )
    FROM activity_messages am
    WHERE am.vessel_activity_id = va.id
      AND (am.visibility = 'exported' OR am.included_in_logbook = true)
    ) AS aggregated_messages_export,
    le.message_snapshot,
    le.activity_snapshot
FROM vessel_activity va
JOIN vessels v ON v.id = va.vessel_id
LEFT JOIN geofences g ON g.id = va.geofence_id
LEFT JOIN logbook_entries le ON le.vessel_activity_id = va.id
    AND le.status IN ('submitted', 'approved');


-- ═══ STEP 9: BACKFILL ═══

-- 9a. ENTER events → crea activity
INSERT INTO vessel_activity (vessel_id, activity_type, geofence_id, start_event_id, start_time, source, status)
SELECT
    ge.vessel_id,
    CASE gf.nature
        WHEN 'loading_site'   THEN 'Loading'
        WHEN 'unloading_site' THEN 'Unloading'
        WHEN 'base_port'      THEN 'Port Operations'
        WHEN 'anchorage'      THEN 'Anchorage'
        WHEN 'transit'        THEN 'Transit'
        WHEN 'mooring'        THEN 'Mooring'
        ELSE 'Unknown'
    END,
    ge.geofence_id,
    ge.id,
    ge.timestamp,
    'geofence',
    'active'
FROM geofence_events ge
JOIN geofences gf ON gf.id = ge.geofence_id
WHERE ge.event_type = 'ENTER'
ON CONFLICT (start_event_id) DO NOTHING;

-- 9b. EXIT events → chiudi activity
DO $$
DECLARE
    r RECORD;
    va_id UUID;
BEGIN
    FOR r IN
        SELECT ge.id, ge.vessel_id, ge.geofence_id, ge.timestamp
        FROM geofence_events ge
        WHERE ge.event_type = 'EXIT'
        ORDER BY ge.timestamp ASC
    LOOP
        SELECT id INTO va_id
        FROM vessel_activity
        WHERE vessel_id = r.vessel_id
          AND geofence_id = r.geofence_id
          AND status = 'active'
          AND start_time < r.timestamp
        ORDER BY start_time DESC
        LIMIT 1;

        IF va_id IS NOT NULL THEN
            UPDATE vessel_activity SET
                end_event_id = r.id,
                end_time = r.timestamp,
                status = 'completed',
                updated_at = now()
            WHERE id = va_id;
        END IF;
    END LOOP;
END $$;


-- ═══ STEP 10: VERIFICA ═══

SELECT 'vessel_activity' AS tbl, count(*) AS rows FROM vessel_activity
UNION ALL
SELECT 'activity_messages', count(*) FROM activity_messages
UNION ALL
SELECT 'logbook_entries', count(*) FROM logbook_entries
UNION ALL
SELECT 'logbook_services', count(*) FROM logbook_services
UNION ALL
SELECT 'geofence_events', count(*) FROM geofence_events;
