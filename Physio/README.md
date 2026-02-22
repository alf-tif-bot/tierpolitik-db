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

# Optional weglassen: kein Zeitbudget nötig
```

## Tagesplan-Logik (Regelbasiert)
- Arbeite pro Problemzone in Blöcken bis die Bewegungsqualität klar besser ist.
- Priorität: Technik/Position > Intensität > Volumen.
- Beende die Session, wenn Qualität sinkt oder Symptome deutlich hochgehen.

### Steuerung
- Ziel-Reiz: "fordernd, aber sauber" (RPE 4-6/10)
- Bei Schmerzanstieg >2 Punkte oder Verschlechterung >24h: Volumen runter / Regression
- Position/Qualität vor Intensität

## Nächster Ausbau
- Automatisierte tägliche Polls per Cron
- Auto-Erzeugung des Tagesplans aus Poll-Antworten
- Wöchentlicher Report mit Trends
