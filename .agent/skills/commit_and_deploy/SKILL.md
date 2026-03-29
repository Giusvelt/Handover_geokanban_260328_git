---
name: commit_and_deploy
description: Procedura completa e sicura per committare le modifiche su Git e fare il deploy dell'app GeoKanban su Vercel.
---

# GeoKanban — Commit & Deploy

Quando l'utente dice "pubblichiamo", "deploy", "manda online", "push", o simili, segui questa procedura nell'ordine esatto.

## Prerequisiti
- Il progetto usa **Git** con remote `origin` su GitHub (branch `main`)
- Vercel è configurato con auto-deploy dal branch `main`
- Ogni push su `main` trigghera automaticamente il deploy su Vercel

## Step 1 — Verifica Stato Attuale
```
git status
```
- Mostra all'utente quali file sono stati modificati
- Se non ci sono modifiche, avvisa l'utente e **fermati**

## Step 2 — Verifica Build (obbligatorio prima del push)
```
npm run build
```
- Se fallisce con errori: **FERMATI**. Non fare mai `git push` se il build è rotto.
- Mostra l'errore e proponi la correzione.
- Se ha successo: procedi.

## Step 3 — Aggiungi i File e Fai il Commit
Usa sempre il punto per aggiungere tutti i file modificati:
```
git add .
git commit -m "[tipo]: [descrizione breve in inglese]"
```

### Formato del messaggio di commit
Usa sempre questo formato standard:
- `feat:` → nuova funzionalità
- `fix:` → correzione bug
- `style:` → modifiche UI/CSS senza logica
- `refactor:` → riorganizzazione codice
- `db:` → modifiche schema database
- `docs:` → aggiornamento documentazione

**Esempi:**
- `feat: Add drifting cargo tracking for Unloading activities`
- `fix: Correct KPI calculation for March production target`
- `db: Add company_name and phone_number to user_profiles`

## Step 4 — Push su GitHub
```
git push origin main
```
**ATTENZIONE:** In PowerShell usa `;` al posto di `&&` per concatenare comandi:
```powershell
git add . ; git commit -m "feat: descrizione" ; git push origin main
```

## Step 5 — Conferma Deploy su Vercel
Dopo il push, il deploy su Vercel parte automaticamente.
- Il deploy impiega tipicamente **1-3 minuti**
- Puoi verificare lo stato su: `https://vercel.com/dashboard`
- L'URL di produzione dell'app è quello configurato su Vercel per il progetto GeoKanban

## Step 6 — Report Post-Deploy
Informa l'utente con:
- Il commit hash (breve) appena creato
- Il numero di file modificati
- Un promemoria di verificare l'app online dopo 2 minuti

## Regole Importanti
- **NON fare mai** `git push --force` senza conferma esplicita
- **NON committare** mai file `.env` o `.env.local` con le chiavi API
- Se il file `.gitignore` non include `.env`, avvisa immediatamente l'utente
- **NON fare** `git push` se ci sono file `*.mjs` di test temporanei che non dovrebbero andare online (chiedi conferma)
