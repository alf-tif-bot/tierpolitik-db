# Security Review (Nightly) — 2026-02-25

## Executive Summary
- **Gesamtlage:** Weiterhin **akut kritisch**. Es existieren mehrere unauthentisierte Schreib-/Control-Pfade mit hohem Impact.
- **Offensiv:** Ein Angreifer kann bei Netz-Erreichbarkeit des Cockpit-Servers privilegierte Aktionen triggern (Gateway-Restart, Self-Heal mit Shell), Daten lesen/schreiben und Review-Datenbankzustand manipulieren.
- **Defensiv:** Input-Validation/CORS vorhanden, aber als Primärkontrolle ungeeignet. Es fehlen zentrale AuthN/AuthZ, Rate Limits, Signaturprüfungen und belastbare Audit-Detektion.
- **Datenschutz:** Potenzieller Zugriff auf interne Workspace-Inhalte über Read-APIs; DB-Transportschutz ist abgeschwächt (`rejectUnauthorized:false`).
- **Operational Realism:** Aktuelle Controls sind teils „security theater“ (CORS ohne echte Identität). Unter realen Bedingungen (LAN/Reverse-Proxy/Port-Forward) ist Missbrauch wahrscheinlich.

---

## Findings

### 1) [CRITICAL] Unauthentisierte Control-API erlaubt High-Privilege Aktionen inkl. Shell-Ausführung
**Lens:** Offensive, Defensive, Operational realism

**Was passiert:** `POST /api/agents/control` akzeptiert Aktionen ohne AuthN/AuthZ. Darunter `gateway-restart` und `cockpit-self-heal`; letzteres führt Shell-Befehl mit Build + `launchctl kickstart` aus.

**Angriffspfad:** Netz-Zugriff auf Cockpit → POST mit `{"action":"cockpit-self-heal"}` oder `gateway-restart` → Betriebsunterbrechung / erzwungene Build-Runs / Kontrollverlust über Verfügbarkeit.

**Evidenz:**
- `cockpit/app/api/agents/control/route.ts:52-82` (POST ohne Auth-Check, Action-Dispatch)
- `cockpit/app/api/agents/control/route.ts:41-47` (Shell-Execution Helper)
- `cockpit/app/api/agents/control/route.ts:76-80` (Self-heal Shell-Command)

**Empfehlungen:**
- **R1:** Endpoint sofort hinter verpflichtende AuthN/AuthZ (z. B. signed session + role `admin`) stellen.
- **R2:** `cockpit-self-heal` temporär deaktivieren oder nur lokal via unix socket/localhost-admin tunnel erlauben.
- **R3:** Für Control-Aktionen HMAC-signed requests + Replay-Schutz + Audit-Events einführen.

---

### 2) [CRITICAL] Cockpit-Server bindet auf 0.0.0.0; kombiniert mit offenen APIs entsteht Remote-Angriffsfläche
**Lens:** Offensive, Defensive, Operational realism

**Was passiert:** Next.js wird explizit auf allen Interfaces gestartet.

**Angriffspfad:** Exponierter Host/LAN-Zugriff + fehlende API-Auth → direkte Remote-Nutzung der mutierenden API-Routen.

**Evidenz:**
- `scripts/cockpit-server.sh:37` (`next start --hostname 0.0.0.0 --port 3001`)

**Empfehlungen:**
- **R4:** Standard auf `127.0.0.1` umstellen; externen Zugriff nur über authentifizierten Reverse Proxy.
- **R5:** Netzwerkseitig deny-by-default (Firewall, kein offener 3001-Port nach außen/LAN wenn nicht nötig).

---

### 3) [HIGH] Unauthentisierte Workspace-Read/Write APIs ermöglichen Datenabfluss und Integritätsangriffe
**Lens:** Offensive, Data privacy, Defensive

**Was passiert:** File-Read/Write Endpoints haben Pfad-/Typvalidierung, aber keine Identitätsprüfung.

**Angriffspfad:** Angreifer liest interne `.md/.json/.ts/...` Inhalte und überschreibt erlaubte Textdateien im Workspace (z. B. Skripte, Konfigs, Inhalte) → Datenabfluss + Persistenz/Manipulation.

**Evidenz:**
- `cockpit/app/api/files/read/route.ts:26-132` (Dateilesen ohne Auth)
- `cockpit/app/api/files/write/route.ts:54-118` (Dateischreiben ohne Auth)
- `cockpit/app/api/files/write/route.ts:21-24` (erlaubt u. a. `.sh/.ts/.js/.json/.md`)

