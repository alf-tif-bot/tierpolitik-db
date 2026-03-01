# Nightly Security Review — 2026-02-26

## Executive Summary
Gesamtrisiko: **hoch-kritisch**. 
Der Review zeigt eine direkte Angriffsfläche mit möglicher **vollständiger Manipulation der Workspace-Daten und Betriebssteuerung** durch ungeschützte API-Endpunkte im Cockpit. Zusätzlich bestehen Integritätsrisiken in produktionsnahen Netlify-Funktionen ohne Authentisierung, schwache TLS-Validierung für DB-Verbindungen sowie ein lokal abgelegtes Klartext-DB-Secret.

Positiv: SQL-Queries sind überwiegend parametrisiert (kein offensichtlicher klassischer SQL-Injection-Pfad), und es gibt grundlegende Pfad-/Dateityp-Checks in File-APIs.

---

## Findings

1. **[CRITICAL] Unauthentisierte Admin-/Datei-APIs im Cockpit ermöglichen Missbrauchskette bis zur Systemmanipulation**  
   **Lens:** Offensive, Defensive, Operational realism  
   **Impact:** Jeder mit Netzwerkzugriff auf das Cockpit kann (a) Dateien im Workspace lesen/schreiben und (b) operative Control-Aktionen auslösen. Daraus ergibt sich eine Kette: Datenexfiltration → Persistenz via Dateimanipulation → Betriebsstörung/Manipulation.  
   **Evidenz:**  
   - `/Users/alf/.openclaw/workspace/cockpit/app/api/agents/control/route.ts:52-85` (POST verarbeitet `action` direkt; keine AuthN/AuthZ-Prüfung)  
   - `/Users/alf/.openclaw/workspace/cockpit/app/api/agents/control/route.ts:76-81` (`cockpit-self-heal` führt Shell-Befehl aus)  
   - `/Users/alf/.openclaw/workspace/cockpit/app/api/files/write/route.ts:54-88` (Dateischreib-Endpoint ohne Benutzerprüfung)  
   - `/Users/alf/.openclaw/workspace/cockpit/app/api/files/read/route.ts:26-103` (Dateilese-Endpoint ohne Benutzerprüfung)  
   **Warum kritisch:** Wenn Cockpit versehentlich oder absichtlich über localhost hinaus erreichbar ist (Reverse Proxy, Tunnel, falsch konfiguriertes Binding), ist dies ein direkter High-Impact-Angriffsweg.
   **Empfehlung:** **R1**

2. **[HIGH] Netlify Review-/Feedback-Endpunkte ändern Daten ohne serverseitige Authentisierung**  
   **Lens:** Offensive, Defensive, Data privacy  
   **Impact:** Unbefugte Requests können Review-Status, Fastlane-Tags und Feedback-Datensätze verändern; CORS schützt nicht gegen serverseitige Direktaufrufe (curl/bot/backend).  
   **Evidenz:**  
   - `/Users/alf/.openclaw/workspace/projects/tierpolitik-db/netlify/functions/review-decision.mjs:36-56,63-166`  
   - `/Users/alf/.openclaw/workspace/projects/tierpolitik-db/netlify/functions/review-fastlane-tag.mjs:16-60`  
   - `/Users/alf/.openclaw/workspace/projects/tierpolitik-db/netlify/functions/feedback-submit.mjs:30-132`  
   **Defensive gap:** Nur Method-/Origin-Checks, aber kein Signatur-/Token-Check pro Request.  
   **Empfehlung:** **R2**

3. **[HIGH] DB-TLS kann MITM erlauben (`rejectUnauthorized: false`)**  
   **Lens:** Defensive, Data privacy  
   **Impact:** Bei `PGSSLMODE=require` wird Zertifikatsprüfung deaktiviert; ein Angreifer im Netzpfad könnte Traffic terminieren/manipulieren.  
   **Evidenz:**  
   - `/Users/alf/.openclaw/workspace/projects/tierpolitik-db/crawler/db-postgres.mjs:40-44`  
   - `/Users/alf/.openclaw/workspace/agents/coding/repo/crawler/db-postgres.mjs:40-44`  
   **Empfehlung:** **R3**

