import fs from 'node:fs'
import path from 'node:path'
import { BrainDB, Entity, EntityType, Link } from './types.js'

const DB_PATH = path.resolve('data/db.json')

const fresh = (): BrainDB => ({ entities: [], links: [] })

export function loadDb(): BrainDB {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
    const init = fresh()
    fs.writeFileSync(DB_PATH, JSON.stringify(init, null, 2))
    return init
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) as BrainDB
}

export function saveDb(db: BrainDB): void {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
}

export function uid(type: EntityType): string {
  return `${type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export function addEntity(entity: Entity): Entity {
  const db = loadDb()
  db.entities.push(entity)
  saveDb(db)
  return entity
}

export function listEntities(type?: EntityType): Entity[] {
  const db = loadDb()
  return type ? db.entities.filter((e) => e.type === type) : db.entities
}

export function addLink(link: Link): Link {
  const db = loadDb()
  const exists = db.entities.some((e) => e.id === link.from) && db.entities.some((e) => e.id === link.to)
  if (!exists) throw new Error('Link fehlgeschlagen: from/to nicht gefunden')
  db.links.push(link)
  saveDb(db)
  return link
}

export function listLinks(): Link[] {
  return loadDb().links
}

export function updateEntity(id: string, patch: Partial<Entity>): Entity {
  const db = loadDb()
  const idx = db.entities.findIndex((e) => e.id === id)
  if (idx < 0) throw new Error('Entity nicht gefunden')
  const current = db.entities[idx]
  const next = {
    ...current,
    ...patch,
    id: current.id,
    type: current.type,
    updatedAt: new Date().toISOString(),
  } as Entity
  db.entities[idx] = next
  saveDb(db)
  return next
}
