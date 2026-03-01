# Security Review — 2026-02-28

## Executive Summary
Der Review zeigt **ein akutes Expositionsrisiko im Cockpit**: Die App lauscht auf `0.0.0.0` und mehrere API-Routen erlauben ohne erkennbare Authentisierung das Ausführen privilegierter OpenClaw-/Shell-Aktionen sowie Datei-Lese/Schreibzugriff im Workspace. In Kombination ergibt das eine realistische Angriffskette bis hin zu Remote-Kontrollübernahme des Agent-Hosts. 

Zusätzlich sind in den Netlify-Funktionen schreibende Endpunkte ohne echte Authentisierung umgesetzt (CORS ist kein Auth-Mechanismus), und die Postgres-SSL-Konfiguration akzeptiert unsignierte Zertifikate (`rejectUnauthorized: false`), was MITM-Risiken erhöht.

**Gesamtrisiko:** hoch bis kritisch, primär wegen möglicher Remote-Execution + Datenabfluss.

---

## Findings

### 1) [CRITICAL] Unauthentisierte Remote-Kontrolle (RCE-Pfad) über Cockpit-APIs
**Lens:** Offensive + Defensive + Operational realism

**Was passiert:**
- Cockpit wird auf allen Interfaces gestartet (`--hostname 0.0.0.0`).
- API-Route `agents/control` erlaubt per `action` das Ausführen von OpenClaw-Kommandos und sogar Shell-Befehlsketten (`/bin/bash -lc ... rm -rf .next && npm run build ...`).
- `cron/run` triggert Job-Ausführung per API.
- In den gezeigten Routen ist keine Authentisierungs-/Autorisierungsprüfung sichtbar.

**Warum ausnutzbar:**
Ein Angreifer mit Netzwerkzugriff auf Port 3001 kann direkt POST-Requests senden und operative Aktionen auslösen (Gateway restart, self-heal, Cron-Runs). Das ist ein realistischer Kontrollübernahme-Pfad.

**Evidence:**
- `scripts/cockpit-server.sh#L37` (Bind auf `0.0.0.0`)
- `cockpit/app/api/agents/control/route.ts#L41-L49` (Shell-Ausführung)
- `cockpit/app/api/agents/control/route.ts#L52-L84` (aktionsbasierte Steuerung ohne Auth-Check)
- `cockpit/app/api/cron/run/route.ts#L20-L37` (Cron-Run via API)

**Recommendation IDs:**
- **R1:** Sofort Netzwerk-Exposition reduzieren (nur `127.0.0.1`/Tailscale/VPN-Only, Reverse Proxy mit Auth).
- **R2:** Zwingende AuthN/AuthZ pro API-Route (mind. signed token + rollenbasierte Allowlist pro Action).
- **R3:** Entferne/segmentiere Shell-kritische Actions (`cockpit-self-heal`) hinter separatem admin-only channel.

---

### 2) [HIGH] Unauthentisierter Datei-Lese/Schreibzugriff im Workspace (Datenabfluss + Manipulation)
**Lens:** Offensive + Data privacy + Defensive

**Was passiert:**
- `files/read` liest beliebige erlaubte Textdateien im Workspace.
- `files/write` überschreibt erlaubte Dateien im Workspace.
- `files/index` indiziert gezielt auch sensible Bereiche (`memory`, `Physio`, Monitor-Daten).
- Keine sichtbare Authentisierung in den gezeigten Routen.

**Warum ausnutzbar:**
Bei Erreichbarkeit der App sind Exfiltration (z. B. persönliche Notizen/Health-Inhalte) und gezielte Manipulation (Skripte, Konfig-Dateien, Pipeline-Inputs) möglich.

**Evidence:**
- `cockpit/app/api/files/read/route.ts#L26-L33` und `#L94-L101` (Dateiinhalt wird zurückgegeben)
- `cockpit/app/api/files/write/route.ts#L54-L83` (Dateiinhalt wird überschrieben)
- `cockpit/app/api/files/index/route.ts#L63-L69` (Index umfasst `memory`, `Physio`, `tierpolitik-vorstoesse-db`)

