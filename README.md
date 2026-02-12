# tierpolitik-vorstoesse-db

Vollstaendiger Prototyp fuer eine durchsuchbare Datenbank zu tierpolitischen Vorstoessen in der Schweiz.

## Tech Stack

- Vite + React + TypeScript
- TanStack Table (Sortierung, Pagination, Spaltensteuerung)
- zod (Schema-Validierung fuer Daten)

## Setup

```bash
npm ci
npm run dev
```

Build pruefen:

```bash
npm run build
npm run preview
```

## Datenablage

Die Daten liegen in:

- `public/data/vorstoesse.json` (wird von der App geladen)
- `data/vorstoesse.json` (gleicher Inhalt als Repo-Datenquelle)

Die App laedt `BASE_URL + data/vorstoesse.json` und validiert mit zod beim Start.

## Datenpflege

### Pflichtfelder

Alle Felder des Schemas sind verpflichtend, ausser `parteien` (optional). Felder mit `null` muessen vorhanden sein und explizit `null` enthalten, falls kein Wert bekannt ist.

### ID-Vergabe

Empfehlung: stabile, sprechende IDs wie:

- `ch-kt-zh-2026-001`
- `ch-kom-bern-2025-014`

Wichtig:

- IDs duerfen nicht doppelt vorkommen
- IDs sollten sich nach Publikation nicht mehr aendern (Permalinks mit `#id`)

### Schemafehler erkennen

Beim Laden validiert die App die JSON-Datei via zod. Bei Fehlern erscheint eine Fehlermeldung in der UI.
Typische Fehler:

- Ungueltige URL (`link_geschaeft`, Dokument- oder Medienlinks)
- Ungueltige ISO-Datumsstrings
- Fehlende Pflichtfelder
- Falsche Enum-Werte (z. B. Status)

## Funktionen im Prototyp

1. **Tabellenansicht**
   - Spalten: Titel, Ebene, Kanton, Region/Gemeinde, Status, Datum eingereicht, Schlagwoerter, Einreichende, Link
   - Sortierung
   - Globale Suche
   - Filter: Ebene, Status, Kanton, Themen, Schlagwoerter, Zeitraum von/bis
   - Quick Chips: Nur Kantonal, In Beratung, Letzte 90 Tage
   - Spalten ein/ausblenden
   - Pagination 10/25/50
   - Trefferanzahl, aktive Filter, Reset

2. **Detailansicht (Drawer/Modal)**
   - Anzeige aller Felder
   - Chronologische Timeline aus Resultaten und Medien
   - Buttons: Link kopieren (Permalink `#id`), Geschaeft oeffnen
   - Direkter Aufruf via URL-Hash (`#id`)

3. **Export**
   - CSV Export gefilterte Daten (sichtbare Spalten oder alle)
   - JSON Export gefilterte Daten

4. **Mobile**
   - Responsive Layout
   - Horizontales Scrollen fuer Tabelle
   - Filter auf kleinen Screens nutzbar

## GitHub Pages Deployment (Step-by-step)

1. Repo nach GitHub pushen (Branch `main`)
2. In GitHub: **Settings -> Pages**
3. Source auf **GitHub Actions** setzen
4. Push auf `main` startet `.github/workflows/deploy.yml`
5. Nach erfolgreichem Run ist die Seite unter der Pages-URL erreichbar

Workflow nutzt:

- `actions/configure-pages`
- `actions/upload-pages-artifact`
- `actions/deploy-pages`

## Base Path und GH Pages

`vite.config.ts` setzt `base` automatisch:

- In GitHub Actions mit `GITHUB_REPOSITORY`: `/<repo-name>/`
- Lokal/default: `/`

Damit funktionieren Assets sowohl lokal als auch auf GitHub Pages.

## Stolperfallen

1. **Falscher Base Path**
   - Symptom: leere Seite, fehlende JS/CSS Assets
   - Loesung: `vite.config.ts` mit dynamischem `base` wie im Projekt

2. **404 bei Browser-Refresh auf Unterpfaden**
   - Da der Prototyp Hash-Links (`#id`) nutzt, entstehen keine echten Client-Routen.
   - Direkte Aufrufe mit `#id` funktionieren auf GitHub Pages ohne extra Router-Fallback.

3. **Ungueltige Daten**
   - zod-Validierung stoppt das Laden bei Schemafehlern.

## Ausbauideen

- API-Anbindung statt statischer JSON-Datei
- Admin-UI oder CMS fuer Datenpflege
- Authentifizierung und Rollen (Redaktion, Review, Public)
- Import-Pipeline aus Google Sheets/CSV
- Volltextsuche (z. B. Meilisearch, OpenSearch)
