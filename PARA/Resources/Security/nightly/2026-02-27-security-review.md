# Nightly Security Review — 2026-02-27

## Executive Summary
Die Review zeigt mehrere **direkt ausnutzbare Angriffsflächen** mit hohem Realitätsgrad:
- **[CRITICAL] Unauthentisierte Remote-Control-API** im Cockpit erlaubt potenziell Gateway-Restart, Heartbeat-Steuerung und Build/Service-Kickstart ohne Identitätsprüfung.
- **[CRITICAL] Klartext-Secrets im Workspace** (u. a. produktiver Todoist-Token und DB-Credentials) mit unmittelbarem Missbrauchsrisiko bei Read-Zugriff.
- **[HIGH] Mutierende Netlify-Endpoints vertrauen auf CORS statt AuthN/AuthZ**; direkte Server-zu-Server Requests können Daten/Review-Status manipulieren.
- **[HIGH] Dateilesen/-schreiben APIs ohne Auth** ermöglichen Datenabfluss und Integritätsverletzung im Workspace.

Defensiv sind Input-Validierungen vorhanden, aber sie ersetzen nicht Authentisierung, Autorisierung, Signaturprüfung, Rate-Limits und Auditierbarkeit.

---

## Findings

### 1) [CRITICAL] Cockpit-Control-API erlaubt privilegierte Aktionen ohne AuthN/AuthZ
**Lens (Offensive):** Angreifer mit Netz-Zugriff auf Cockpit können `POST /api/agents/control` absetzen und Aktionen wie `gateway-restart` oder `cockpit-self-heal` triggern (inkl. Shell-Kommando mit `rm -rf .next`, Build, Service-Kickstart).

**Lens (Defensive):** Es fehlt eine serverseitige Identitäts- und Rollenprüfung (kein Token/JWT/Session-Gate im Handler).

**Lens (Data Privacy):** Durch Control über Dienstzustand kann indirekt Zugriffspfad auf weitere Daten/Jobs manipuliert werden; Logs enthalten stdout/stderr-Outputs.

**Lens (Operational Realism):** Sehr realistisch, weil der Server explizit auf `0.0.0.0:3001` startet und damit LAN-exponiert ist.

**Empfehlungen:**
- **R1:** `/api/agents/control` sofort hinter verpflichtende AuthN/AuthZ (Bearer/JWT + Rollen + optional mTLS/VPN) legen.
- **R2:** Aktion-Allowlist pro Rolle + zweite Freigabe für destructive ops (`gateway-restart`, `cockpit-self-heal`).
- **R3:** Cockpit auf `127.0.0.1` binden oder per Reverse-Proxy/IP-Allowlist strikt segmentieren.

**Evidenz:**
- `cockpit/app/api/agents/control/route.ts#L52-L82`
- `scripts/cockpit-server.sh#L32`

---

### 2) [CRITICAL] Klartext-Secrets im Workspace (Token + DB-Credentials)
**Lens (Offensive):** Jeder Prozess/Nutzer mit Dateilese-Recht kann Tokens/Credentials sofort übernehmen und externe Dienste missbrauchen.

**Lens (Defensive):** Es gibt keine erkennbaren Schutzmechanismen wie Secret Manager, Scope-Trennung, Rotation-Enforcement oder Zugriffspfade mit Least Privilege.

**Lens (Data Privacy):** Direkte Gefahr für Datenabfluss über Dritt-APIs/DB; potenziell PII-Betroffenheit je nach Datenbestand.

**Lens (Operational Realism):** Hoch realistisch bei Backups, Log-Uploads, Agent-Workflows oder kompromittierter Dev-Umgebung.

**Empfehlungen:**
- **R4:** Betroffene Secrets sofort rotieren/revoken (Todoist, Neon DB).
- **R5:** Secrets aus Workspace entfernen; nur via Secret Store/OS Keychain/CI Secret Context injizieren.
- **R6:** Pre-commit + CI Secret Scanning + denylist auf `.env*` mit echten Werten.

**Evidenz:**
- `secrets/todoist.env#L1`
- `tierpolitik-vorstoesse-db/.env.db#L3`

---

### 3) [HIGH] Netlify Mutations-Endpoints ohne echte Request-Authentisierung (CORS-only)
**Lens (Offensive):** Endpoints für Review-Status, Fastlane-Tagging und Feedback können durch direkte HTTP-Requests manipuliert werden; CORS blockiert nur Browser-Origin, nicht Server/Bot-Aufrufe.

