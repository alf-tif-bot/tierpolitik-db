# Tierpolitik Vorstösse DB

Vite/React-App plus Crawler-Workflow für eine nightly gepflegte Tierpolitik-Quellenliste.

## Crawler-Workflow (nightly)

### Crawler v2 Foundation (neu)

- `npm run crawler:collect:v2`: affair-zentrierte Bundesdaten (DE/FR/IT zusammengeführt) + kantonales Registry-Scaffold
- `npm run sources:build-cantonal-registry`: erzeugt `data/cantonal-source-registry.json` (alle 26 Kantone, Zielhistorie ab 2020) inkl. URL-Probe (HTTP-Status, Final-URL, Plattform-Hinweis, Readiness)
- `npm run check:review-regressions`: vergleicht DB-Motions vs. `review-items.json` und `vorstoesse.json`, prüft zusätzlich `review-decisions.json` gegen den aktuellen DB-Status, schreibt `data/regression-report.json` und schlägt bei Regressions fehl

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

## Ein-Kommando-Pipeline inkl. DB-Mirror

```bash
npm run crawler:pipeline:db
```

Diese Variante läuft vollständig durch und spiegelt danach automatisch in PostgreSQL (`db:migrate-json`) und zurück nach JSON (`db:sync-json`).

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

### Setup (1st time, minimal)

```bash
cp .env.db.example .env.db
# .env.db: DATABASE_URL setzen (Supabase/Neon, siehe unten)
npm install
npm run db:init-schema
npm run db:migrate-json
npm run db:sync-json
```

**Supabase (ohne App-Login):**
1. Neues Project erstellen
2. In Project Settings → Database die `Connection string (URI)` kopieren
3. SSL aktiv lassen (typisch `sslmode=require`)
4. In `.env.db` als `DATABASE_URL=...` eintragen

**Neon (ohne App-Login):**
1. Neues Project/Branch erstellen
2. Connection string kopieren
3. In `.env.db` als `DATABASE_URL=...` eintragen
4. Falls nötig zusätzlich: `PGSSLMODE=require`

Wenn `npm run db:init-schema` und `npm run db:migrate-json` ohne Fehler laufen, ist die Live-DB-Verbindung bereit.

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

### DB -> Website Artefakte (jetzt direkt nutzbar)

```bash
npm run db:refresh-site
```

Synchronisiert zuerst die neuesten Review/Crawler-Entscheide in die DB und baut danach sofort:
- `data/vorstoesse.json` (Home-Tabelle)
- `public/review.html`
- `data/crawler-published.json`
- `public/crawler.html` (Redirect auf Review)

### Automatische Review->DB Anbindung

- `review.html` sendet Approve/Reject jetzt serverseitig an `/.netlify/functions/review-decision`
- Home lädt Live-Daten aus DB via `/.netlify/functions/home-data` (mit lokalem JSON-Fallback)

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

Einzelne Regierungs-RSS-Feeds liefern zeitweise 404/leer/WAF-Challenge (Upstream-Verhalten). Die Pipeline bleibt robust:
- mehrere URL-Kandidaten pro Feed werden nacheinander probiert
- bei BLV/Bundesrat wird bei Fehler/leer automatisch auf lokale Fixture als Ersatzquelle gewechselt
- Lauf bricht nicht ab; Status steht in der Collect-Ausgabe.
