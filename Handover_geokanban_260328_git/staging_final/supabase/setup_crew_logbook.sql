-- ═══════════════════════════════════════════════════════════════
-- GeoKanban V3.1 — Setup Crew Profiles & Logbook Tables
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. USER_PROFILES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email           VARCHAR UNIQUE NOT NULL,
    display_name    VARCHAR NOT NULL,
    role            VARCHAR NOT NULL DEFAULT 'crew' CHECK (role IN ('admin', 'crew')),
    vessel_id       UUID REFERENCES vessels(id) ON DELETE SET NULL,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policies: users can read their own profile, admins can read all
CREATE POLICY "Users can read own profile" ON user_profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Admins can read all profiles" ON user_profiles
    FOR SELECT USING (
        (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY "Admins can manage profiles" ON user_profiles
    FOR ALL USING (
        (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
    );

-- Service role bypass
CREATE POLICY "Service role full access on profiles" ON user_profiles
    FOR ALL USING (auth.role() = 'service_role');

-- ─── 2. LOGBOOK_ENTRIES ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS logbook_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id       UUID NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES user_profiles(id),
    log_date        DATE NOT NULL,
    activity_id     UUID NOT NULL REFERENCES activities(id),
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ,
    notes           TEXT,
    status          VARCHAR DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
    submitted_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE logbook_entries ENABLE ROW LEVEL SECURITY;

-- Crew can read/write their own vessel's logbook (drafts + submitted)
CREATE POLICY "Crew can read own vessel logbook" ON logbook_entries
    FOR SELECT USING (
        vessel_id = (SELECT vessel_id FROM user_profiles WHERE id = auth.uid())
    );

CREATE POLICY "Crew can insert own vessel logbook" ON logbook_entries
    FOR INSERT WITH CHECK (
        vessel_id = (SELECT vessel_id FROM user_profiles WHERE id = auth.uid())
        AND user_id = auth.uid()
    );

-- Crew can update only their own DRAFT entries
CREATE POLICY "Crew can update own drafts" ON logbook_entries
    FOR UPDATE USING (
        user_id = auth.uid()
        AND status = 'draft'
    );

-- Crew can delete only their own DRAFT entries
CREATE POLICY "Crew can delete own drafts" ON logbook_entries
    FOR DELETE USING (
        user_id = auth.uid()
        AND status = 'draft'
    );

-- Admin can see only SUBMITTED logbooks
CREATE POLICY "Admin reads submitted logbooks" ON logbook_entries
    FOR SELECT USING (
        (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
        AND status = 'submitted'
    );

-- Admin can manage all entries
CREATE POLICY "Admin manages all logbooks" ON logbook_entries
    FOR ALL USING (
        (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
    );

-- Service role
CREATE POLICY "Service role full access on logbook" ON logbook_entries
    FOR ALL USING (auth.role() = 'service_role');

-- ─── 3. LOGBOOK_SERVICES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS logbook_services (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    logbook_entry_id    UUID NOT NULL REFERENCES logbook_entries(id) ON DELETE CASCADE,
    service_id          UUID NOT NULL REFERENCES services(id),
    quantity            INTEGER DEFAULT 1 CHECK (quantity >= 0),
    start_time          TIMESTAMPTZ,
    end_time            TIMESTAMPTZ,
    notes               TEXT
);

-- Enable RLS
ALTER TABLE logbook_services ENABLE ROW LEVEL SECURITY;

-- Follow parent's visibility
CREATE POLICY "Logbook services follow entry visibility" ON logbook_services
    FOR SELECT USING (
        logbook_entry_id IN (
            SELECT id FROM logbook_entries
        )
    );

CREATE POLICY "Crew can insert own services" ON logbook_services
    FOR INSERT WITH CHECK (
        logbook_entry_id IN (
            SELECT id FROM logbook_entries 
            WHERE user_id = auth.uid() AND status = 'draft'
        )
    );

CREATE POLICY "Crew can update own draft services" ON logbook_services
    FOR UPDATE USING (
        logbook_entry_id IN (
            SELECT id FROM logbook_entries 
            WHERE user_id = auth.uid() AND status = 'draft'
        )
    );

CREATE POLICY "Crew can delete own draft services" ON logbook_services
    FOR DELETE USING (
        logbook_entry_id IN (
            SELECT id FROM logbook_entries 
            WHERE user_id = auth.uid() AND status = 'draft'
        )
    );

CREATE POLICY "Admin manages all services" ON logbook_services
    FOR ALL USING (
        (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY "Service role full access on logbook_services" ON logbook_services
    FOR ALL USING (auth.role() = 'service_role');

-- ─── 4. INDEXES ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_logbook_vessel_date ON logbook_entries(vessel_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_logbook_user ON logbook_entries(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_logbook_status ON logbook_entries(status);
CREATE INDEX IF NOT EXISTS idx_user_vessel ON user_profiles(vessel_id) WHERE vessel_id IS NOT NULL;

-- ─── 5. SEED: Admin profile for existing user ───────────────
-- This inserts the admin profile for giuseppe.berrelli@gmail.com
-- The UUID must match the auth.users id for this email
INSERT INTO user_profiles (id, email, display_name, role, vessel_id)
SELECT 
    id,
    email,
    'Giuseppe Berrelli',
    'admin',
    NULL
FROM auth.users 
WHERE email = 'giuseppe.berrelli@gmail.com'
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- DONE. Now you can:
-- 1. Create a crew user via Supabase Auth dashboard
-- 2. Insert their profile in user_profiles with role='crew' and vessel_id
-- ═══════════════════════════════════════════════════════════════
