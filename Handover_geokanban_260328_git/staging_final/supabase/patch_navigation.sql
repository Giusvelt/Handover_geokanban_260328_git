-- ═══════════════════════════════════════════════════════════════
-- GeoKanban V3.2.1 — Navigation Activity Patch
-- Eseguire nel SQL Editor di Supabase
-- Data: 28 Feb 2026
--
-- Cosa fa:
--   1. Aggiorna il trigger per creare "Navigation" automatica su EXIT
--   2. Backfilla le Navigation mancanti per tutte le navi
-- ═══════════════════════════════════════════════════════════════

-- ═══ STEP 1: Aggiorna il trigger materialize_vessel_activity ═══
-- Nuova logica:
--   ENTER → chiude Navigation attiva (se esiste) + crea nuova activity
--   EXIT  → chiude activity corrente + crea Navigation

CREATE OR REPLACE FUNCTION materialize_vessel_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_nature TEXT;
    v_activity_type TEXT;
    v_existing_id UUID;
BEGIN
    -- Determina tipo attività dalla natura del geofence
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
        -- Chiudi eventuali Navigation attive per questa nave
        UPDATE vessel_activity SET
            end_time = NEW.timestamp,
            status = 'completed',
            updated_at = now()
        WHERE vessel_id = NEW.vessel_id
          AND activity_type = 'Navigation'
          AND status = 'active';

        -- Crea nuova activity dal geofence
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

        -- Crea Navigation automatica
        -- (solo se non c'è già un'altra activity attiva per questa nave)
        IF NOT EXISTS (
            SELECT 1 FROM vessel_activity
            WHERE vessel_id = NEW.vessel_id
              AND status = 'active'
        ) THEN
            INSERT INTO vessel_activity (
                vessel_id, activity_type, geofence_id,
                start_time, source, status
            ) VALUES (
                NEW.vessel_id, 'Navigation', NULL,
                NEW.timestamp, 'geofence', 'active'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══ STEP 2: Backfill Navigation per tutti i gap storici ═══
-- Per ogni nave: trova l'ultimo EXIT senza un successivo ENTER
-- e crea una Navigation attiva da quel momento

-- 2a. Crea Navigation per navi che hanno l'ultima activity completata
-- (= sono uscite dall'ultimo geofence e non sono entrate in nessun altro)

INSERT INTO vessel_activity (vessel_id, activity_type, start_time, source, status)
SELECT DISTINCT ON (va.vessel_id)
    va.vessel_id,
    'Navigation',
    va.end_time,        -- La Navigation parte quando l'ultima activity è finita
    'geofence',
    'active'
FROM vessel_activity va
WHERE va.status = 'completed'
  AND va.end_time IS NOT NULL
  -- Solo se non esiste già un'activity attiva per questa nave
  AND NOT EXISTS (
      SELECT 1 FROM vessel_activity va2
      WHERE va2.vessel_id = va.vessel_id
        AND va2.status = 'active'
  )
  -- Solo se non c'è un'activity successiva (= è l'ultima)
  AND NOT EXISTS (
      SELECT 1 FROM vessel_activity va3
      WHERE va3.vessel_id = va.vessel_id
        AND va3.start_time > va.end_time
  )
ORDER BY va.vessel_id, va.end_time DESC;


-- ═══ STEP 3: Backfill Navigation storiche nei gap tra activity ═══
-- Per ogni coppia consecutiva di activity completate dove c'è un gap > 5 min,
-- inserisci una Navigation completata

INSERT INTO vessel_activity (vessel_id, activity_type, start_time, end_time, source, status)
SELECT
    curr.vessel_id,
    'Navigation',
    curr.end_time,       -- Parte quando finisce l'activity corrente
    next_act.start_time, -- Finisce quando inizia la prossima
    'geofence',
    'completed'
FROM vessel_activity curr
JOIN LATERAL (
    SELECT start_time
    FROM vessel_activity va2
    WHERE va2.vessel_id = curr.vessel_id
      AND va2.start_time > curr.end_time
      AND va2.activity_type != 'Navigation'
    ORDER BY va2.start_time ASC
    LIMIT 1
) next_act ON true
WHERE curr.status = 'completed'
  AND curr.end_time IS NOT NULL
  AND curr.activity_type != 'Navigation'
  -- Gap di almeno 5 minuti (ignora transizioni immediate tra geofence)
  AND EXTRACT(EPOCH FROM (next_act.start_time - curr.end_time)) > 300
  -- Non esiste già una Navigation per questo gap
  AND NOT EXISTS (
      SELECT 1 FROM vessel_activity nav
      WHERE nav.vessel_id = curr.vessel_id
        AND nav.activity_type = 'Navigation'
        AND nav.start_time = curr.end_time
  );


-- ═══ Verifica ═══
SELECT
    v.name,
    COUNT(*) AS total_activities,
    COUNT(*) FILTER (WHERE va.activity_type = 'Navigation') AS navigation_count,
    COUNT(*) FILTER (WHERE va.status = 'active') AS active_count
FROM vessel_activity va
JOIN vessels v ON v.id = va.vessel_id
GROUP BY v.name
ORDER BY total_activities DESC;