**Recommendation IDs:**
- **R4:** `files/*` nur für authentisierte Admin-Session freischalten; standardmäßig deaktivieren.
- **R5:** Zusätzliche Pfad-Allowlist auf minimal nötige Verzeichnisse (deny-by-default).
- **R6:** Audit-Logging für Datei-Reads/Writes (wer, wann, welcher Pfad, diff/hash).

---

### 3) [HIGH] Schreibende Netlify-Endpunkte ohne echte Authentisierung (CORS-Fehlannahme)
**Lens:** Offensive + Defensive + Operational realism

**Was passiert:**
- Endpunkte wie `review-decision` und `feedback-submit` ändern DB-Zustände.
- Implementiert ist Origin-basierte CORS-Steuerung; **keine** kryptografische Request-Authentisierung/Signatur.

**Warum ausnutzbar:**
CORS schützt Browser-Kontext, nicht Server-zu-Server/cURL. Ein Angreifer kann Endpunkte direkt aufrufen und Daten/Review-Status manipulieren.

**Evidence:**
- `agents/coding/repo/netlify/functions/review-decision.mjs#L10-L16` (CORS-Header)
- `agents/coding/repo/netlify/functions/review-decision.mjs#L46-L56` (Input-Validierung, aber kein Auth-Check)
- `agents/coding/repo/netlify/functions/feedback-submit.mjs#L8-L14` (CORS-only)
- `agents/coding/repo/netlify/functions/feedback-submit.mjs#L58-L126` (DB-Änderungen)

**Recommendation IDs:**
- **R7:** HMAC/JWT-verifizierte Service-Auth pro mutierendem Endpoint (shared secret/rotating key).
- **R8:** Server-side rate limiting + anti-replay (timestamp + nonce).
- **R9:** Trennung read-only vs write API mit getrennten Credentials und minimalen DB-Rollen.

---

### 4) [MEDIUM] TLS-Vertrauen für Postgres geschwächt (`rejectUnauthorized: false`)
**Lens:** Data privacy + Defensive

**Was passiert:**
- Bei `PGSSLMODE=require` wird TLS mit deaktivierter Zertifikatsprüfung verwendet.

**Risiko:**
Transport ist verschlüsselt, aber nicht gegen MITM abgesichert; DB-Credentials/Queries können bei Netzangriffen kompromittiert werden.

**Evidence:**
- `agents/coding/repo/crawler/db-postgres.mjs#L41-L44`

**Recommendation IDs:**
- **R10:** Zertifikatsvalidierung aktivieren (CA pinning / managed cert chain), `rejectUnauthorized: true`.
- **R11:** DB-Zugriff auf private Netzpfade beschränken (Security Group / firewall allowlist).

---

### 5) [LOW] Erhöhte Betriebsfragilität durch sehr mächtige „Self-Heal“-Operation
**Lens:** Operational realism

**Was passiert:**
- Eine einzelne API-Action räumt Build-Artefakte weg und triggert Rebuild/Service-Kickstart.

**Risiko:**
Bei Fehlbedienung/Angriff kommt es zu vermeidbaren Downtimes; hoher Blast Radius für eine HTTP-Aktion.

**Evidence:**
- `cockpit/app/api/agents/control/route.ts#L76-L81`

**Recommendation IDs:**
- **R12:** Break-glass-Flow (2-step confirmation + short-lived admin token + maintenance mode).

---

## Top 3 next actions für morgen
1. **R1 + R2 sofort umsetzen:** Cockpit nur intern erreichbar machen und harte AuthN/AuthZ vor alle mutierenden Routen setzen.
2. **R4 + R5 priorisieren:** `files/read|write|index` bis zur Absicherung deaktivieren oder auf enge Allowlist begrenzen.
3. **R7 starten:** Mutierende Netlify-Funktionen auf signierte Requests + Rate-Limit + Audit-Logs umstellen.

---

Für Deep Dive antworte mit: Deep dive R<Nummer>
