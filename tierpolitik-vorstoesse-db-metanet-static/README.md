# Tierpolitik Monitor

Dieses Repo ist der **Tierpolitik Monitor**.

## Aktueller Scope
- Frontend (statische Seite)
- Daten in `data/`
- Neon-Erweiterung im Schema `politics_monitor` mit `pm_*` Tabellen

## Struktur
- `assets/` – gebaute Frontend-Assets
- `branding/` – Logos/Bilder
- `data/` – Datendateien für den Monitor
- `migrations/` – DB-Migrationen
- `scripts/` – lokale Hilfsskripte (z. B. Migrationen)
- `legacy/` – alte/derzeit nicht benötigte Dateien

## Lokale Variablen
`.env` (nicht committen):
- `DATABASE_URL`
- `TAVILY_API_KEY`
