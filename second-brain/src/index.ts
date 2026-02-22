import { addEntity, addLink, listEntities, listLinks, uid } from './store.js'
import { EntityType } from './types.js'

const [, , cmd, ...args] = process.argv

const now = () => new Date().toISOString()

function getOpt(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`)
  return idx >= 0 ? args[idx + 1] : undefined
}

function getTags(): string[] {
  const raw = getOpt('tags')
  return raw ? raw.split(',').map((t) => t.trim()).filter(Boolean) : []
}

function requiredValue(v: string | undefined, msg: string): string {
  if (!v) throw new Error(msg)
  return v
}

function help() {
  console.log(`Second Brain CLI

Befehle:
  add <type> "Titel" [--notes "..."] [--tags a,b]
      Typen: task|client|project|memory|doc|person
      task extras: --due YYYY-MM-DD --priority low|med|high --status open|doing|done --assignee "Tobi|ALF|Beide"
      doc extras: --url https://...
      person extras: --role "..."

  list [type]
  link <fromId> <toId> [--relation related]
  links

Beispiele:
  npm run dev -- add task "Website-Copy finalisieren" --priority high --due 2026-02-20 --tags website,tif
  npm run dev -- add project "Tierpolitik Monitor"
  npm run dev -- add memory "Learned: Review-first funktioniert" --tags crawler
  npm run dev -- link project_xxx task_xxx --relation belongs_to
  npm run dev -- list task
`)
}

try {
  if (!cmd || cmd === 'help' || cmd === '--help') {
    help()
    process.exit(0)
  }

  if (cmd === 'add') {
    const type = requiredValue(args[0], 'Typ fehlt') as EntityType
    const title = requiredValue(args[1], 'Titel fehlt')
    const base = {
      id: uid(type),
      type,
      title,
      notes: getOpt('notes'),
      tags: getTags(),
      createdAt: now(),
      updatedAt: now(),
    }

    const entity =
      type === 'task'
        ? {
            ...base,
            type: 'task' as const,
            due: getOpt('due'),
            priority: (getOpt('priority') as 'low' | 'med' | 'high' | undefined) ?? 'med',
            status: (getOpt('status') as 'open' | 'doing' | 'done' | undefined) ?? 'open',
            assignee: getOpt('assignee'),
          }
        : type === 'doc'
          ? { ...base, type: 'doc' as const, url: getOpt('url') }
          : type === 'person'
            ? { ...base, type: 'person' as const, role: getOpt('role') }
            : { ...base, type } as any

    const created = addEntity(entity)
    console.log('OK_ADD')
    console.log(JSON.stringify(created, null, 2))
    process.exit(0)
  }

  if (cmd === 'list') {
    const type = args[0] as EntityType | undefined
    const items = listEntities(type)
    console.log(JSON.stringify(items, null, 2))
    process.exit(0)
  }

  if (cmd === 'link') {
    const from = requiredValue(args[0], 'fromId fehlt')
    const to = requiredValue(args[1], 'toId fehlt')
    const relation = getOpt('relation') ?? 'related'
    const out = addLink({ from, to, relation, createdAt: now() })
    console.log('OK_LINK')
    console.log(JSON.stringify(out, null, 2))
    process.exit(0)
  }

  if (cmd === 'links') {
    console.log(JSON.stringify(listLinks(), null, 2))
    process.exit(0)
  }

  help()
  process.exit(1)
} catch (error) {
  console.error('ERROR', (error as Error).message)
  process.exit(1)
}
