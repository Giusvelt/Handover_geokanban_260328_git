-- ═══════════════════════════════════════════════════════════════
-- GeoKanban V3.4 — Certification Engine & Hashing
-- Eseguire nel SQL Editor di Supabase
-- Data: 28 Feb 2026
-- ═══════════════════════════════════════════════════════════════

-- 1. Estensione Tabella per Certificazione
ALTER TABLE logbook_entries 
ADD COLUMN IF NOT EXISTS document_hash   TEXT,
ADD COLUMN IF NOT EXISTS version         INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS parent_id       UUID REFERENCES logbook_entries(id);

-- 2. Funzione di calcolo Hash (Digital Integrity)
CREATE OR REPLACE FUNCTION compute_logbook_hash(p_logbook_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_data TEXT;
    v_hash TEXT;
BEGIN
    -- Concateniamo i dati salienti dello snapshot per creare una stringa univoca
    SELECT 
        COALESCE(narrative_text, '') || 
        COALESCE(activity_snapshot::text, '') ||
        COALESCE(message_snapshot::text, '') ||
        COALESCE(submitted_at::text, '')
    INTO v_data
    FROM logbook_entries
    WHERE id = p_logbook_id;

    -- Generiamo un hash SHA-256 (richiede estensione pgcrypto)
    -- Se pgcrypto non è attiva, usiamo un metodo alternativo o md5 base
    v_hash := encode(digest(v_data, 'sha256'), 'hex');
    
    RETURN v_hash;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Aggiornamento freeze_logbook_submission per includere Hash
CREATE OR REPLACE FUNCTION freeze_logbook_submission()
RETURNS TRIGGER AS $$
DECLARE
    v_vessel record;
    v_crew record;
    v_services jsonb;
    v_data_to_hash TEXT;
BEGIN
    -- Solo al passaggio da draft -> submitted
    IF NEW.status != 'draft' AND OLD.status = 'draft' THEN
        
        -- A. Recupera dettagli Nave & Crew
        SELECT name, mmsi INTO v_vessel FROM vessels WHERE id = NEW.vessel_id;
        SELECT display_name INTO v_crew FROM user_profiles WHERE id = NEW.crew_id;

        -- B. Recupera Servizi Nautici associati
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'service_name', s.name,
                'service_code', s.code,
                'provider', s.provider,
                'quantity', ls.quantity,
                'start_time', ls.start_time,
                'end_time', ls.end_time,
                'notes', ls.notes
            )
        ), '[]'::jsonb) INTO v_services
        FROM logbook_services ls
        JOIN services s ON s.id = ls.service_id
        WHERE ls.logbook_entry_id = NEW.id;

        -- C. Snapshot Messaggi
        NEW.message_snapshot := (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'sender', up.display_name,
                    'role', am.sender_role,
                    'text', am.message_text,
                    'at', am.created_at
                ) ORDER BY am.created_at
            ), '[]'::jsonb)
            FROM activity_messages am
            JOIN user_profiles up ON up.id = am.sender_id
            WHERE am.vessel_activity_id = NEW.vessel_activity_id
              AND (am.included_in_logbook = true OR am.visibility = 'exported')
        );

        -- D. Costruisci il mega-snapshot (Digital Twin State)
        NEW.activity_snapshot := jsonb_build_object(
            'vessel_name', v_vessel.name,
            'vessel_mmsi', v_vessel.mmsi,
            'crew_name', v_crew.display_name,
            'activity_type', (SELECT activity_type FROM vessel_activity WHERE id = NEW.vessel_activity_id),
            'start_time', (SELECT start_time FROM vessel_activity WHERE id = NEW.vessel_activity_id),
            'end_time', (SELECT end_time FROM vessel_activity WHERE id = NEW.vessel_activity_id),
            'geofence', (SELECT g.name FROM vessel_activity va JOIN geofences g ON g.id = va.geofence_id WHERE va.id = NEW.vessel_activity_id),
            'services', v_services,
            'submitted_at', now()
        );

        NEW.submitted_at := now();

        -- E. Calcolo Hash di Integrità (Prima di salvare)
        v_data_to_hash := 
            COALESCE(NEW.narrative_text, '') || 
            COALESCE(NEW.activity_snapshot::text, '') ||
            COALESCE(NEW.message_snapshot::text, '') ||
            COALESCE(NEW.submitted_at::text, '');
        
        NEW.document_hash := encode(digest(v_data_to_hash, 'sha256'), 'hex');
        
    END IF;

    -- Blocco modifiche post-sottomissione per il crew
    IF OLD.status != 'draft' AND auth.uid() = NEW.crew_id THEN
        RAISE EXCEPTION 'Logbook is certified and locked (Hash: %).', OLD.document_hash;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
