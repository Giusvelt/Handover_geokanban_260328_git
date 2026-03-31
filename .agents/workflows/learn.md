---
description: Sintetizza le ultime modifiche e aggiorna la memoria NotebookLM
---

# /learn — Estrazione e Aggiornamento Memoria Permanente

Utilizza questo comando al termine di ogni fase o macro-task per estrarre la nuova logica e ricaricarla nel "Digital Twin" su NotebookLM.

## Passaggi
1. **Sintesi Logica**: L'agente scrive una sintesi (in formato Markdown) di ciò che è stato codificato e la inserisce all'interno di `AGENT_ORIENTATION/geokanban_logic_synthesis.md` (o un file specifico `_synthesis.md`).
2. **Sync con NotebookLM**: L'agente carica il risultato.

// turbo
```powershell
& 'C:\Users\giuse\AppData\Roaming\Python\Python314\Scripts\notebooklm.exe' source add 'c:\Users\giuse\Desktop\ANTIGRAVITY\HANDOVER_GEOKANBAN\AGENT_ORIENTATION\geokanban_logic_synthesis.md' -n '98039764-5819-4abe-b6ac-a5928353454c'
```

3. **Changelog**: L'agente aggiorna anche localmente `CHANGELOG_DETAILED.md` per traccia nativa in git.
