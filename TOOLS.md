# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## WordPress (TIF)

- Für TIF-Artikel immer den **WPBakery Page Builder** verwenden (nicht nur ACF-Kurzbeschreibung ausfüllen).
- Nach Upload immer prüfen, dass der Body-Text in der Vorschau sichtbar ist (nicht nur Teaser + Kommentare).

## TIF Medien-Workflow (Google Alerts)

- Alert-Postfach: `alf.tif.bot@gmail.com`
- Aufgabe: Eingehende Google Alerts zu TIF prüfen und relevante Treffer unter `https://tierimfokus.ch/in-den-medien/` als **Medienartikel** erfassen.
- Danach Beleglink an Tobi senden.
- TIF-WordPress-Zugang liegt in `secrets/wp-tif.env`.

## Politik-Vorstösse (Bern) – Duplikate vermeiden

- Referenz bestehender Vorstösse von Tobi:
  - `https://stadtrat.bern.ch/de/mitglieder/detail.php?gid=a5324a6fdd314d9b9384cdead9708ea2`
- Bei neuen Vorschlägen immer gegen diese Liste prüfen.
- Keine identischen oder sehr ähnlichen Vorschläge erneut bringen; stattdessen klar differenzieren (anderer Hebel, Ebene, Instrument oder Zielgruppe).

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.