**Lens (Defensive):** Kein HMAC/JWT/API-Key-Check trotz mutierender DB-Queries.

**Lens (Data Privacy):** Integrität der Review-Daten gefährdet; potenziell falsche Klassifikation/Workflow-Steuerung mit Folgewirkung auf Veröffentlichungen.

**Lens (Operational Realism):** Sehr wahrscheinlich bei bekanntem Endpoint, da Anforderungen minimal sind (`POST` + erwartetes JSON).

**Empfehlungen:**
- **R7:** Verbindliche Signaturprüfung (HMAC mit Timestamp/Nonce) oder kurzlebige JWTs mit Audience/Scope.
- **R8:** Rate-Limits + Replay-Schutz + Audit-Log pro mutation request (actor, reason, correlation-id).

**Evidenz:**
- `projects/tierpolitik-db/netlify/functions/review-decision.mjs#L10-L16`, `#L36-L56`
- `projects/tierpolitik-db/netlify/functions/review-fastlane-tag.mjs#L8-L14`, `#L16-L33`
- `projects/tierpolitik-db/netlify/functions/feedback-submit.mjs#L8-L14`, `#L30-L49`

---

### 4) [HIGH] Unauthentisierte Datei-APIs ermöglichen Workspace-Datenabfluss und Manipulation
**Lens (Offensive):** `/api/files/read` und `/api/files/write` erlauben Lesen/Schreiben vieler Textdateien im Workspace ohne Auth; ein Angreifer kann Inhalte exfiltrieren oder ändern.

**Lens (Defensive):** Pfadvalidierung ist gut, aber ohne Identitätsprüfung bleibt es ein „anyone on reachable network can use it“-Problem.

**Lens (Data Privacy):** Zugriff auf interne Notizen, Konfigs, potenziell sensitive Operativdaten.

**Lens (Operational Realism):** Realistisch im LAN/Proxy-Exposure-Szenario; besonders kritisch in Kombination mit Finding #1.

**Empfehlungen:**
- **R9:** Pflicht-Auth + rollenbasierte Pfad-Policies (read/write getrennt, deny-by-default).
- **R10:** Schreib-Operationen mit diff-preview + immutable audit trail + optional approval step absichern.

**Evidenz:**
- `cockpit/app/api/files/read/route.ts#L26-L103`
- `cockpit/app/api/files/write/route.ts#L54-L88`

---

### 5) [MEDIUM] Sicherheitskontrollen teils „Security Theater“ (Validation/CORS ohne Identität)
**Lens (Offensive):** Saubere Input-Validation verhindert nicht den unbefugten Aufruf legitimer mutierender Operationen.

**Lens (Defensive):** Kontrollen sind punktuell (Format/Pfad), aber zentrale Controls (AuthN/AuthZ, Monitoring, Anomalie-Detection) fehlen oder sind nicht sichtbar.

**Lens (Data Privacy):** Risiko bleibt systemisch erhöht, weil Angriffsoberflächen ohne echte Access-Gates bestehen.

**Lens (Operational Realism):** Wartungsarm kurzfristig, aber langfristig ausfall-/missbrauchsanfällig, weil auf Netzwerkvertrauen gebaut wird.

**Empfehlungen:**
- **R11:** Einheitliche Security Middleware für alle mutierenden Endpoints (Auth, Rate-Limit, structured audit).
- **R12:** Threat-model pro API-Cluster + regelmäßige Attack-Simulation (curl-based abuse tests) in CI.

**Evidenz:**
- `projects/tierpolitik-db/netlify/functions/*.mjs` (mutierend ohne Auth-Check)
- `cockpit/app/api/*/route.ts` (keine erkennbare zentrale Auth-Schicht)

---

## Top 3 next actions for tomorrow
1. **R1 + R3 sofort:** Cockpit API exposure reduzieren (localhost/VPN/ACL) und AuthN/AuthZ vor `agents/control` + `files/*` erzwingen.
2. **R4 + R5 sofort:** Kompromittierungsannahme für vorhandene Klartext-Secrets; rotieren/revoken und Secret-Handling auf Store-basierte Injection umstellen.
3. **R7 + R8 priorisieren:** Netlify mutierende Endpoints auf signierte Requests + Replay-Schutz + Audit-Logs umstellen.

Für Deep Dive antworte mit: Deep dive R<Nummer>
