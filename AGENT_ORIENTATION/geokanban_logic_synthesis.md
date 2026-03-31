# GeoKanban V3 — Project Logic Synthesis (Digital Twin Core)

Questo documento sintetizza le logiche ingegneristiche e funzionali implementate nel progetto GeoKanban fino alla data odierna, focalizzandosi sulla transizione verso un Digital Twin di cantiere.

## 1. Architettura dei Dati e Flusso Informativo
Il sistema si basa su una gerarchia "Trigger -> Database -> React Store":
- **Supabase (Realtime)**: Gestisce la persistenza e la sicurezza (RLS).
- **Postgres Views**: Calcolano i KPI in tempo reale per evitare calcoli pesanti sul client.
- **Zustand (useActivityStore)**: Unifica lo stato globale dell'applicazione, gestendo attività delle navi, messaggistica e piani di produzione.

## 2. Logica di Tracking e Geofencing (Cantiere Digitale)
Il nucleo del "Digital Twin" è gestito dal trigger `materialize_vessel_activity`:
- **Eventi ENTER/EXIT**: Rilevati via PostGIS sui poligoni dei geofence.
- **Activity Mapping**: Associa la natura del geofence (loading, unloading, port) al tipo di attività (Loading, Unloading, Mooring).
- **Standby Override**: Una logica prioritaria incrocia il calendario stand-by. Se una nave è in "Standby Meteo", il sistema ignora il movimento fisico nel geofence per dare priorità alla dichiarazione operativa.
- **Auto-Navigation**: All'uscita da un geofence, se non ci sono altre attività attive, il sistema crea automaticamente uno stato di "Navigation".

## 3. Calcolo KPI e Performance (Production Targets)
- **Achievement %**: Calcolato confrontando il tonnellaggio totale dei logbook (`actual_cargo_tonnes`) con il target impostato nei `production_plans`.
- **Ottimizzazione**: L'integrazione BI avviene tramite la vista `monthly_fleet_kpi`, che aggrega i dati per giorno/cantiere/nave.

## 4. Messaggistica e Collaborazione Operativa
- **Activity-Linked Chat**: Ogni messaggio è legato a una specifica istanza di attività (`vessel_activity_id`).
- **RLS & Role Fix**: Abbiamo risolto le restrizioni che impedivano all'utente `operation_admin` di scrivere messaggi, garantendo una comunicazione fluida tra ufficio e cantiere.

## 5. Stato dell'Arte e Prossimi Passi (Digital Twin v4)
- **Sincronizzazione Tempi**: Implementazione di `commence_time` per catturare i micro-tempi di ciclo.
- **NotebookLM Integration**: Utilizzo di questa sintesi per analizzare i dati storici e prevedere colli di bottiglia operativi. info
