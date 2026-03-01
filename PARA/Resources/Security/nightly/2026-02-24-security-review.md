# Security Review — 2026-02-24

## Executive Summary
Die Codebase zeigt mehrere **akut ausnutzbare Risiken** in produktionsnahen Komponenten (Cockpit + Netlify Functions). Haupttreiber sind fehlende Authentisierung auf sensitiven API-Routen, ein geleakter produktiver DB-Connection-String sowie unsichere TLS-Validierung. Zusätzlich gibt es einen Verfügbarkeitsfehler in der Daten-API, der Security-Monitoring und Betriebssicherheit schwächt. 

Bewertung über 4 Linsen:
- **Offensive:** Angreiferpfade zu Remote-Steuerung, Datenmanipulation und potenzieller Privilege Escalation sind realistisch.
- **Defensive:** Basiskontrollen (Input-Validation, CORS) sind vorhanden, aber ersetzen keine AuthN/AuthZ.
- **Datenschutz:** Secrets-Handling ist unzureichend; potenzieller Zugriff auf sensible Workspace-Dateien.
- **Operational realism:** Mehrere Kontrollen wirken „security theater“ (z. B. CORS ohne Auth), operative Ausfälle wahrscheinlich.

---

## Findings

1. **[CRITICAL] Geleakter produktiver DB-Credential im Workspace (.env.db mit Klartext-Passwort)**  
   **Betroffene Evidenz:** `tierpolitik-vorstoesse-db/.env.db:3`  
   **Offensive:** Jeder mit Repo/Dateizugriff kann DB direkt ansprechen, Daten exfiltrieren/manipulieren, Persistenz herstellen.  
   **Defensive Gap:** Kein Hinweis auf Secret-Rotation/Trennung Dev vs Prod im File selbst.  
   **Privacy Impact:** Vollzugriff auf potenziell personenbezogene Feedback-/Review-Daten.  
   **Operational realism:** Credential-Leaks führen in der Praxis fast immer zu „silent compromise“, da oft spät erkannt.  
   **Empfehlungen:**  
   - **R1:** Credential sofort rotieren (DB User + Passwort), alte Verbindung sofort invalidieren.  
   - **R2:** `.env.db` aus VCS/Sync-Pfaden entfernen, nur `.env.db.example` behalten, Secret-Manager nutzen.  
   - **R3:** Secret-Scanning im CI erzwingen (pre-commit + CI gate).

2. **[CRITICAL] Unauthentisierte High-Privilege Control-API im Cockpit (Command Execution Trigger)**  
   **Betroffene Evidenz:** `cockpit/app/api/agents/control/route.ts:52-82`, `:41-49`, `:76-79`  
   **Offensive:** Ohne Auth kann ein Request Aktionen wie `gateway-restart`, `heartbeat-enable/disable`, `cockpit-self-heal` auslösen; letzteres führt Shell-Kommandos aus. Bei Netzwerk-Exponierung ist das ein direkter Kontrollkanal.  
   **Defensive Gap:** Keine AuthN/AuthZ, kein CSRF-Token, keine Signaturprüfung, keine Rollenprüfung.  
   **Privacy/Integrity:** Verfügbarkeit und Integrität des Systems manipulierbar; potenziell Seiteneffekte auf Logs/State.  
   **Operational realism:** „Nur intern erreichbar“ ist erfahrungsgemäß kein belastbarer Schutz (Port-Forward, Reverse-Proxy, Fehlkonfig).  
   **Empfehlungen:**  
   - **R4:** Route sofort hinter zwingende AuthN/AuthZ (mTLS oder signed bearer + role check) setzen.  
   - **R5:** Sensitivste Actions serverseitig allowlist + second-factor approval (z. B. one-time ops token).  
   - **R6:** Harte Netzgrenze (localhost-only + firewall) als zusätzlicher Defense-in-Depth Layer.

3. **[HIGH] Unauthentisierte File-Write API erlaubt Dateiänderungen im gesamten Workspace**  
   **Betroffene Evidenz:** `cockpit/app/api/files/write/route.ts:54-87`, Pfadscope `:9`, `:38-49`  
   **Offensive:** Angreifer kann beliebige erlaubte Textdateien im Workspace modifizieren (inkl. Scripts/Configs), dadurch Supply-Chain-artige Persistenz und indirekte Codeausführung vorbereiten.  
   **Defensive Gap:** Gute Path-Validation vorhanden, aber keine Identitäts-/Rechteprüfung.  
   **Privacy:** Manipulation von Daten- und Konfigurationsdateien kann zu Datenabfluss in Folgeprozessen führen.  
   **Operational realism:** Sehr wartungsintensiv, da jede neu erlaubte Endung potenziell Angriffsfläche erweitert.  
   **Empfehlungen:**  
   - **R7:** AuthN/AuthZ verpflichtend, nur explizite Projekt-Unterpfade freigeben (nicht ganzer Workspace).  
   - **R8:** Schreiboperationen revisionssicher loggen (who/what/when/diff) + Alerting.  
   - **R9:** Standardmäßig read-only; write nur per kurzlebigem signed intent-token.

