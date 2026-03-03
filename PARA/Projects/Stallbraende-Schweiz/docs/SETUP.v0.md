# Stallbrände Schweiz — Setup v0

## Ziel
Belastbare, transparente Erfassung von Stallbränden in der Schweiz (ab 2020), inkl. nachvollziehbarer Schätzung betroffener Tiere.

## Scope (v0)
- **Zeitfenster:** 2020-heute
- **Geografie:** Schweiz (alle Kantone)
- **Ereignis-Typ:** Brand/Feuer mit Stall-/Tierhaltungsbezug
- **In Scope:**
  - bestätigte Medienmeldungen (lokal/regional/national)
  - offizielle Mitteilungen (Polizei/Feuerwehr/Kanton)
  - Artikel mit klarer Orts-/Datumsangabe
- **Out of Scope:**
  - reine Sachschäden ohne Stall-/Tierhaltungsbezug
  - ausländische Ereignisse
  - unbestätigte Social-only Gerüchte

## Kern-Definitionen
- **Stallbrand (Arbeitsdefinition):** Brandereignis in/bei Infrastruktur der Nutztierhaltung (Stall, Geflügelhalle, Schweinestall, Rinderstall etc.) mit potenziell betroffenen Tieren.
- **Betroffene Tiere:**
  - `confirmed_dead`
  - `confirmed_injured`
  - `estimated_range_min/max` (wenn nur indirekte Angaben)
- **Confidence-Level:**
  - `high`: offizielle Zahl oder mehrere übereinstimmende Quellen
  - `medium`: gute Pressequelle, aber ohne Primärbeleg
  - `low`: unvollständig/widersprüchlich

## Mindestfelder pro Ereignis (v0)
- event_id
- datum (ISO)
- kanton, gemeinde
- ortsbeschreibung
- tierart(en)
- confirmed_dead / confirmed_injured
- estimated_range_min / estimated_range_max
- brandursache (falls bekannt)
- quellen[] (URL, publiziert_am, outlet)
- confidence_level
- notes

## Qualitätsregeln
1. Keine Zahl ohne Quelle.
2. Bei widersprüchlichen Zahlen: Bandbreite + beide Quellen speichern.
3. Jede manuelle Korrektur im Feld `notes` mit Grund dokumentieren.
4. Dubletten via (Datum ±2 Tage, Ort, Tierart) prüfen.

## Priorisierte Quellenkanäle (v0)
1. Polizei-/Kantonsmeldungen (Primär)
2. Regionale Medien (Sekundär)
3. Nationale Medien (Sekundär)
4. Verbands-/NGO-Hinweise (Tertiär, nur mit Verifikation)

## Nächste konkrete Umsetzungsschritte
1. Quellenkatalog pro Kanton (Seed-Liste) erstellen.
2. Ingestion-Schema + JSON-Schema v0 definieren.
3. Erste 3 Kantone pilotieren (ZH, BE, AG) und Validierungslogik testen.
