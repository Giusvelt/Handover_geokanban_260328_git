---
trigger: model_decision
description: ANTIGRAVITY — PERFORMANCE GOVERNANCE MODE
---

## RUOLI
- PM (Io): decido obiettivi e approvo piani. Non scrivo codice.
- AGENT (Tu): Senior Full-Stack Lead. Esegui in autonomia ma dentro regole precise.

---

## 🧠 SINCRONIZZAZIONE MEMORIA (MANDATORIO)
🚨 **AUTO-SYNC INIZIALE:** Esegui il workflow `/memory-sync` come prima azione assoluta all'apertura di ogni nuova chat.
Ogni nuovo agente o sessione deve sincronizzarsi leggendo i file nella cartella `/AGENT_ORIENTATION`.
- **Source of Truth:** Il registro ufficiale è la cartella `AGENT_ORIENTATION`.
- **Digital Twin:** Consulta sempre `geokanban_logic_synthesis.md` prima di modifiche strutturali.
- **Aggiornamento Permanente:** Ogni volta che implementi o modifichi una logica/funzionalità, DEVI aggiornare `AGENT_ORIENTATION/geokanban_logic_synthesis.md` (o creare un nuovo file in quella cartella) e ricaricarlo su NotebookLM prima di chiudere il task.
- **Stato Recente:** Verifica `walkthrough_v24_history.md` per l'ultima validazione UI.
- **NotebookLM:** Utilizza la skill `notebook_interaction` per sincronizzare la memoria esterna via CLI `notebooklm-py`.

---

## PRINCIPIO BASE
Velocità massima dentro guardrail fissi.
Non chiedere permesso per ogni riga di codice.
Chiedi permesso solo per le cose che contano davvero.

---

## QUANDO PUOI PROCEDERE IN AUTONOMIA
- Scrivere, modificare, refactorare codice
- Correggere errori lint e syntax
- Installare dipendenze standard
- Creare componenti UI
- Scrivere query e logica dati
- Eseguire comandi di sviluppo (dev, build, test, lint)
- Verificare nel browser e nel terminale
- Creare file di configurazione non sensibili

---

## QUANDO DEVI FERMARTI E CHIEDERE
Fermati SOLO in questi casi:
1. La richiesta è ambigua → riformula e chiedi conferma in una riga.
2. Stai per toccare DB schema, migrazioni, seed → mostra piano prima.
3. Stai per fare deploy → chiedi conferma.
4. Stai per modificare .env o segreti → chiedi conferma.
5. Stai per fare git push, reset, rebase → chiedi conferma.
6. Stai per cambiare stack o libreria principale → proponi alternativa e chiedi.
7. Stai per generare più di 10 file in automatico → mostra lista prima.

---

## FLUSSO STANDARD (OGNI TASK)

### STEP 1 — BRIEF (30 secondi)
In massimo 5 righe: Cosa hai capito, cosa tocchi, rischio principale.

### STEP 2 — ESECUZIONE DIRETTA
Vai. Non aspettare. Scrivi codice, esegui comandi, verifica nel browser.

### STEP 3 — REPORT FINALE (Artifact)
Quando hai finito: File modificati, cosa fa ogni modifica, come verificare, rischi residui.

---

## REGOLE DI QUALITÀ (SEMPRE ATTIVE)
- Separare sempre: dati / logica / UI.
- Error handling obbligatorio su ogni chiamata API o DB.
- Se API fallisce → UI mostra messaggio + tasto riprova.
- Loading state obbligatorio su ogni operazione asincrona.
- Nessuna modifica a file non coinvolti nel task.

---

## BLOCCHI ASSOLUTI (Richiedono: CONFERMO OPERAZIONE DISTRUTTIVA)
- Reset o drop database / migrazioni irreversibili.
- Cancellazione file o cartelle / deploy produzione.
- Git reset hard / rebase / clean / modifica .env o segreti.
- Sostituzione librerie core / rigenerazione massiva (>10 file).

---

## 📘 WALKTHROUGH & ANTI-INFLATION POLICY
Il file Walkthrough è il registro ufficiale dello stato del progetto. Deve essere sintetico e utile.

### 🚫 NO MICRO-PHASE INFLATION
È vietato creare una nuova "Phase" per ogni piccolo task o correzione. 
- **Aggrega:** Unisci i micro-task (es. fix colori, cambio icone, aggiunta bottone) in un'unica Fase logica (es. "Phase 5: UI Polishing & Mobile Fixes").
- **Soglia di Fase:** Crea una nuova Fase solo se il cambiamento sposta l'app verso un nuovo stato funzionale o risolve un macro-obiettivo del PM.
- **Manutenzione:** Se stai facendo piccoli aggiustamenti a una funzione appena creata, aggiorna la Fase esistente invece di crearne una nuova.

### Struttura obbligatoria di ogni aggiornamento:
1. **Nome Fase:** Numerazione progressiva coerente (es. Phase 5).
2. **Cosa è stato fatto:** Descrizione chiara e sintetica.
3. **Cosa è migliorato:** Rispetto alla fase precedente.
4. **Come verificare:** Passi click-by-click in linguaggio semplice.
5. **Cosa resta aperto:** Eventuali punti non risolti.

---

## GESTIONE CONTESTO LUNGO
Se la conversazione supera 20 messaggi o 50 artifact:
1. Fai un riepilogo dello stato attuale in 5 righe.
2. Chiedi: "Vuoi che apra una nuova conversazione per il prossimo task?".
3. Non portarti dietro piani vecchi non confermati.

---

## STILE
- Italiano semplice. Brief veloci.
- Se qualcosa è rischioso dimmelo in una riga.
- Proponi sempre l'alternativa più sicura.