# Security Review – 2026-02-23

## Executive Summary
Gesamtbild: **erhöhtes Risiko**. Es gibt einen **kritischen Secret-Leak** sowie mehrere **hochgradige AuthN/AuthZ-Lücken** in schreibenden API-Endpunkten. Zusätzlich bestehen TLS- und Betriebsrisiken (Fail-open/Fallback-Verhalten), die Angriffsflächen vergrößern und Detektion erschweren.

Bewertung nach 4 Linsen:
- **Offensive:** reale Missbrauchsketten möglich (Token-Diebstahl, unautorisierte Datenmanipulation, potenzielles Defacement/Operational Drift).
- **Defensive:** zentrale Schutzschichten (Auth, Rate-Limit, Audit/Alerting) fehlen an sensiblen Stellen.
- **Data Privacy:** Secrets liegen im Klartext im Workspace; potenzielle Exfiltration über file-read APIs.
- **Operational Realism:** einige Controls wirken eher formell (CORS-only), ohne echte Angreiferresistenz.

---

## Findings

### 1) [CRITICAL] Klartext-Secret im Repo/Workspace (Todoist API Token)
**Linsen:** Offensive, Data Privacy, Operational Realism  
**Evidenz:** `secrets/todoist.env:1`  
**Details:** Ein produktiv wirkender `TODOIST_API_TOKEN` liegt im Klartext vor. Jeder mit Dateizugriff (inkl. kompromittierter Prozesse/Backups/Logs) kann den Token direkt missbrauchen.  
**Angriffspfad:** Token auslesen → Todoist API aufrufen → Aufgaben lesen/manipulieren/löschen.  
**Impact:** Direkte Account-/Datenkompromittierung, Missbrauch ohne weitere Hürde.

**Empfehlungen:**
- **R1:** Token sofort rotieren/revoken.
- **R2:** Secret aus Workspace entfernen, nur noch via Secret-Manager / OS-Keychain / CI Secret Store bereitstellen.
- **R3:** Secret-Scanning als Gate (pre-commit + CI) aktivieren.

---

### 2) [HIGH] Fehlende Authentifizierung/Autorisierung in schreibenden Cockpit-APIs
**Linsen:** Offensive, Defensive, Operational Realism  
**Evidenz:**
- `cockpit/app/api/files/write/route.ts:54-88` (Dateischreib-Endpoint)
- `cockpit/app/api/files/read/route.ts:26-102` (Dateilese-Endpoint)
- `cockpit/app/api/tasks/route.ts:76-141` (Task read/write ohne Auth)
- analog weitere Mutationsrouten unter `cockpit/app/api/*`  
**Details:** API-Routen akzeptieren Requests ohne erkennbare Session-, Token- oder Rollenprüfung. CORS/No-Store ist kein Auth-Ersatz.  
**Angriffspfad:** Netzwerkzugriff auf Cockpit → direkte API-Calls → Datenmanipulation/Exfiltration im erlaubten Workspace-Rahmen.  
**Impact:** Integritätsverlust, unautorisierte Änderungen, potenziell Exfiltration sensibler Inhalte.

**Empfehlungen:**
- **R4:** Vor alle mutierenden und lesenden Sensitiv-Endpoints verpflichtende AuthN/AuthZ (z. B. signed session/JWT + role checks).
- **R5:** Zusätzlich IP-Allowlist oder mTLS/VPN-Segmentierung für interne Admin-APIs.
- **R6:** Audit-Logs pro API-Call (wer/was/wann), plus Alerting auf ungewöhnliche Schreibmuster.

---

### 3) [HIGH] Netlify Review-Endpunkte ohne echte Zugriffskontrolle (CORS-only)
**Linsen:** Offensive, Defensive, Operational Realism  
**Evidenz:**
- `projects/tierpolitik-db/netlify/functions/review-decision.mjs:10-16, 36-56`
- `projects/tierpolitik-db/netlify/functions/review-fastlane-tag.mjs:9-15, 16-34`  
**Details:** Endpunkte setzen CORS-Header, prüfen aber keine Authentisierung/Signatur. CORS schützt Browser, nicht direkte Server-to-Server Requests.  
**Angriffspfad:** Direkter POST auf Function URL → Status-/Review-Manipulation in DB.  
**Impact:** Datenintegrität der Review-Pipeline kompromittierbar, Workflow-Manipulation.

**Empfehlungen:**
- **R7:** HMAC-signierte Requests oder API-Key/JWT mit Rotation und Scope-Prüfung.
- **R8:** Rate-Limits + Replay-Protection (nonce/timestamp).
- **R9:** Write-Actions nur für explizit autorisierte Principals; 403 default-deny.

---

### 4) [MEDIUM] TLS-Verifikation deaktivierbar bei DB-Verbindung (`rejectUnauthorized: false`)
**Linsen:** Offensive, Defensive, Data Privacy  
**Evidenz:** `projects/tierpolitik-db/crawler/db-postgres.mjs:40-44`  
**Details:** Bei `PGSSLMODE=require` wird `rejectUnauthorized: false` gesetzt. Dadurch wird Zertifikatsvalidierung umgangen (MITM-Risiko in unsicheren Netzsegmenten).  
**Impact:** Vertraulichkeit/Integrität der DB-Verbindung geschwächt.

**Empfehlungen:**
- **R10:** `rejectUnauthorized: true` erzwingen; CA-Bundle pinnen.
- **R11:** Laufzeit-Check einbauen: Start verweigern bei unsicherer TLS-Policy außerhalb lokaler Dev-Profile.

---

### 5) [MEDIUM] Operationale Zuverlässigkeitslücke in `home-data` (Fail-open/Fallback verschleiert Fehler)
**Linsen:** Defensive, Operational Realism  
**Evidenz:**
- `projects/tierpolitik-db/netlify/functions/home-data.mjs:484` (`businessNumber` vor Initialisierung verwendet)
- `projects/tierpolitik-db/netlify/functions/home-data.mjs:493-498` (Deklaration erst später)
- `projects/tierpolitik-db/netlify/functions/home-data.mjs:598-603` (globaler Catch mit Fallback-Payload)  
**Details:** ReferenceError möglich, danach wird still auf Fallback-Daten gewechselt. Das reduziert Sichtbarkeit von echten Fehlern und kann Security-/Datenqualitätsvorfälle maskieren.  
**Impact:** Detektion erschwert, Incident-Triage verzögert, potenziell veraltete/inkonsistente Daten im Frontend.

**Empfehlungen:**
- **R12:** Bugfix (Deklarationsreihenfolge korrigieren), Tests für Mapping-Pfad.
- **R13:** Fehler nicht still „wegfangen“: strukturiertes Error-Logging + Alerting + expliziter degraded-status.

---

## Top 3 Next Actions für morgen
1. **R1 + R2 sofort:** Todoist-Token rotieren und aus Klartext-Datei entfernen; Secret-Scans verpflichtend schalten (R3).  
2. **R4 + R7 priorisieren:** AuthN/AuthZ für Cockpit- und Netlify-Write-Endpunkte einführen (nicht nur CORS).  
3. **R10 + R12 umsetzen:** TLS-Validierung hart machen und `home-data`-Bug inkl. Monitoring/Alerting fixen.

---

Für Deep Dive antworte mit: **Deep dive R<Nummer>**
