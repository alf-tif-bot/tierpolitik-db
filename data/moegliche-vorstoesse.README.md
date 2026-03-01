# Mögliche Vorstösse (Ideen-DB)

SQLite-Datei: `data/moegliche-vorstoesse.db`

## Tabelle

`vorstoesse_ideen`
- `id` (INTEGER, PK)
- `titel` (TEXT, UNIQUE)
- `kategorie` (TEXT)
- `status` (TEXT, default `neu`)
- `notiz` (TEXT)
- `erstellt_am` (UTC timestamp)

## Beispiele

```bash
# alle Ideen anzeigen
sqlite3 -header -column data/moegliche-vorstoesse.db "SELECT * FROM vorstoesse_ideen ORDER BY id DESC;"

# neue Idee hinzufügen
sqlite3 data/moegliche-vorstoesse.db "INSERT INTO vorstoesse_ideen (titel, kategorie, status) VALUES ('Beispiel-Vorstoss', 'Finanzierung', 'neu');"
```
