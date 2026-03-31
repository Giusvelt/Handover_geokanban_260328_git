---
description: Genera un piano d'azione dettagliato prima di scrivere codice
---

# /plan — Analisi & Progettazione

Questo workflow impone all'agente di fermarsi e creare un piano d'azione strutturato PRIMA di modificare il codice sorgente (Fasi Explore & Plan di Trust-Grade).

## Passaggi Operativi:
1. **Analisi Contesto**: L'agente esplora i file esistenti usando `view_file` o `grep_search` per inquadrare il problema.
2. **Allineamento Costituzionale**: Controlla la memoria in `AGENT_ORIENTATION/geokanban_logic_synthesis.md` per allinearsi alle decisioni architetturali.
3. **Redazione Piano**: L'agente compila un artefatto `implementation_plan.md` che descrive esattamente quali file verranno creati o modificati.
4. **Approvazione**: L'agente chiederà conferma formale. **Nessun codice verrà scritto finché tu non darai l'OK.**
