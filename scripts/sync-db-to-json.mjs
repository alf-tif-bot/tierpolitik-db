import fs from 'node:fs'
import { resolve } from 'node:path'
import { withPgClient, loadJsonCompatibleSnapshot } from '../crawler/db-postgres.mjs'

const outPath = resolve(process.cwd(), 'data', 'crawler-db.json')

const snapshot = await withPgClient(async (client) => loadJsonCompatibleSnapshot(client))

fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2))
console.log('DB -> JSON Sync abgeschlossen:', outPath, { items: snapshot.items.length, sources: snapshot.sources.length })