4. **[HIGH] Klartext-Datenbankzugang in lokaler `.env.db`**  
   **Lens:** Data privacy, Operational realism  
   **Impact:** Secret-Exposure-Risiko (lokaler Zugriff, Backups, Screen-Sharing, Fehlkopien in Tickets/Logs). Bei Leck: unmittelbarer DB-Zugriff.  
   **Evidenz:**  
   - `/Users/alf/.openclaw/workspace/tierpolitik-vorstoesse-db/.env.db:3`  
   **Empfehlung:** **R4**

5. **[MEDIUM] Interne Fehlermeldungen werden ungefiltert an Clients zurückgegeben**  
   **Lens:** Offensive, Defensive  
   **Impact:** Stack-/Systemdetails in `error.message` können Recon erleichtern (Tabellen-/Pfadnamen, Betriebszustände).  
   **Evidenz:**  
   - `/Users/alf/.openclaw/workspace/projects/tierpolitik-db/netlify/functions/review-decision.mjs:167-172`  
   - `/Users/alf/.openclaw/workspace/projects/tierpolitik-db/netlify/functions/feedback-submit.mjs:133-138`  
   - `/Users/alf/.openclaw/workspace/cockpit/app/api/agents/control/route.ts:85-88`  
   **Empfehlung:** **R5**

6. **[LOW] Security-Maintenance-Risiko durch doppelte Codebasis (Patch-Drift)**  
   **Lens:** Operational realism  
   **Impact:** Kritische Fixes müssen parallel in `projects/tierpolitik-db` und `agents/coding/repo` gepflegt werden; erhöht Ausfall-/Fehlkonfigurationswahrscheinlichkeit.  
   **Evidenz (Beispiel-Duplikate):**  
   - `.../projects/tierpolitik-db/netlify/functions/review-decision.mjs` und `.../agents/coding/repo/netlify/functions/review-decision.mjs`  
   - `.../projects/tierpolitik-db/crawler/db-postgres.mjs` und `.../agents/coding/repo/crawler/db-postgres.mjs`  
   **Empfehlung:** **R6**

---

## Recommendations (IDs)

- **R1 (sofort):** Cockpit-API hart absichern: verpflichtende AuthN/AuthZ (mind. Bearer + Rollen), zusätzlich Netzwerkgrenze (localhost-only + Reverse-Proxy ACL/VPN), CSRF-Schutz für Browser-Calls, Audit-Logging pro sensitiver Action.  
- **R2 (sofort):** Für Netlify-Mutationsendpunkte serverseitige Signaturprüfung (HMAC/JWT), Rate-Limits, Replay-Schutz (nonce/timestamp), und getrennte Rollen-Token pro Funktion.  
- **R3:** TLS-Härtung DB: `rejectUnauthorized: true`, vertrauenswürdige CA/Pinning-Strategie, Deployment-Checks auf unsichere SSL-Flags.  
- **R4:** Secret-Rotation + Secret-Manager (kein Klartext `.env.db` in Arbeitskopien/Backups), minimale DB-Rechte (least privilege), Monitoring auf anomalous DB logins.  
- **R5:** Fehlerausgaben sanitizen (stabile generische Fehltexte extern, Details nur serverseitig strukturiert loggen).  
- **R6:** Sicherheitsrelevanten Code deduplizieren (shared package/monorepo module), damit Patches konsistent ausgerollt werden.

---

## Top 3 next actions for tomorrow

1. **R1 umsetzen (Blocker):** Auth-Gate vor `cockpit/app/api/*` (insb. `agents/control`, `files/read`, `files/write`) + Zugang auf private Netzgrenze begrenzen.  
2. **R2 umsetzen:** Signierte Server-zu-Server-Auth für `review-decision`, `review-fastlane-tag`, `feedback-submit` live schalten.  
3. **R3+R4 parallel:** DB-Secret rotieren, Klartext `.env.db` entfernen/ersetzen, TLS-Zertifikatsprüfung strikt aktivieren.

Für Deep Dive antworte mit: Deep dive R<Nummer>
