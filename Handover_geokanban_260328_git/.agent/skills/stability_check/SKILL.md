---
name: stability_check
description: Verifica la stabilità e l'integrità dei dati dell'applicazione GeoKanban prima di un deploy o dopo modifiche critiche.
---

# GeoKanban — Stability Check

Quando l'utente chiede di fare un "stability check", uno "stability-check" o una verifica dello stato dell'app, esegui i seguenti step nell'ordine esatto.

## Stack Tecnico di Riferimento
- **Frontend:** React + Vite, porta locale `5173`
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions)
- **Deploy:** Vercel (branch `main` di GitHub → auto-deploy)
- **Package manager:** npm

## Step 1 — Verifica Build
Prima di tutto verifica che il progetto compili senza errori.
```
npm run build
```
- Se fallisce: **FERMATI** e mostra l'errore all'utente. Non procedere oltre.
- Se ha successo: procedi al passo 2.

## Step 2 — Verifica Integrità File Critici
Controlla che i file fondamentali esistano e siano non vuoti:
- `src/App.jsx`
- `src/context/DataContext.jsx`
- `src/hooks/useUserProfile.js`
- `src/hooks/useActivityLog.js`
- `src/lib/supabase.js`
- `.env` o `.env.local` (variabili Supabase)

## Step 3 — Verifica Variabili d'Ambiente
Assicurati che le seguenti variabili siano presenti nel file `.env`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Se mancano, avvisa immediatamente l'utente: **l'app non funzionerà senza di esse**.

## Step 4 — Verifica Stato Git
```
git status
git log --oneline -5
```
Mostra all'utente:
- Se ci sono file modificati non committati
- Gli ultimi 5 commit per avere contesto

## Step 5 — Verifica Connessione Supabase
Esegui uno dei seguenti script di test presenti nel progetto:
```
node check_logbooks_data.mjs
```
Se il risultato mostra dati o "0 entries" senza errori → connessione OK.
Se mostra un errore di autenticazione o network → segnala problema API key.

## Step 6 — Report Finale
Alla fine, produci un breve report in formato tabella:

| Check | Stato |
|---|---|
| Build | ✅ OK / ❌ ERRORE |
| File critici | ✅ OK / ⚠️ Mancante: [file] |
| Variabili .env | ✅ OK / ❌ Mancanti |
| Git | ✅ Pulito / ⚠️ [N] file modificati |
| Supabase | ✅ Connesso / ❌ Errore |

## Note Importanti
- NON fare `git push` automaticamente durante questo check.
- NON modificare alcun file durante questo check, solo leggere e verificare.
- Se l'utente ha già il dev server in esecuzione (`npm run dev`), non fare il build — controlla solo i file.
