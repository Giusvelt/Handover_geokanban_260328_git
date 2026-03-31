-- ═══════════════════════════════════════════════════════════════
-- GeoKanban V3.3 — Logbook Engine & Immutability
-- Eseguire nel SQL Editor di Supabase
-- Data: 28 Feb 2026
--
-- Cosa fa:
--   1. Rafforza l'immutabilità del logbook al momento del 'submit'
--   2. Arricchisce lo snapshot con MMSI, Vessel Name e Servizi Nautici
--   3. Blocca ogni modifica ai servizi correlati dopo la sottomissione
-- ═══════════════════════════════════════════════════════════════

-- ═══ STEP 1: Rafforzamento Snapshot ═══

CREATE OR REPLACE FUNCTION freeze_logbook_submission()
RETURNS TRIGGER AS $$
DECLARE
    v_vessel record;
    v_crew record;
    v_services jsonb;
BEGIN
    -- Solo al passaggio da draft -> submitted (o approved/rejected dall'admin)
    IF NEW.status != 'draft' AND OLD.status = 'draft' THEN
        
        -- 1. Recupera dettagli Nave (MMSI, Name)
        SELECT name, mmsi INTO v_vessel FROM vessels WHERE id = NEW.vessel_id;
        
        -- 2. Recupera dettagli Crew (Name)
        SELECT display_name INTO v_crew FROM user_profiles WHERE id = NEW.crew_id;

        -- 3. Recupera Servizi Nautici associati
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

        -- 4. Congela Messaggi (già implementato, qui raffinato)
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

        -- 5. Costruisci il mega-snapshot (Digital Twin State)
        -- Questo oggetto contiene tutto il necessario per l'export Excel postumo
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

        -- 6. Marca timestamp sottomissione
        NEW.submitted_at := now();
        
    END IF;

    -- Se è già sottomesso, non permettere cambi di narrative_text o altri campi strutturali (tranne lo status da parte dell'admin)
    IF OLD.status != 'draft' AND auth.uid() = NEW.crew_id THEN
        RAISE EXCEPTION 'Logbook is locked. You cannot modify it after submission.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══ STEP 2: Blocco Servizi Nautici ═══

CREATE OR REPLACE FUNCTION check_logbook_service_lock()
RETURNS TRIGGER AS $$
DECLARE
    v_status VARCHAR;
BEGIN
    -- Recupera lo stato del logbook padre
    SELECT status INTO v_status 
    FROM logbook_entries 
    WHERE id = COALESCE(NEW.logbook_entry_id, OLD.logbook_entry_id);

    -- Se lo stato non è 'draft', blocca ogni modifica
    IF v_status != 'draft' AND auth.jwt()->>'role' != 'service_role' THEN
        RAISE EXCEPTION 'Cannot modify nautical services. The logbook for this activity has already been submitted and locked.';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger su logbook_services
DROP TRIGGER IF EXISTS trg_lock_logbook_services ON logbook_services;
CREATE TRIGGER trg_lock_logbook_services
    BEFORE INSERT OR UPDATE OR DELETE ON logbook_services
    FOR EACH ROW
    EXECUTE FUNCTION check_logbook_service_lock();


-- ═══ STEP 3: RLS Raffinata ═══

-- RLS per i servizi: non basta authenticated, deve impedire modifiche se non è draft
DROP POLICY IF EXISTS "auth_write_ls" ON logbook_services;
CREATE POLICY "crew_write_ls" ON logbook_services
    FOR ALL TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM logbook_entries le 
            WHERE le.id = logbook_entry_id 
              AND le.crew_id = auth.uid() 
              AND le.status = 'draft'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM logbook_entries le 
            WHERE le.id = logbook_entry_id 
              AND le.crew_id = auth.uid() 
              AND le.status = 'draft'
        )
    );

-- ═══ Nota ═══
-- Ora il comando nave "assume responsabilità" al clic su 'Submit'.
-- Tutto lo stato (Vessel, Activity, Services, Messages) viene materializzato
-- in un JSON immutabile (activity_snapshot) pronto per l'export.
