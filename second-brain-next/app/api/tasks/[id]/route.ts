import { NextRequest, NextResponse } from 'next/server'
import { patchTask } from '@/lib/db'

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

const validStatus = new Set(['open', 'doing', 'waiting', 'done'])
const validPriority = new Set(['high', 'med', 'low'])
const validImpact = new Set(['high', 'med', 'low'])
const validArea = new Set(['medien', 'politik', 'buch', 'ops'])
const validAssignee = new Set(['Tobi', 'ALF', 'Beide'])
const validTocAxis = new Set(['wertschoepfung', 'weltbild', 'repraesentation'])

function parseDeadline(raw: unknown): string | undefined {
  if (typeof raw === 'undefined' || raw === null) return undefined

  const deadline = String(raw).trim()
  if (!deadline) return undefined

  const dateOnlyMatch = deadline.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnlyMatch) {
    const [, yearRaw, monthRaw, dayRaw] = dateOnlyMatch
    const year = Number(yearRaw)
    const month = Number(monthRaw)
    const day = Number(dayRaw)

    const parsed = new Date(Date.UTC(year, month - 1, day))
    const isSameDate =
      parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day

    if (!isSameDate) {
      throw new Error('Ungueltiges deadline-Format (Datum existiert nicht)')
    }

    return `${yearRaw}-${monthRaw}-${dayRaw}`
  }

  const parsed = new Date(deadline)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Ungueltiges deadline-Format')
  }

  // Persist canonical ISO timestamps to keep deadline sorting/comparisons stable
  // across browsers and mixed client inputs.
  return parsed.toISOString()
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let body: any
  try {
    body = await req.json()
  } catch {
    return jsonNoStore({ error: 'Ungueltiges JSON im Request-Body' }, { status: 400 })
  }

  const patch: Partial<{
    status: 'open' | 'doing' | 'waiting' | 'done'
    priority: 'high' | 'med' | 'low'
    impact?: 'high' | 'med' | 'low'
    area?: 'medien' | 'politik' | 'buch' | 'ops'
    tocAxis?: 'wertschoepfung' | 'weltbild' | 'repraesentation'
    assignee: 'Tobi' | 'ALF' | 'Beide'
    deadline?: string
  }> = {}

  if (typeof body.status !== 'undefined') {
    if (!validStatus.has(body.status)) return jsonNoStore({ error: 'Ungueltiger status' }, { status: 400 })
    patch.status = body.status
  }

  if (typeof body.priority !== 'undefined') {
    if (!validPriority.has(body.priority)) return jsonNoStore({ error: 'Ungueltige priority' }, { status: 400 })
    patch.priority = body.priority
  }

  if (typeof body.impact !== 'undefined') {
    if (body.impact === null || body.impact === '') {
      patch.impact = undefined
    } else {
      if (!validImpact.has(body.impact)) return jsonNoStore({ error: 'Ungueltiger impact' }, { status: 400 })
      patch.impact = body.impact
    }
  }

  if (typeof body.area !== 'undefined') {
    if (body.area === null || body.area === '') {
      patch.area = undefined
    } else {
      if (!validArea.has(body.area)) return jsonNoStore({ error: 'Ungueltige area' }, { status: 400 })
      patch.area = body.area
    }
  }

  if (typeof body.tocAxis !== 'undefined') {
    if (body.tocAxis === null || body.tocAxis === '') {
      patch.tocAxis = undefined
    } else {
      if (!validTocAxis.has(body.tocAxis)) return jsonNoStore({ error: 'Ungueltige tocAxis' }, { status: 400 })
      patch.tocAxis = body.tocAxis
    }
  }

  if (typeof body.assignee !== 'undefined') {
    const assignee = String(body.assignee || '').trim()
    if (!validAssignee.has(assignee)) return jsonNoStore({ error: 'Ungueltiger assignee' }, { status: 400 })
    patch.assignee = assignee as 'Tobi' | 'ALF' | 'Beide'
  }

  if (typeof body.deadline !== 'undefined') {
    try {
      patch.deadline = parseDeadline(body.deadline)
    } catch (error) {
      return jsonNoStore({ error: (error as Error).message }, { status: 400 })
    }
  }

  if (Object.keys(patch).length === 0) {
    return jsonNoStore({ error: 'Keine gueltigen Felder zum Aktualisieren' }, { status: 400 })
  }

  try {
    const out = patchTask(id, patch)
    return jsonNoStore(out)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Task konnte nicht aktualisiert werden'
    const normalized = message.toLocaleLowerCase('de-CH')
    const status = normalized.includes('nicht gefunden') ? 404 : 500

    return jsonNoStore({ error: message }, { status })
  }
}

