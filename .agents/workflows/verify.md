---
description: Controlla tipi, linting e Build prima di considerare un task finito
---

# /verify — Validation & Quality Gates

Questo workflow si assicura che il codice appena scritto sia robusto e pronto per la fase di "Report" o "Learn". L'agente eseguirà i seguenti controlli:

## Quality Gates:
1. **Revisione Linting e Sintassi**: L'agente controllerà eventuali errori tipici di React/Javascript.
2. **Coerenza Tailwind CSS**: Si assicurerà di non aver usato classi arbitrarie non in linea con i design token (`index.css`).
3. **Check Dipendenze**: Se sono state inserite librerie, verifica che siano salvate corettamente in `package.json`.
4. **Error Handling**: L'agente rivedrà il codice appena scritto per assicurarsi che i blocchi `try/catch` per le chiamate a Supabase siano implementati e i messaggi all'utente siano mostrati.

*Al termine, l'agente confermerà se l'aggiunta è perfettamente sicura.*
