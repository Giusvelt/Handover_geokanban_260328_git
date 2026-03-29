-- ═══════════════════════════════════════════════════════════════
-- GeoKanban V3.3.1 — Logbook Auto-Creation
-- Eseguire nel SQL Editor di Supabase
-- Data: 28 Feb 2026
--
-- Cosa fa:
--   1. Crea automaticamente un logbook_entry ogni volta che nasce
--      una vessel_activity (sia automatica che manuale).
--   2. Associa il logbook al crew assegnato alla nave in quel momento.
--   3. Backfilla i logbook mancanti per le attività esistenti.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION auto_create_logbook_entry()
RETURNS TRIGGER AS $$
DECLARE
    v_crew_id UUID;
BEGIN
    -- Individua il crew assegnato alla nave (prende il primo se ce ne sono più di uno)
    SELECT id INTO v_crew_id 
    FROM user_profiles 
    WHERE vessel_id = NEW.vessel_id AND role = 'crew'
    LIMIT 1;

    -- Se non c'è un crew assegnato, mettiamo un segnaposto o l'admin loggato se esiste
    -- (Per ora, se non c'è crew, non creiamo il logbook finché non viene aperto nel front-end)
    IF v_crew_id IS NOT NULL THEN
        INSERT INTO logbook_entries (
            vessel_id, 
            vessel_activity_id, 
            crew_id, 
            status
        ) VALUES (
            NEW.vessel_id, 
            NEW.id, 
            v_crew_id, 
            'draft'
        )
        ON CONFLICT (vessel_activity_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger su vessel_activity
DROP TRIGGER IF EXISTS trg_auto_logbook ON vessel_activity;
CREATE TRIGGER trg_auto_logbook
    AFTER INSERT ON vessel_activity
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_logbook_entry();


-- ═══ Backfill ═══
-- Crea i logbook per tutte le attività che non ne hanno uno

INSERT INTO logbook_entries (vessel_id, vessel_activity_id, crew_id, status)
SELECT 
    va.vessel_id, 
    va.id, 
    (SELECT up.id FROM user_profiles up WHERE up.vessel_id = va.vessel_id AND up.role = 'crew' LIMIT 1),
    'draft'
FROM vessel_activity va
WHERE NOT EXISTS (
    SELECT 1 FROM logbook_entries le WHERE le.vessel_activity_id = va.id
)
AND (SELECT count(*) FROM user_profiles up WHERE up.vessel_id = va.vessel_id AND up.role = 'crew') > 0;
