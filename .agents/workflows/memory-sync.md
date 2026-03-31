---
description: Protocollo obbligatorio di sincronizzazione memoria per ogni nuovo agente
---

# /memory-sync — Protocollo Orientamento Agente

Questo workflow DEVE essere eseguito all'inizio di ogni nuova chat per garantire che l'AI sia allineata con la memoria a lungo termine del progetto GeoKanban su NotebookLM.

## 📋 Fasi di Sincronizzazione

### 1. Verifica Connessione CLI
Controlla se il tool `notebooklm-py` è operativo.
// turbo
```powershell
& 'C:\Users\giuse\AppData\Roaming\Python\Python314\Scripts\notebooklm.exe' auth check
```

### 2. Aggancio al Notebook "GeoKanban Permanent Brain"
Seleziona il notebook di riferimento per acquisire il contesto storico.
// turbo
```powershell
& 'C:\Users\giuse\AppData\Roaming\Python\Python314\Scripts\notebooklm.exe' use '98039764-5819-4abe-b6ac-a5928353454c'
```

### 3. Allineamento Documentazione Locale
Leggi i file della cartella `AGENT_ORIENTATION` per conoscere lo stato corrente del codice.
1. Leggi [geokanban_logic_synthesis.md](file:///c:/Users/giuse/Desktop/ANTIGRAVITY/HANDOVER_GEOKANBAN/AGENT_ORIENTATION/geokanban_logic_synthesis.md)
2. Leggi [rulesgk.md](file:///c:/Users/giuse/Desktop/ANTIGRAVITY/HANDOVER_GEOKANBAN/.agents/rules/rulesgk.md)

### 4. Recupero Storico (RAG)
Fai una domanda di test a NotebookLM per verificare se ci sono nuovi vincoli o decisioni non documentate localmente.
// turbo
```powershell
& 'C:\Users\giuse\AppData\Roaming\Python\Python314\Scripts\notebooklm.exe' ask "Quali sono le decisioni architettoniche più recenti documentate nella memoria?"
```

## 🏁 Output Atteso
L'agente deve confermare di essere "Sincronizzato" e pronto ad operare secondo la governance stabilita.
