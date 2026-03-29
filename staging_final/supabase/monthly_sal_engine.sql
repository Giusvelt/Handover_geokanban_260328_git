-- ═══════════════════════════════════════════════════════════════
-- GeoKanban V3.5 — Monthly SAL Certification Engine
-- Eseguire nel SQL Editor di Supabase
-- ═══════════════════════════════════════════════════════════════

-- 1. Tabella delle Certificazioni Mensili (SAL)
CREATE TABLE IF NOT EXISTS monthly_sal_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month           INTEGER NOT NULL,
    year            INTEGER NOT NULL,
    vessel_id       UUID REFERENCES vessels(id),
    activity_count  INTEGER,
    full_data_json  JSONB NOT NULL,
    integrity_hash  TEXT NOT NULL,
    certified_by    UUID REFERENCES user_profiles(id),
    certified_at    TIMESTAMPTZ DEFAULT now(),
    status          VARCHAR DEFAULT 'certified' -- certified, archived
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_sal_month_year ON monthly_sal_snapshots(month, year, vessel_id);

-- 2. Funzione per Certificare il Mese (SAL)
-- Questa funzione viene chiamata dall'interfaccia Admin
CREATE OR REPLACE FUNCTION certify_monthly_sal(p_month INTEGER, p_year INTEGER)
RETURNS TEXT AS $$
DECLARE
    v_vessel record;
    v_data jsonb;
    v_hash text;
    v_count integer;
    v_final_hash text := '';
BEGIN
    -- Solo gli admin possono certificare il SAL mensile
    IF (SELECT role FROM user_profiles WHERE id = auth.uid()) != 'admin' THEN
        RAISE EXCEPTION 'Only Administrators can certify monthly SAL snapshots.';
    END IF;

    -- Iteriamo per ogni nave per creare snapshot individuali (o uno globale)
    -- Per semplicità creiamo uno snapshot per ogni nave che ha avuto attività nel mese
    FOR v_vessel IN SELECT id, name FROM vessels LOOP
        
        -- A. Raccogliamo tutte le attività della nave per quel mese
        -- Consideriamo le attività INIZIATE nel mese specificato
        SELECT 
            coalesce(jsonb_agg(
                jsonb_build_object(
                    'id', va.id,
                    'activity', va.activity_type,
                    'geofence', g.name,
                    'start_time', va.start_time,
                    'end_time', va.end_time,
                    'duration', va.duration_minutes,
                    'status', va.status,
                    'narrative', le.narrative_text,
                    'logbook_status', le.status,
                    'services', (
                        SELECT jsonb_agg(jsonb_build_object('name', s.name, 'qty', ls.quantity))
                        FROM logbook_services ls
                        JOIN services s ON s.id = ls.service_id
                        WHERE ls.logbook_entry_id = le.id
                    )
                ) ORDER BY va.start_time
            ), '[]'::jsonb),
            count(*)
        INTO v_data, v_count
        FROM vessel_activity va
        LEFT JOIN geofences g ON g.id = va.geofence_id
        LEFT JOIN logbook_entries le ON le.vessel_activity_id = va.id
        WHERE va.vessel_id = v_vessel.id
          AND extract(month from va.start_time) = p_month
          AND extract(year from va.start_time) = p_year;

        IF v_count > 0 THEN
            -- B. Calcoliamo l'Hash di Integrità per questo set di dati
            v_hash := encode(digest(v_data::text, 'sha256'), 'hex');

            -- C. Salviamo la Certificazione
            INSERT INTO monthly_sal_snapshots (
                month, year, vessel_id, activity_count, full_data_json, integrity_hash, certified_by
            ) VALUES (
                p_month, p_year, v_vessel.id, v_count, v_data, v_hash, auth.uid()
            );

            -- Concateniamo l'hash finale (per ritornarlo all'utente come prova)
            v_final_hash := v_final_hash || v_vessel.name || ':' || substr(v_hash, 1, 8) || '; ';
            
            -- D. Opzionale: Marcare le attività come "Archiviate/Congelate"
            -- UPDATE vessel_activity SET status = 'archived' WHERE ...
        END IF;
    END LOOP;

    RETURN v_final_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RLS per le certificazioni
ALTER TABLE monthly_sal_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_sal" ON monthly_sal_snapshots
    FOR ALL TO authenticated USING (
        (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY "crew_view_own_sal" ON monthly_sal_snapshots
    FOR SELECT TO authenticated USING (
        vessel_id = (SELECT vessel_id FROM user_profiles WHERE id = auth.uid())
    );
