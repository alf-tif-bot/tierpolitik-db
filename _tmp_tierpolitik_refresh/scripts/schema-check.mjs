import fs from 'node:fs'
import { validateDb } from '../crawler/schema.mjs'

const raw = JSON.parse(fs.readFileSync(new URL('../data/crawler-db.json', import.meta.url), 'utf8'))
validateDb(raw)
console.log('Schema OK')
