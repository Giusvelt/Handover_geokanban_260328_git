# GeoKanban V3.2 — Schema Migration (Supabase)

Questo documento contiene la sintesi SQL dello schema database per la Phase 24. Include le definizioni delle tabelle `vessel_activity`, `activity_messages`, `logbook_entries` e le policy RLS.

```sql
-- GeoKanban V3.2 — Schema Migration (FIXED)
-- Eseguire nel SQL Editor di Supabase
-- Data: 28 Feb 2026

-- ═══ VESSEL_ACTIVITY (Tabella Madre) ═══

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

-- ═══ ACTIVITY_MESSAGES (Chat Tab Activity) ═══

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

-- ═══ LOGBOOK_ENTRIES (Snapshot Notarile) ═══

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

-- ═══ RLS POLICIES (Hardened) ═══

ALTER TABLE vessel_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_va" ON vessel_activity FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_va" ON vessel_activity FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE activity_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_am" ON activity_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_am" ON activity_messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());

ALTER TABLE logbook_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_le" ON logbook_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "crew_update_le" ON logbook_entries FOR UPDATE TO authenticated USING (crew_id = auth.uid() AND status = 'draft');
```
