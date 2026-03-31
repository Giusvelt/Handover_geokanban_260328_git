-- ============================================================
-- GeoKanban — Session Lock Preparation Migration
-- File: supabase/session_lock_prep.sql
-- Stato: PRONTO MA NON ANCORA ATTIVO
--
-- Eseguire questo SQL su Supabase Dashboard → SQL Editor
-- PRIMA di abilitare ENABLED = true in useSessionLock.js
-- ============================================================

-- 1. Aggiungi colonne di session tracking alla tabella user_profiles
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS session_token TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS session_device_id TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS session_registered_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Commenti descrittivi
COMMENT ON COLUMN user_profiles.session_token IS
    'UUID univoco generato ad ogni login. Se diverso dal token in memoria → sessione invalidata da altro dispositivo.';
COMMENT ON COLUMN user_profiles.session_device_id IS
    'Fingerprint del browser/dispositivo che ha effettuato il login più recente.';
COMMENT ON COLUMN user_profiles.session_registered_at IS
    'Timestamp dell ultimo login registrato. Utile per audit e debug.';

-- 3. Indice per velocizzare le query di verifica sessione
CREATE INDEX IF NOT EXISTS idx_user_profiles_session_token
    ON user_profiles (session_token);

-- 4. Funzione RPC per forzare il logout di un utente (uso admin)
--    Chiamata: supabase.rpc('admin_reset_session', { target_user_id: '...' })
CREATE OR REPLACE FUNCTION admin_reset_session(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- Eseguita con i privilegi del proprietario della funzione
AS $$
BEGIN
    UPDATE user_profiles
    SET
        session_token = NULL,
        session_device_id = NULL,
        session_registered_at = NULL
    WHERE user_id = target_user_id;
END;
$$;

-- 5. Verifica: mostra la struttura aggiornata
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'user_profiles'
-- ORDER BY ordinal_position;
