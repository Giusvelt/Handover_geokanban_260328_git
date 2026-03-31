# GeoKanban Handover - 28/03/2026

## Panoramica del Progetto
Questo pacchetto contiene l'intera codebase di **GeoKanban V3**, incluse tutte le modifiche recenti effettuate per la stabilizzazione della Fase 24 e il ripristino delle funzionalità Premium.

## Contenuto della Cartella
- `/src`: Codice sorgente React (Frontend).
- `/supabase`: Migrazioni SQL e configurazioni database.
- `/.antigravity_history`: Storico completo del lavoro svolto (Task, Piani di Implementazione, Screenshot di verifica).
- `CHANGELOG_GIT.txt`: Storico dei commit Git (last to first).
- `CHANGELOG_DETAILED.md`: Riepilogo dettagliato delle ultime modifiche tecniche.
- `MISSION_CONTROL.md`: Protocollo di gestione e stato del progetto.
- `rules.md`: Regole di sviluppo e standard qualitativi seguiti.

## Stato Attuale (Fase 24 Stabilized)
1.  **Admin Console**: Ripristinate le card KPI Premium nel tab "Vessel Activity". La logica è ora collegata alla vista SQL `monthly_fleet_kpi` (regola rigida >20min).
2.  **Crew Schedule**: Aggiunto tasto "+" blu persistente nelle celle future del calendario per dichiarazioni standby semplificate.
3.  **UI Verification**: 
    - Icone `CheckCircle` uniformate (Grigio = draft, Verde = submitted).
    - Risolto `ReferenceError` che causava crash all'avvio nel tab Vessel Activity.
    - Blindatura permessi: Admin ha accesso sola lettura alle attività e allo schedule.

## Come Proseguire
Il progetto è configurato per Vite. Per avviarlo in un nuovo ambiente:
1.  `npm install`
2.  `npm run dev`

Per le credenziali Supabase, fare riferimento al file `.env` (se presente) o alla configurazione in `src/lib/supabase.js`.

---
*Handover preparato da Antigravity per l'utente Giuseppe.*