**Empfehlungen:**
- **R6:** File-APIs nur für authentisierte Admin-Session freigeben; default deny.
- **R7:** Schreibpfade auf explizite Allowlist reduzieren (z. B. nur definierte Datenordner, keine Skripte/Code-Dateien).
- **R8:** Immutable/append-only Logging für Schreiboperationen + Alerting bei sensitiven Pfaden.

---

### 4) [HIGH] Netlify-Write-Endpunkte vertrauen auf CORS, aber haben keine echte Request-Authentisierung
**Lens:** Offensive, Defensive, Operational realism

**Was passiert:** `review-decision`, `review-fastlane-tag`, `feedback-submit` prüfen HTTP-Methode und teilweise Body-Form, aber keine Signatur/API-Keys/JWT.

**Angriffspfad:** Direkte serverseitige Requests (nicht Browser-CORS-gebunden) können Review-Status, Submission-Flags und Inhaltsversionen manipulieren.

**Evidenz:**
- `projects/tierpolitik-db/netlify/functions/review-decision.mjs:36-56, 138-152`
- `projects/tierpolitik-db/netlify/functions/review-fastlane-tag.mjs:16-33, 37-54`
- `projects/tierpolitik-db/netlify/functions/feedback-submit.mjs:30-49, 58-126`
- CORS-only Muster: jeweilige `corsHeaders(...)` Blöcke (`access-control-allow-*`)

**Empfehlungen:**
- **R9:** Service-to-service Auth (HMAC signature/JWT audience-bound) verpflichtend für alle mutierenden Netlify Functions.
- **R10:** Per-function Rate Limits + Abuse Detection + optional CAPTCHA nur für echte Public-Feedback-Pfade.

---

### 5) [HIGH] TLS-Serverauth für Postgres explizit abgeschwächt (`rejectUnauthorized:false`)
**Lens:** Data privacy, Defensive

**Was passiert:** Bei `PGSSLMODE=require` wird Zertifikatsprüfung deaktiviert.

**Risiko:** MITM in unsicheren Netzwerksegmenten möglich; Vertraulichkeit/Integrität der DB-Verbindung nicht robust abgesichert.

**Evidenz:**
- `projects/tierpolitik-db/crawler/db-postgres.mjs:41-44`

**Empfehlungen:**
- **R11:** `rejectUnauthorized:true` erzwingen.
- **R12:** Vertrauenswürdige CA-Chain/Pinning im Deployment hinterlegen und Verbindungsfehler sichtbar alarmieren.

---

### 6) [MEDIUM] Breite ungeschützte Mutationsfläche im Cockpit (Tasks/Entities/Links/Radar etc.)
**Lens:** Offensive, Operational realism

**Was passiert:** Mehrere mutierende Routen ohne AuthN/AuthZ; zwar Input-Validation vorhanden, aber keine Zugriffskontrolle.

**Risiko:** Datenintegrität des operativen Cockpits manipulierbar (Task-Board, Entities, Links, Radar), inklusive stiller Betriebsstörung.

**Evidenz (Beispiele):**
- `cockpit/app/api/tasks/route.ts:76-141`
- `cockpit/app/api/entities/route.ts:33-75`
- `cockpit/app/api/links/route.ts:64-111`

**Empfehlungen:**
- **R13:** Globales API-Auth-Middleware-Konzept für `app/api/**` einführen.
- **R14:** Rollenmodell (`read`, `write`, `admin`) pro Route erzwingen; „default deny“.

---

## Top 3 next actions for tomorrow
1. **R1 + R4 sofort umsetzen (Blocker):** Cockpit nur localhost binden + Auth-Gate vor alle `/api/**` Routen, beginnend mit `/api/agents/control` und File-APIs.  
2. **R9 umsetzen:** Netlify mutierende Functions auf signierte Requests umstellen (shared secret/HMAC, kurzer timestamp, nonce).  
3. **R11 umsetzen:** Postgres TLS-Härtung (`rejectUnauthorized:true`) mit sauberem CA-Setup testen und deployen.

---

**Hinweis (CRITICAL vorhanden):** Ein **separater kurzer Telegram-Alarm** ist erforderlich (empfohlen an Security Council/On-Call Kanal) mit den Sofortmaßnahmen: Endpoint-Isolation, Auth-Hardening, Port-Exposure schließen.  
**Empfohlener Alert-Text:** „CRITICAL: Cockpit-Control/API aktuell ohne Auth erreichbar; potenziell Remote-Steuerung + Dateizugriff. Sofort: Port 3001 isolieren/localhost-only, `/api/agents/control` + File-APIs blocken, dann AuthN/AuthZ patchen.“

Für Deep Dive antworte mit: Deep dive R<Nummer>
