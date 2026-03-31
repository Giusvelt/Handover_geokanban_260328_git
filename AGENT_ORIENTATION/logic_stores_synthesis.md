# GeoKanban — Frontend Stores Logic (Zustand)

Questo documento contiene la sintesi della logica di gestione dello stato globale dell'applicazione GeoKanban, implementata tramite Zustand.

## 1. `useActivityStore.js` (Gestione Attività Flotta)
Questo store gestisce la pipeline principale dei dati operativi della flotta (KPI, attività attuali, piani di produzione).

### Responsabilità:
- **`activities`**: Mappa la tabella `vessel_activity` unendola con i dati delle navi, dei geofence e del logbook. Trasforma lo stato `active` in `in-progress`. Calcola i badge di notifica contando i messaggi non letti per ruolo (crew vs admin).
- **`fleetKPIs` / `vesselKPIs`**: Recupera i KPI mensilizzati pre-calcolati dalle viste SQL di Supabase (`monthly_fleet_kpi`, `monthly_vessel_kpi`).
- **`productionPlans`**: Gestisce le operazioni CRUD sulla tabella `production_plans`.

### Metodi Principali:
- `fetchActivities(vesselId, userRole)`: Carica le attività e appiattisce la struttura dati per la UI, includendo conteggi messaggi e stato logbook.

## 2. `useVesselStore.js` (Tracking e Datalastic)
Questo store è il cuore del Digital Twin navale. Gestisce l'anagrafica vascelli e la fusione dello storico GPS con i dati Real-Time AIS.

### Responsabilità:
- **`vessels`**: Anagrafica di base dei mezzi (MMSI, nomi, tipologia).
- **`vesselPositions`**: Posizione corrente o storica di ciascun vascello.
- Fusione dati asincrona: Unisce i dati statici di Supabase con il feed live dell'API AIS.

### Metodi Principali:
- `loadHistoricalPositions(visibleVessels)`: Recupera le ultime 200 posizioni dalla tabella `vessel_tracking` per i vascelli visibili. Esegue un match per `vessel_id` o `mmsi`.
- `updateLivePositions(livePositions)`: Overlayer asincrono. Riceve un dizionario `MMSI -> liveData` (tipicamente da Datalastic API) e aggiorna in tempo reale `lat`, `lon`, `speed` e `heading` senza re-fetchare il database. Utilizza una Map in-memory per lookups ottimizzati.
