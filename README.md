# Tierpolitik Vorstoesse DB (Vite + React + TypeScript)

Statischer Prototyp einer Notion-artigen Datenbank fuer politische Tierpolitik-Vorstoesse.

## Tech

- Vite + React + TypeScript
- Einfache CSS
- TanStack Table
- zod (Schema + Startvalidierung)

## Projektstruktur

- `data/vorstoesse.json`
- `src/types.ts`
- `src/components` (Table, Filters, DetailDrawer, Export)
- `src/utils` (filtering, csv, urlHash)
- `src/main.tsx`, `src/App.tsx`
- `.github/workflows/deploy.yml`

## Lokal starten

```bash
npm ci
npm run dev
```

Build testen:

```bash
npm run build
```

## JSON erweitern (Pflicht)

Datei: `data/vorstoesse.json`

### Pflichtfelder je Eintrag

- `id` (Format: `vp-...`, eindeutig)
- `titel`
- `kurzbeschreibung`
- `geschaeftsnummer`
- `ebene` (`Bund | Kanton | Gemeinde`)
- `kanton` (`string | null`)
- `regionGemeinde` (`string | null`)
- `status` (`Eingereicht | In Beratung | Angenommen | Abgelehnt | Abgeschrieben`)
- `datumEingereicht` (ISO `YYYY-MM-DD`)
- `datumAktualisiert` (ISO `YYYY-MM-DD`)
- `themen` (Array)
- `schlagwoerter` (Array)
- `einreichende` (Array von Objekten `{name, rolle, partei}`)
- `linkGeschaeft` (URL)
- `resultate` (Array von `{datum, status, bemerkung}`)
- `medien` (Array von `{datum, titel, quelle, url}`)
- `metadaten` (`{sprache: de|fr|it, zuletztGeprueftVon}`)

### ID-Vergabe

- Stabil und eindeutig, z. B. `vp-2026-21`
- Keine Wiederverwendung bestehender IDs

### Schemafehler + Fix

- Bei falschem Enum, Datum oder fehlendem Pflichtfeld bricht die Startvalidierung (zod) mit Fehler ab.
- Fix: Feld korrigieren, App neu laden.

## Features

- Tabellenansicht mit Sortierung pro Spaltenklick
- Globale Suche ueber Titel/Kurzbeschreibung/Geschaeftsnummer/Personen/Schlagwoerter/Themen
- Multi-Filter (Ebene/Status/Kanton/Themen/Schlagwoerter + Zeitraum)
- Quick-Filter Chips (Nur Kantonal, In Beratung, Letzte 90 Tage)
- Spalten ein-/ausblenden
- Pagination 10/25/50
- Trefferanzahl + aktive Filter + Reset
- Detail-Drawer (Zeilenklick) mit allen Feldern und Timeline (Resultate + Medien chronologisch)
- Link kopieren (`#id` Permalink) + Geschaeft oeffnen
- Hash-Routing: bei `#id` wird passender Eintrag direkt geoeffnet
- Export: CSV (sichtbare Spalten oder alle), optional JSON (gefiltert)
- Responsiv mit horizontalem Tabellen-Scroll

## GitHub Pages Setup (Variante 1, via Actions)

1. Neues GitHub-Repo erstellen.
2. Projekt auf Branch `main` pushen.
3. In GitHub: **Settings -> Pages -> Build and deployment**.
4. **Source = GitHub Actions** setzen.
5. Workflow `Deploy to GitHub Pages` laeuft bei Push auf `main`.
6. URL nach Deploy im Actions-Run (Job `deploy`) oder in Settings -> Pages.

## Stolperfallen

- **Base Path**: Fuer Pages muss Vite `base` korrekt setzen (hier via `GITHUB_REPOSITORY`, Fallback `'/tierpolitik-vorstoesse-db/'`).
- **404 bei Refresh**: Ohne Hash-Routing kann ein direkter Deep-Link auf statischen Hosts 404 geben. Dieser Prototyp nutzt `#id`-Links fuer Details.

## Kurze Ausbauschritte

- API statt JSON (Backend + Persistenz)
- Admin-UI/CMS fuer Pflege
- Auth/Rollen fuer Redaktion
- Import aus Google Sheets
- Volltextsuche (z. B. MiniSearch/Meilisearch)
