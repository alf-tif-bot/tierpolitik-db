# Tierpolitik Vorstösse DB

Vite/React-App plus Crawler-Workflow für eine nightly gepflegte Tierpolitik-Quellenliste.

## Crawler-Workflow (nightly)

Die Pipeline arbeitet **real-source-first**:
- Primär: Parlament OData API (`ws.parlament.ch`)
- Zusätzlich: BLV/Bundesrat RSS (wenn erreichbar)
- Fixtures werden **nicht** automatisch verwendet. Optional nur mit:

```bash
CRAWLER_ENABLE_FIXTURE_FALLBACK=1 npm run crawler:collect
```

## Ein-Kommando-Pipeline

```bash
npm run crawler:pipeline
```

Reihenfolge:
1. collect
2. score
3. review-page build
4. user-input ingest
5. review decisions ingest (`data/review-decisions.json`, optional)
6. published export
7. crawler page build

## Review-Entscheidungen (actionable)

- `public/review.html` zeigt **queued + rejected** Items.
- Dort Entscheidungen lokal treffen und als `review-decisions.json` exportieren.
- Datei nach `data/review-decisions.json` legen.
- Dann:

```bash
npm run crawler:apply-review
npm run crawler:export
```

Wirkung:
- `approved` → in `data/crawler-published.json`
- `rejected` → ausgeschlossen
- `queued` → bleibt im Review sichtbar

## Seiten

- `/crawler.html` (Quelle, Publikationsdatum, Titel, Kurzsummary, Originallink)
- `/review.html`

Beide werden immer aus derselben `data/crawler-db.json` erzeugt und sind gegenseitig verlinkt.

## PostgreSQL (additiver Migrationspfad)

Die bestehende JSON-Pipeline bleibt unverändert funktionsfähig. Die DB-Integration ist bewusst **additiv**:

- JSON bleibt zunächst "Source of Truth".
- DB wird parallel gespiegelt (Mirror), um risikoarm zu migrieren.
- Netlify/Site-Flow bleibt auf `data/crawler-db.json` und `data/crawler-published.json`.

### Setup

```bash
cp .env.db.example .env.db
# DATABASE_URL in .env.db anpassen
npm install
npm run db:init-schema
```

### JSON -> DB Migration

```bash
npm run db:migrate-json
```

Importiert:
- `data/crawler-db.json` -> `sources`, `motions`, `motion_versions`, `reviews`
- `data/user-input.json` -> `submissions`

### Optional: DB -> JSON Sync (Kompatibilität)

```bash
npm run db:sync-json
```

Erzeugt/aktualisiert `data/crawler-db.json` aus PostgreSQL, damit bestehende Build-/Export-Skripte weiterlaufen.

### Phasenplan (pragmatisch)

**Phase A: JSON primär + DB Mirror (jetzt)**
1. Nightly weiter mit `npm run crawler:pipeline`
2. Danach `npm run db:migrate-json` als Spiegel-Schritt
3. Optional `npm run db:sync-json` für Konsistenzchecks

**Phase B: DB primär + JSON Export für Site (später)**
1. Crawler schreibt direkt in PostgreSQL
2. `npm run db:sync-json` erzeugt JSON-Artefakte für bestehende Site/Netlify
3. Schrittweise Umstellung der Read-Paths auf DB-Helper

## Cron / unattended run

Linux crontab-Beispiel (täglich 02:30):

```bash
30 2 * * * cd /path/to/tierpolitik-vorstoesse-db && /usr/bin/npm run crawler:pipeline >> /var/log/tierpolitik-crawler.log 2>&1
```

Windows Aufgabenplanung (Aktion):

```powershell
powershell -NoProfile -Command "cd C:\path\to\tierpolitik-vorstoesse-db; npm run crawler:pipeline *>> .\logs\crawler-nightly.log"
```

## Source-Status-Hinweis

Einzelne Regierungs-RSS-Feeds liefern zeitweise 404/leer (Upstream-Verhalten). Die Pipeline bleibt robust: Quelle wird übersprungen, Lauf läuft weiter, Status steht in der Collect-Ausgabe.
