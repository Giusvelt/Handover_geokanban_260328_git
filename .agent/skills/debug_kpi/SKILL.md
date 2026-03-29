---
name: debug_kpi
description: Procedura di debug per i KPI di GeoKanban quando i valori sembrano errati o inconsistenti tra i tab Vessel Activity e Production Target.
---

# GeoKanban — Debug KPI

Quando l'utente segnala che i KPI sembrano sbagliati, i numeri non tornano, o ci sono discrepanze tra i tab, segui questa procedura diagnostica.

## Architettura KPI di GeoKanban

### Sorgenti Dati
I KPI dipendono da due sorgenti principali:
1. **`vessel_activity`** (tabella Supabase) → conteggio operazioni (Loading, Unloading, Navigation)
2. **`vessels.avg_cargo`** → tonnellaggio medio per nave usato come stima

### Come vengono Calcolati
```
Tonnaggio Stimato = Σ (n_unloadings_nave × avg_cargo_nave)
Tonnaggio Reale   = Σ (actual_cargo_tonnes dichiarati nel Logbook per Unloading)
Achievement %     = Tonnaggio Stimato / Target Mensile × 100
```

### File Coinvolti
| File | Ruolo |
|---|---|
| `src/components/ProductionTargetTab.jsx` | Card summary + tabella per nave |
| `src/components/VesselActivityTab.jsx` | Archivio KPI mensili + tabella attività |
| `src/hooks/useActivityLog.js` | Fetch dati attività + mapping |
| `src/context/DataContext.jsx` | Distribuzione dati a tutti i componenti |

## Step 1 — Identifica Quale KPI è Sbagliato
Chiedi o verifica:
- È sbagliato il **conteggio viaggi** (n. di Unloading)?
- È sbagliato il **tonnaggio stimato** (avg_cargo × trip)?
- È sbagliato il **tonnaggio reale** (drifting dichiarato)?
- È sbagliato il **target** (goal mensile)?
- È sbagliato il **periodo** (March 2026 vs February 2026)?

## Step 2 — Verifica il Periodo Corrente
Il periodo è calcolato con:
```js
const now = new Date();
const currentPeriod = now.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
// Risultato: "March 2026"
```
Verifica che il server locale abbia la data corretta.

## Step 3 — Conta le Unloading nel Database
Crea o usa uno script Node.js per contare le Unloading del mese corrente:
```js
// Esempio query da eseguire con node script.mjs
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const { data } = await supabase
  .from('vessel_activity')
  .select('id, vessel_id, activity_type, start_time')
  .eq('activity_type', 'Unloading')
  .gte('start_time', '2026-03-01')
  .lte('start_time', '2026-03-31')
  
console.log(`Unloading di Marzo: ${data.length}`)
data.forEach(d => console.log(d.vessel_id, d.start_time))
```

## Step 4 — Verifica avg_cargo delle Navi
Il tonnaggio stimato dipende dall'`avg_cargo` di ogni nave. Controlla:
```js
const { data: vessels } = await supabase.from('vessels').select('name, avg_cargo')
vessels.forEach(v => console.log(v.name, v.avg_cargo))
```
Se `avg_cargo` è `null` o `0` per alcune navi → il tonnaggio quella nave risulterà sempre 0.

## Step 5 — Verifica i Production Plans
Il target mensile viene da `production_plans`:
```js
const { data } = await supabase
  .from('production_plans')
  .select('*')
  .eq('period_name', 'March 2026')
console.table(data)
```
- Il record con `vessel_id = null` è il **target globale** mensile
- I record con `vessel_id` valorizzato sono target per singola nave

## Step 6 — Causa Comune: Dati Vecchi Inquinati
**Problema storico noto:** In passato la colonna `actual_trips` nella tabella `production_plans` veniva accumulata in modo errato. 
**Soluzione:** I KPI ora si basano esclusivamente sul conteggio live da `vessel_activity`, non su colonne statiche.
Se i valori sembraro gonfiati → verifica che il codice in `ProductionTargetTab.jsx` usi `actualTripsMap` calcolato da `activities` e **non** `p.actual_trips` dal database.

## Note
- Il **22%** di Achievement a inizio mese è fisiologicamente corretto se siamo nei primi giorni
- Il **87%** o valori gonfiati sono quasi sempre causati da dati statici stantii nel DB
- La differenza tra "Delivered (Est.)" e "Actual" è voluta: Est. usa avg_cargo, Actual usa il Drifting dichiarato dalla Crew