4. **[HIGH] Netlify Review-/Feedback-Endpunkte erlauben zustandsändernde DB-Operationen ohne echte Authentisierung**  
   **Betroffene Evidenz:** `projects/tierpolitik-db/netlify/functions/review-decision.mjs:36-56,63-117`, `feedback-submit.mjs:30-64,66-120`  
   **Offensive:** Externe Requests können Statusänderungen, Review-Einträge und Versionen erzeugen/manipulieren. CORS reduziert nicht gegen serverseitige direkte Requests.  
   **Defensive Gap:** Keine API-Signatur, kein service-to-service auth, keine rate limits/captcha für missbrauchbare Pfade.  
   **Privacy/Integrity:** Datenqualität und Prozessintegrität (Review-Workflow) kompromittierbar.  
   **Operational realism:** Missbrauch fällt oft spät auf, da Änderungen wie legitime Facharbeit aussehen.  
   **Empfehlungen:**  
   - **R10:** Signed requests (HMAC/JWT with audience/expiry) zwingend.  
   - **R11:** Strikte Ratenbegrenzung + abuse detection + idempotency keys.  
   - **R12:** Reviewer-Aktionen trennen von Public-Feedback-Endpoint (separate trust boundaries).

5. **[HIGH] TLS-Validierung in DB-Client absichtlich abgeschwächt (`rejectUnauthorized:false`)**  
   **Betroffene Evidenz:** `projects/tierpolitik-db/crawler/db-postgres.mjs:40-44`  
   **Offensive:** MITM-Angriffe werden deutlich erleichtert (insb. in kompromittierten Netzsegmenten/Proxy-Umgebungen).  
   **Defensive Gap:** SSL aktiv, aber Server-Zertifikat wird nicht verifiziert.  
   **Privacy:** DB-Inhalte und Credentials können mitgelesen/manipuliert werden.  
   **Operational realism:** „Temporäre“ TLS-Ausnahmen bleiben erfahrungsgemäß dauerhaft.  
   **Empfehlungen:**  
   - **R13:** `rejectUnauthorized:true` + saubere CA-Chain/Pinning im Deployment.  
   - **R14:** Failsafe: Startup abbrechen, wenn sichere TLS-Config nicht erfüllt ist.

6. **[MEDIUM] Verfügbarkeits-/Qualitätsrisiko in `home-data` durch Nutzung von Variable vor Initialisierung**  
   **Betroffene Evidenz:** `projects/tierpolitik-db/netlify/functions/home-data.mjs:484` (Nutzung), Initialisierung erst `:493-498`  
   **Offensive:** Kein direkter Exploit, aber API kann in Fehlerpfade fallen; Monitoring-Sicht wird unzuverlässig und kann Angriffe verschleiern.  
   **Defensive Gap:** Kein Test/Type-Gate, das diesen Fehler blockiert.  
   **Operational realism:** Solche Fehler führen zu schleichendem Vertrauensverlust in Security-Datenquellen.  
   **Empfehlungen:**  
   - **R15:** Sofortfix (Deklaration vor Nutzung) + Regression-Test für Mapping-Pipeline.  
   - **R16:** CI mit `tsc --noEmit`/lint/test als Deploy-Blocker.

---

## Top 3 next actions for tomorrow
1. **Incident-Style Secret Response (R1-R3, R13):** DB-Credentials rotieren, alte widerrufen, TLS-Verifikation erzwingen.  
2. **Kill Chain unterbrechen (R4-R9):** Cockpit Control/File APIs sofort hinter AuthN/AuthZ und Netzgrenzen setzen; write-Pfade stark einschränken.  
3. **Workflow-Integrität absichern (R10-R12, R15):** Review-/Feedback-Endpoints signieren+ratenlimitieren, danach `home-data` Bug fixen und CI-Gates scharf schalten.

---

Für Deep Dive antworte mit: Deep dive R<Nummer>
