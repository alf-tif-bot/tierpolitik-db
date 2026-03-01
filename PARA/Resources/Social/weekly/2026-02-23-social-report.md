# Weekly Social-Media Snapshot — Tobias Sennhauser

**Reporting date:** 2026-02-23  
**Scope:** Facebook, Instagram, LinkedIn, Bluesky, Threads  
**Source config:** `/Users/alf/.openclaw/workspace/PARA/Resources/Social/tracker-config.md`

---

## 1) Executive Summary

Diese Woche war der Snapshot stark durch **eingeschränkten Plattformzugriff** geprägt (insb. LinkedIn/Facebook/Instagram-Detaildaten). Es konnten dennoch belastbare öffentliche Basiswerte für **Instagram (Account-Level)**, **Threads** und **Bluesky** erhoben werden.

**Kernaussagen:**
- **Instagram:** 731 Follower, 746 Following, 88 Posts (öffentlich aus Meta-Tag).
- **Threads:** 56 Follower, 20 Threads.
- **Bluesky:** 68 Follower, 310 Following, 34 Posts.
- **LinkedIn & Facebook:** keine verlässlichen Kennzahlen ohne Login/API/Export.
- **Per-Post-Engagement (priorisiert für IG + LinkedIn):** diese Woche nicht belastbar abrufbar.

---

## 2) Datenquellen & Datenqualität

### Genutzte Quellen
- Öffentliche Profilseiten laut Tracker-Config.
- Öffentlich lesbare Meta-/Structured-Data-Felder aus den Seitenantworten.
- Keine API-Token, keine Plattform-Logins, keine lokalen Roh-Exporte vorhanden.

### Datenqualität (A–D)
- **A (hoch):** Direkt aus strukturierten öffentlichen Feldern (z. B. JSON-LD, OG-Description mit klaren Zahlen).
- **B (mittel):** Indirekte Textfelder/Meta-Angaben ohne API-Validierung.
- **C (niedrig):** Teilweise abrufbar, aber unvollständig/nicht konsistent.
- **D (nicht belastbar):** keine verwertbaren Kennzahlen abrufbar.

Plattformbewertung:
- Instagram: **B** (Account-Level vorhanden, Per-Post fehlt)
- LinkedIn: **D** (Zugriff blockiert/anti-bot)
- Facebook: **D** (keine verwertbaren Zahlen)
- Bluesky: **A** (strukturierte JSON-LD Kennzahlen)
- Threads: **B** (öffentliche Meta-Felder)

---

## 3) Platform Snapshot

## Instagram
**Profil:** https://www.instagram.com/tobias.sennhauser  
**Account-Level (öffentlich):**
- Followers: **731**
- Following: **746**
- Posts: **88**

**Per-Post-Engagement (priorisiert):**
- Likes/Kommentare/Shares pro Einzelpost: **nicht belastbar abrufbar** (ohne API/Login/Export).

**Growth vs. Vorwoche:**
- **Nicht berechenbar** (kein belastbarer Vorwochen-Baseline-Datensatz im Workspace vorhanden).

**Datenqualität:** **B**

---

## LinkedIn
**Profil:** https://www.linkedin.com/in/tobiassennhauser/  

**Account-Level:**
- Follower/Connections: **nicht abrufbar** (öffentlicher Zugriff liefert keine verwertbaren Kennzahlen ohne Login).

**Per-Post-Engagement (priorisiert):**
- Reaktionen/Kommentare pro Beitrag: **nicht abrufbar**.

**Growth vs. Vorwoche:**
- **Nicht berechenbar**.

**Datenqualität:** **D**

---

## Facebook
**Profil:** http://facebook.com/tobias.sennhauser  

**Account-/Page-Level:**
- Öffentliche Kennzahlen im aktuellen Abruf: **nicht belastbar verfügbar**.

**Growth vs. Vorwoche:**
- **Nicht berechenbar**.

**Datenqualität:** **D**

---

## Bluesky
**Profil:** https://bsky.app/profile/tsennhauser.bsky.social  
**Account-Level (JSON-LD):**
- Followers: **68**
- Following: **310**
- Posts: **34**

**Growth vs. Vorwoche:**
- **Nicht berechenbar** (fehlende persistierte Vorwochen-Baseline).

**Datenqualität:** **A**

---

## Threads
**Profil:** https://www.threads.com/@tobias.sennhauser  
**Account-Level (Meta-Felder):**
- Followers: **56**
- Threads: **20**

**Growth vs. Vorwoche:**
- **Nicht berechenbar** (fehlende Baseline).

**Datenqualität:** **B**

---

## 4) Prioritätsbereich: IG + LinkedIn (Engagement & Wachstum)

### Status diese Woche
- **Instagram:** Nur Account-Summen verfügbar; keine verlässlichen Post-Level-Metriken.
- **LinkedIn:** Weder Account-Wachstum noch Post-Level öffentlich zuverlässig verfügbar.

### Konsequenz
Für aussagekräftige Optimierung nächste Woche braucht es mindestens eine der folgenden Datenquellen:
1. Plattform-Export (CSV/Screenshot) aus IG Insights + LinkedIn Analytics, oder
2. API-Zugang / autorizierten Scraper, oder
3. Manuelle Wochen-Log-Datei (Follower-Stand + Post-Performance je Post).

---

## 5) Top-3 Learnings (trotz Datenlücken)

1. **Distribution ist über mehrere Kanäle vorhanden**, aber die Messbarkeit ist fragmentiert. Ohne zentralen Messpunkt gehen Lernzyklen verloren.
2. **IG hat bereits signifikante Basisreichweite (731 Follower)** – hier ist der größte Hebel, wenn Per-Post-Tracking sauber aufgebaut wird.
3. **Bluesky/Threads liefern leichter öffentliche Basiskennzahlen**; diese Kanäle eignen sich als schneller Taktik-Test für Hooks und Formulierungen.

---

## 6) 3 konkrete Text-/Hook-Empfehlungen für nächste Woche

1. **„Konflikt → Lösung in 1 Satz“ Hook (High-Scroll-Stop)**  
   Vorlage: *„Die meisten [Zielgruppe] machen bei [Thema] genau **diesen** Fehler – so löst du ihn in 30 Sekunden.“*

2. **„Mini-Case mit Zahl“ Hook (Vertrauen + Klarheit)**  
   Vorlage: *„Was bei [Thema] wirklich funktionierte: [konkrete Maßnahme] → [messbares Resultat].“*

3. **„Standpunkt mit Gegenposition“ Hook (Kommentar-Trigger)**  
   Vorlage: *„Unpopular opinion: [klare These]. Warum? 3 Beobachtungen aus der Praxis.“*

---

## 7) Nächste Schritte (operativ)

1. **Baseline-Datei anlegen (ab nächster Woche Pflicht):** Follower/Following/Post-Count je Plattform (wöchentlich fixer Zeitpunkt).  
2. **IG + LinkedIn Post-Log einführen:** pro Post Datum, Hook, Format, Reichweite, Likes, Kommentare, Saves, Shares.  
3. **Snapshot-Automation ergänzen:** Falls API fehlt, definierten manuellen Export-Ordner (`PARA/Resources/Social/exports/YYYY-WW/`) nutzen.

---

## 8) Transparenzhinweis

Dieser Report basiert auf den **aktuell öffentlich abrufbaren Daten ohne Login/API**. Für IG/LinkedIn-Per-Post-Engagement und saubere Wochenvergleiche ist die Aussagekraft derzeit begrenzt. Empfehlung: ab nächster Woche strukturierte Baseline/Export-Pipeline etablieren.
