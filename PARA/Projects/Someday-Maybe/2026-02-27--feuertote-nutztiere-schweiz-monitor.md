# Feuertote Nutztiere Schweiz – Live-Monitor (Website)

- **Kurzbeschreibung:** Eine Website, die alle bekannten Fälle von bei Bränden gestorbenen Nutztieren in der Schweiz erfasst, per Crawler laufend aktualisiert und präzise Statistiken ausweist.
- **Status:** idea
- **Impact:** high
- **Effort:** high
- **Tags:** dalf, monitor, crawler, schweiz, nutztiere, statistik, transparenz

## Idee
Ein öffentlicher, datengetriebener Monitor für Feuertod-Fälle von Nutztieren in der Schweiz (kantonal, zeitlich, tierartbezogen), inkl. Quellenbeleg und Qualitätsscore.

## Kernfunktionen
- Automatisches Crawling: Medienberichte, Polizeimeldungen, Feuerwehrmeldungen, Amtsmitteilungen
- Standardisierte Fallstruktur: Datum, Ort, Kanton, Tierart, Anzahl Tiere, vermutete Ursache, Quelle(n), Verifikationsstatus
- Statistik-Ansichten: Fälle pro Kanton/Jahr, Tiere betroffen pro Tierart, Trends, Hotspots, saisonale Muster
- Datenqualität: Dubletten-Check, Confidence-Score, manuelle Review-Queue
- Öffentliche Transparenzseite + Export (CSV/JSON)

## Nächster Schritt
V1-Datenschema und Quellenmatrix definieren (Top-20 Quellen), danach 12 Monate Backfill als Pilot mit manueller Verifikation aufsetzen.
