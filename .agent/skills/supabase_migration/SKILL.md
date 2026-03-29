---
name: supabase_migration
description: Procedura sicura per modificare lo schema del database Supabase di GeoKanban (aggiungere colonne, tabelle, policy RLS, ecc.)
---

# GeoKanban — Supabase Migration

Quando l'utente chiede di modificare il database (aggiungere campi, tabelle, colonne, policy), segui **sempre** questa procedura per evitare perdita di dati o problemi di sicurezza.

## Tabelle Principali GeoKanban
| Tabella | Scopo |
|---|---|
| `user_profiles` | Profili utenti (ruolo, nave assegnata, anagrafica) |
| `vessels` | Dati delle navi (nome, MMSI, avg_cargo) |
| `vessel_activity` | Log attività nave (Loading, Unloading, Navigation, ecc.) |
| `vessel_tracking` | Storico posizioni GPS nave |
| `geofences` | Zone geografiche configurate (tipo, coordinate) |
| `logbook_entries` | Logbook compilati dalla Crew |
| `activity_messages` | Chat interna per attività |
| `production_plans` | Target produzione mensili per nave |
| `weather_logs` | Dati meteo storici |

## Ruoli Utente
- `admin` → accesso totale a tutti i dati
- `crew` → accesso filtrato alla propria nave e flotta

## Step 1 — Crea il file SQL
Prima di eseguire qualsiasi cosa, crea un file SQL nella cartella `supabase/` con un nome descrittivo:
```
supabase/[data]_[descrizione].sql
```
Esempio: `supabase/2026-03-add-drifting-field.sql`

## Step 2 — Struttura della Migration
Ogni file SQL deve contenere:
```sql
-- Migration: [descrizione]
-- Data: [data]
-- Autore: GeoKanban

-- 1. Modifica struttura tabella
ALTER TABLE nome_tabella ADD COLUMN IF NOT EXISTS nuovo_campo tipo DEFAULT valore;

-- 2. Commento descrittivo sulla colonna
COMMENT ON COLUMN nome_tabella.nuovo_campo IS 'Descrizione del campo';

-- 3. Aggiorna RLS se necessario
-- (verifica se la tabella ha Row Level Security abilitata)
```

## Step 3 — Regole di Sicurezza RLS
Se la tabella modificata è `user_profiles`, `logbook_entries` o `vessel_activity`:
- **Verifica sempre** che la policy RLS esistente copra il nuovo campo.
- La policy crew deve continuare a filtrare per `vessel_id` o `crew_id`.
- Non esporre dati di altri utenti o altre navi alla Crew.

## Step 4 — Aggiorna il Frontend
Dopo aver eseguito la migration SQL su Supabase:
1. Aggiorna il **hook** corrispondente in `src/hooks/` per includere il nuovo campo nel `select()`
2. Se è un campo dell'utente → aggiorna `useUserProfile.js`
3. Se è un'attività → aggiorna `useActivityLog.js`
4. Se è del logbook → aggiorna `LogbookEntryModal.jsx`

## Step 5 — Esegui la Migration
Indica all'utente di:
1. Aprire il **Supabase Dashboard** → SQL Editor
2. Incollare il contenuto del file creato
3. Eseguire e verificare che non ci siano errori

**NON eseguire mai SQL direttamente da script Node.js con chiave service_role senza conferma esplicita dell'utente.**

## Step 6 — Verifica Post-Migration
Esegui un check veloce per confermare che i nuovi campi siano disponibili:
```
node check_logbooks_data.mjs
```
O crea uno script ad-hoc per leggere il nuovo campo.

## Note Critiche
- Usa sempre `IF NOT EXISTS` per le colonne per evitare errori se il campo esiste già.
- Non usare mai `DROP COLUMN` senza conferma esplicita dell'utente.
- Non rimuovere mai policy RLS esistenti senza una verifica approfondita.
