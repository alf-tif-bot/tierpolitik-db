import fs from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'

const noStoreHeaders = {
  'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
}

function jsonNoStore<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...noStoreHeaders,
      ...(init?.headers || {}),
    },
  })
}

type SomedayItem = {
  id: string
  fileName: string
  title: string
  description?: string
  status?: string
  impact?: string
  effort?: string
  tags?: string[]
}

const SOMEDAY_DIR = path.resolve(process.cwd(), '..', 'PARA', 'Projects', 'Someday-Maybe')

function parseMeta(content: string) {
  const pick = (...labels: string[]) => {
    for (const label of labels) {
      const rich = new RegExp(`^\\s*[-*]\\s*\\*\\*${label}:\\*\\*\\s*(.+)$`, 'im')
      const plain = new RegExp(`^\\s*[-*]\\s*${label}:\\s*(.+)$`, 'im')
      const richMatch = content.match(rich)
      if (richMatch?.[1]) return richMatch[1].trim()
      const plainMatch = content.match(plain)
      if (plainMatch?.[1]) return plainMatch[1].trim()
    }
    return undefined
  }

  const tagsRaw = pick('Tags', 'Tag', 'tags', 'tag')
  const tags = tagsRaw
    ? tagsRaw
      .split(/[;,|]/)
      .map((t) => t.trim().replace(/^#/, '').toLowerCase())
      .filter(Boolean)
    : []

  const hashTags = Array.from(content.matchAll(/(^|\s)#([\p{L}\p{N}_-]+)/gu))
    .map((m) => m[2]?.trim()?.toLowerCase())
    .filter(Boolean) as string[]

  return {
    status: pick('Status', 'status'),
    impact: pick('Impact', 'impact'),
    effort: pick('Effort', 'effort'),
    tags: Array.from(new Set([...tags, ...hashTags])).sort((a, b) => a.localeCompare(b, 'de-CH')),
  }
}

function titleFromContent(fileName: string, content: string) {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim()
  const base = heading || fileName.replace(/\.md$/i, '').replace(/^\d+[-_]?/, '').replace(/[-_]+/g, ' ').trim()
  return base.replace(/\s*\((someday|maybe)\)\s*$/i, '').trim()
}

function descriptionFromContent(content: string) {
  const explicit = content.match(/^\s*[-*]\s*\*\*(Kurzbeschreibung|Beschreibung|Summary):\*\*\s*(.+)$/im)
  if (explicit?.[2]) return explicit[2].trim()

  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('#'))
    .filter((line) => !/^[-*]\s*\*\*(Status|Impact|Effort|Nächster Schritt|Next Step):\*\*/i.test(line))

  const first = lines[0]
  if (!first) return undefined
  return first.length > 180 ? `${first.slice(0, 177)}…` : first
}

export async function GET() {
  try {
    if (!fs.existsSync(SOMEDAY_DIR)) return jsonNoStore([])

    const files = fs
      .readdirSync(SOMEDAY_DIR, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.toLowerCase().endsWith('.md') && d.name.toUpperCase() !== 'INDEX.MD')
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b, 'de-CH', { numeric: true }))

    const items: SomedayItem[] = []

    for (const fileName of files) {
      try {
        const fullPath = path.join(SOMEDAY_DIR, fileName)
        const content = fs.readFileSync(fullPath, 'utf8')
        const meta = parseMeta(content)

        items.push({
          id: encodeURIComponent(fileName),
          fileName,
          title: titleFromContent(fileName, content),
          description: descriptionFromContent(content),
          status: meta.status,
          impact: meta.impact,
          effort: meta.effort,
          tags: meta.tags,
        })
      } catch {
        // Skip unreadable entries so one bad file does not break the full Someday board.
      }
    }

    return jsonNoStore(items)
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err?.code === 'ENOENT') {
      return jsonNoStore([])
    }

    return jsonNoStore({ error: err?.message || 'Someday-Liste konnte nicht geladen werden' }, { status: 500 })
  }
}

