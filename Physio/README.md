# Physio System (MVP)

Ziel: tägliche, messbare Fortschritte durch kurzen Check-in + präzisen Tagesplan.

## Struktur
- `Problemzonen/` – je Zone eine Datei basierend auf Vorlage
- `Daily-Checkins/` – tägliche Logs
- `Protokolle/Wochenreview.md` – Wochenauswertung
- `Ressourcen/Video-Library.md` – kuratierte Videos
- `Vorlagen/` – Templates

## Start (3 Schritte)
1. Lege deine Problemzonen an aus `Vorlagen/problemzone-template.md`.
2. Starte tägliche Polls (Discord/Telegram/WhatsApp).
3. Erstelle täglich eine Datei in `Daily-Checkins/` nach Vorlage.

## Poll-Vorlage (Discord)
```bash
openclaw message poll --channel discord --target channel:1475127393411661976 \
  --poll-question "Wo ist heute dein größter Engpass?" \
  --poll-option "Nacken" --poll-option "Schulter" --poll-option "LWS/Rücken" \
  --poll-option "Hüfte" --poll-option "Knie" --poll-option "Fuß/Sprunggelenk"

openclaw message poll --channel discord --target channel:1475127393411661976 \
  --poll-question "Wie stark heute (0-10)?" \
  --poll-option "0-2" --poll-option "3-4" --poll-option "5-6" --poll-option "7-8" --poll-option "9-10"

openclaw message poll --channel discord --target channel:1475127393411661976 \
  --poll-question "Zeitbudget heute?" \
  --poll-option "5 min" --poll-option "10 min" --poll-option "20 min"
```

## Tagesplan-Logik (Regelbasiert)
- **5 min:** 1 Mobilität + 1 Aktivierung (je 2-3 Sets kurz)
- **10 min:** 1 Mobilität + 1 Aktivierung + 1 Integration
- **20 min:** 2 Mobilität + 2 Aktivierung + 1 Integration

### Steuerung
- Ziel-Reiz: "fordernd, aber sauber" (RPE 4-6/10)
- Bei Schmerzanstieg >2 Punkte oder Verschlechterung >24h: Volumen runter / Regression
- Position/Qualität vor Intensität

## Nächster Ausbau
- Automatisierte tägliche Polls per Cron
- Auto-Erzeugung des Tagesplans aus Poll-Antworten
- Wöchentlicher Report mit Trends
