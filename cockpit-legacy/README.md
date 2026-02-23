# Cockpit System (local-first)

Ein einfaches, lokales Second-Brain-System für:

- Tasks
- Clients
- Projects
- Memory
- Docs
- People
- Beziehungen zwischen Einträgen (Links)

## Setup

```bash
cd cockpit-legacy
npm install
```

## Nutzung

### Eintrag anlegen

```bash
npm run dev -- add task "Typeform Zugriff finalisieren" --priority high --due 2026-02-14 --tags tif,ops
npm run dev -- add client "Tier im Fokus"
npm run dev -- add project "Tierpolitik Website"
npm run dev -- add person "Tobias" --role "Lead"
npm run dev -- add doc "Typeform API Docs" --url "https://developer.typeform.com/"
npm run dev -- add memory "Review-first funktioniert besser als duale Ansichten" --tags crawler,ux
```

### Einträge anzeigen

```bash
npm run dev -- list
npm run dev -- list task
npm run dev -- list project
```

### Beziehungen anlegen

```bash
npm run dev -- link project_xxx task_xxx --relation belongs_to
npm run dev -- link person_xxx client_xxx --relation contact_for
npm run dev -- links
```

## Datenmodell

Daten werden lokal gespeichert in:

- `data/db.json`

Damit ist alles transparent, git-freundlich und leicht portierbar.

## Web-UI (gemeinsame To-Do-App)

```bash
npm run ui
# dann im Browser: http://localhost:8787
```

Aktuell enthalten:
- Gemeinsame Task-Ansicht (Open / Doing / Done)
- Zuweisung pro Task (Tobi / ALF / Beide)
- Status-Updates per Klick

## Nächste sinnvolle Ausbaustufen

1. Volltextsuche über alle Entitäten
2. Tages-/Wochen-Ansicht für Tasks
3. Projekt-Board + Verlinkung direkt in UI
4. PostgreSQL-Sync als optionaler Backend-Modus
5. Automatisches Erinnerungs-/Review-System
