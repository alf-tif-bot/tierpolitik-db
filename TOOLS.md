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

- Für TIF-Artikel und **Vorstösse** immer den **WPBakery Page Builder** verwenden (nicht nur ACF-Kurzbeschreibung ausfüllen).
- Auch Textblöcke, Absätze und weitere Elemente konsequent im offiziellen WPBakery-Block aufbauen.
- Nach Upload immer prüfen, dass der Body-Text in der Vorschau sichtbar ist (nicht nur Teaser + Kommentare).

## TIF Medien-Workflow (Google Alerts)

## TIF Visual-Style (MM Vorschaubilder)

- Ziel-Format: **680 x 383 px**, Dateityp **JPG**
- Stilpräferenz:
  - bevorzugt **pencil sketch / illustrativ** (dezent, nicht offensichtlich KI)
  - alternativ **symbolisches Foto/Visual** in sachlichem Stil
- TIF-Styleguide lokal vorhanden: `PARA/Resources/TIF/Branding/TIF-Styleguide-v1-Jessica-Ladanie.pdf`
- Verbindliche TIF-Farbpalette (aus Styleguide):
  - `#26282A` (dunkel)
  - `#98AE9A` (grün-grau)
  - `#C05C4F` (korall)
  - `#E3E3DD` (hell warmgrau)
  - `#FAFAFF` (off-white)
- Bei neuen MM-Bildern diese HEX-Werte aktiv im Prompt nennen.
- Varianten/Bildresultate immer **im Chat posten** (nicht nur lokale Dateipfade), da Tobi nicht auf dem Mac mini arbeitet.
- Abkürzung: **some = social media**.


- Alert-Postfach: `alf.tif.bot@gmail.com`
- Aufgabe: Eingehende Google Alerts zu TIF prüfen und relevante Treffer unter `https://tierimfokus.ch/in-den-medien/` als **Medienartikel** erfassen.
- Danach Beleglink an Tobi senden.
- TIF-WordPress-Zugang liegt in `secrets/wp-tif.env`.

## Politik-Vorstösse (Bern) – Duplikate vermeiden

- Referenz bestehender Vorstösse von Tobi:
  - `https://stadtrat.bern.ch/de/mitglieder/detail.php?gid=a5324a6fdd314d9b9384cdead9708ea2`
- Referenz veröffentlichte TIF-Vorstösse:
  - `https://tierimfokus.ch/vorstoesse/`
- Wöchentlicher Soll-Prozess:
  - Parlamentsseite vs. TIF-Vorstoss-Seite abgleichen (neue, auf TIF noch fehlende Vorstösse)
  - Neue Kandidaten in Discord posten zur Review durch Tobi
  - Tobi markiert Vorstösse mit 👍, wenn Tierbezug vorhanden
  - Bei 👍: Entwurfstext + Bild (Stil: pencil sketch) erstellen
  - Danach auf TIF-Website veröffentlichen
- Bei neuen Vorschlägen immer gegen diese Liste prüfen.
- Keine identischen oder sehr ähnlichen Vorschläge erneut bringen; stattdessen klar differenzieren (anderer Hebel, Ebene, Instrument oder Zielgruppe).

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.
