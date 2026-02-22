import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { withPgClient } from '../crawler/db-postgres.mjs'

const schemaPath = resolve(process.cwd(), 'db', 'schema.sql')
const sql = readFileSync(schemaPath, 'utf8')

await withPgClient(async (client) => {
  await client.query(sql)
})

console.log('DB-Schema initialisiert:', schemaPath)
