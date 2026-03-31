-- ============================================================
-- GeoKanban — Roles Migration
-- File: supabase/roles_migration.sql
-- Branch: feature/multi-role-auth
-- Eseguire su Supabase Dashboard → SQL Editor
-- ============================================================

-- ────────────────────────────────────────────
-- 1. NUOVA TABELLA: companies (armatori)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    code        TEXT UNIQUE,         -- es. "Z_FLEET", "SIDER"
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE companies IS 'Società armatoriali. Raggruppa le navi e i crew_admin per flotta.';

-- Inserisci le due compagnie iniziali (personalizza i nomi)
INSERT INTO companies (name, code) VALUES
    ('Flotta Z',    'Z_FLEET'),
    ('Sider Group', 'SIDER')
ON CONFLICT (code) DO NOTHING;

-- RLS per companies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
-- Tutti gli utenti autenticati possono leggere le compagnie
CREATE POLICY "Companies readable by authenticated" ON companies
    FOR SELECT USING (auth.role() = 'authenticated');
-- Solo operation_admin può modificare
CREATE POLICY "Companies writable by operation_admin" ON companies
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role = 'operation_admin'
        )
    );

-- ────────────────────────────────────────────
-- 2. AGGIORNA TABELLA: vessels
-- ────────────────────────────────────────────
ALTER TABLE vessels
    ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

COMMENT ON COLUMN vessels.company_id IS 'FK alla compagnia armatoriale. Usato da crew_admin per vedere la sua flotta.';

-- ────────────────────────────────────────────
-- 3. AGGIORNA TABELLA: user_profiles
-- ────────────────────────────────────────────
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS company_id     UUID REFERENCES companies(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS mmsi           TEXT,
    ADD COLUMN IF NOT EXISTS is_blocked     BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS last_seen_at   TIMESTAMPTZ;

COMMENT ON COLUMN user_profiles.company_id   IS 'FK compagnia. Usato per crew e crew_admin per filtrare le navi visibili.';
COMMENT ON COLUMN user_profiles.mmsi         IS 'MMSI della nave associata (per ruolo crew). Più robusto di vessel_id.';
COMMENT ON COLUMN user_profiles.is_blocked   IS 'Se TRUE, il login è bloccato e la sessione attiva viene terminata.';
COMMENT ON COLUMN user_profiles.last_seen_at IS 'Aggiornato ogni 60s dal frontend. Usato per stato Online/Offline.';

-- ────────────────────────────────────────────
-- 4. MIGRA IL RUOLO E RIMUOVE IL VECCHIO VINCOLO CHECK
-- ────────────────────────────────────────────

-- 1. Rimuoviamo il vecchio vincolo che bloccava solo su "admin" o "crew"
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- 2. Migriamo l'utente
UPDATE user_profiles
    SET role = 'operation_admin'
    WHERE role = 'admin';

-- 3. Aggiungiamo il nuovo vincolo di sicurezza con i 4 nuovi ruoli
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check 
    CHECK (role IN ('crew', 'crew_admin', 'operation', 'operation_admin'));

-- ────────────────────────────────────────────
-- 5. AGGIORNA RLS: user_profiles
-- ────────────────────────────────────────────
-- operation_admin vede tutti i profili
-- operation vede tutti i profili (lettura)
-- crew e crew_admin vedono solo il proprio profilo

-- Prima rimuovi le policy esistenti se presenti
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- SELECT: ognuno vede il proprio; operation e operation_admin vedono tutti
CREATE POLICY "Profile select policy" ON user_profiles
    FOR SELECT USING (
        id = auth.uid()  -- chiunque vede il proprio
        OR EXISTS (
            SELECT 1 FROM user_profiles AS p2
            WHERE p2.id = auth.uid()
            AND p2.role IN ('operation', 'operation_admin')
        )
    );

-- UPDATE: ognuno aggiorna il proprio; operation_admin aggiorna tutti
CREATE POLICY "Profile update policy" ON user_profiles
    FOR UPDATE USING (
        id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM user_profiles AS p2
            WHERE p2.id = auth.uid()
            AND p2.role = 'operation_admin'
        )
    );

-- ────────────────────────────────────────────
-- 6. FUNZIONE RPC: blocco immediato utente
-- ────────────────────────────────────────────
-- Chiamata: supabase.rpc('block_user', { target_user_id: '...' })
CREATE OR REPLACE FUNCTION block_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Solo operation_admin può bloccare
    IF NOT EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid() AND role = 'operation_admin'
    ) THEN
        RAISE EXCEPTION 'Permission denied: only operation_admin can block users';
    END IF;

    UPDATE user_profiles
    SET
        is_blocked = TRUE,
        session_token = NULL,        -- invalida la sessione attiva
        session_device_id = NULL
    WHERE id = target_user_id;
END;
$$;

-- Funzione inversa: sblocca utente
CREATE OR REPLACE FUNCTION unblock_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid() AND role = 'operation_admin'
    ) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    UPDATE user_profiles
    SET is_blocked = FALSE
    WHERE id = target_user_id;
END;
$$;

-- ────────────────────────────────────────────
-- 7. VERIFICA FINALE
-- ────────────────────────────────────────────
-- Decommenta per verificare dopo l'esecuzione:

-- SELECT id, email, role, company_id, mmsi, is_blocked FROM user_profiles;
-- SELECT id, name, code FROM companies;
-- SELECT id, name, mmsi, company_id FROM vessels;
