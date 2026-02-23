import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { NextResponse } from 'next/server'

const execFileAsync = promisify(execFile)

const noStoreHeaders = {
  'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
}

type StatusJson = {
  agents?: {
    defaultId?: string
    agents?: Array<{
      id?: string
      bootstrapPending?: boolean
      sessionsCount?: number
      lastActiveAgeMs?: number
    }>
  }
  heartbeat?: {
    agents?: Array<{ agentId?: string; enabled?: boolean; every?: string }>
  }
  sessions?: {
    defaults?: {
      model?: string
    }
    recent?: Array<{
      agentId?: string
      key?: string
      kind?: string
      updatedAt?: number
      model?: string
    }>
    byAgent?: Array<{
      agentId?: string
      recent?: Array<{
        key?: string
        kind?: string
        updatedAt?: number
      }>
    }>
  }
}

type PurposeMap = Record<string, string>

const defaultPurposeMap: PurposeMap = {
  main: 'Hauptagent für direkte Zusammenarbeit und operative Steuerung',
  'tif-medien': 'Medien-Agent für Kampagnen, Messaging und Veröffentlichung',
  'tif-politik': 'Politik-Agent für Vorstösse, Agenda und Stakeholder-Monitoring',
  'tif-text': 'Text-Agent für Entwürfe, Ausformulierungen und Redaktionsarbeit',
  'tif-website': 'Website-Agent für Webpflege, Struktur und technische Inhalte',
}

const defaultEmojiMap: Record<string, string> = {
  main: '🧠',
  'tif-coding': '🛠️',
  'tif-health': '🩺',
  'tif-medien': '📣',
  'tif-politik': '🏛️',
  'tif-text': '✍️',
  'tif-website': '🌐',
}

function resolveOpenClawBin() {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming')
    const candidate = path.join(appData, 'npm', 'openclaw.cmd')
    if (existsSync(candidate)) return candidate
  }

  return 'openclaw'
}

function formatAge(ms: number | undefined) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return 'unbekannt'

  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (ms < minute) return 'gerade eben'
  if (ms < hour) return `vor ${Math.max(1, Math.floor(ms / minute))} min`
  if (ms < day) return `vor ${Math.max(1, Math.floor(ms / hour))} h`
  return `vor ${Math.max(1, Math.floor(ms / day))} d`
}

function classifyStatus(bootstrapPending: boolean | undefined, lastActiveAgeMs: number | undefined) {
  if (bootstrapPending) return 'bootstrapping' as const
  if (typeof lastActiveAgeMs !== 'number' || !Number.isFinite(lastActiveAgeMs)) return 'idle' as const
  if (lastActiveAgeMs < 15 * 60_000) return 'active' as const
  if (lastActiveAgeMs < 24 * 60 * 60_000) return 'idle' as const
  return 'sleeping' as const
}

async function loadPurposeOverrides(): Promise<PurposeMap> {
  const purposeFile = path.join(process.cwd(), 'data', 'agent-purposes.json')

  try {
    const raw = await readFile(purposeFile, 'utf8')
    const parsed = JSON.parse(raw) as PurposeMap
    if (!parsed || typeof parsed !== 'object') return {}

    const normalized: PurposeMap = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof key === 'string' && typeof value === 'string' && key.trim() && value.trim()) {
        normalized[key.trim()] = value.trim()
      }
    }
    return normalized
  } catch {
    return {}
  }
}

async function statusJson() {
  if (process.platform === 'win32') {
    const openclawBin = resolveOpenClawBin().replace(/'/g, "''")
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', `& '${openclawBin}' status --json`], {
      windowsHide: true,
      timeout: 20_000,
      maxBuffer: 3 * 1024 * 1024,
    })
    return stdout
  }

  const env = {
    ...process.env,
    PATH: `${process.env.PATH || ''}:/opt/homebrew/bin:/usr/local/bin`,
    HOME: process.env.HOME || os.homedir(),
  }

  const { stdout } = await execFileAsync(resolveOpenClawBin(), ['status', '--json'], {
    env,
    windowsHide: true,
    timeout: 20_000,
    maxBuffer: 3 * 1024 * 1024,
  })
  return stdout
}

export async function GET() {
  try {
    const [statusRaw, purposeOverrides] = await Promise.all([statusJson(), loadPurposeOverrides()])
    const status = JSON.parse(statusRaw) as StatusJson

    const heartbeatByAgent = new Map<string, { enabled?: boolean; every?: string }>()
    for (const hb of status.heartbeat?.agents || []) {
      if (!hb?.agentId) continue
      heartbeatByAgent.set(hb.agentId, hb)
    }

    const recentByAgent = new Map<string, { key?: string; kind?: string; updatedAt?: number }>()
    for (const block of status.sessions?.byAgent || []) {
      const id = block?.agentId
      if (!id) continue
      const latest = (block.recent || [])
        .filter((row) => typeof row?.updatedAt === 'number')
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0]
      if (latest) recentByAgent.set(id, latest)
    }

    const modelByAgent = new Map<string, string>()
    for (const row of status.sessions?.recent || []) {
      if (!row?.agentId || !row?.model) continue
      if (modelByAgent.has(row.agentId)) continue
      modelByAgent.set(row.agentId, row.model)
    }

    const agents = (status.agents?.agents || [])
      .filter((agent) => typeof agent?.id === 'string' && agent.id)
      .map((agent) => {
        const id = String(agent.id)
        const heartbeat = heartbeatByAgent.get(id)
        const recent = recentByAgent.get(id)

        return {
          id,
          emoji: defaultEmojiMap[id] || '🤖',
          model: modelByAgent.get(id) || status.sessions?.defaults?.model || 'unbekannt',
          purpose: purposeOverrides[id] || defaultPurposeMap[id] || 'Zweck noch nicht dokumentiert',
          status: classifyStatus(agent.bootstrapPending, agent.lastActiveAgeMs),
          heartbeat: heartbeat?.enabled ? heartbeat.every || 'aktiv' : 'disabled',
          lastActiveLabel: formatAge(agent.lastActiveAgeMs),
          sessionsCount: typeof agent.sessionsCount === 'number' ? agent.sessionsCount : 0,
          lastWorkedOn: recent?.kind ? `${recent.kind}${recent.updatedAt ? ` · ${formatAge(Date.now() - recent.updatedAt)}` : ''}` : 'kein Session-Kontext',
          lastSessionKey: recent?.key || undefined,
        }
      })
      .sort((a, b) => a.id.localeCompare(b.id, 'de-CH'))

    return NextResponse.json({ agents }, { headers: noStoreHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agent-Übersicht konnte nicht geladen werden'
    return NextResponse.json({ error: message }, { status: 500, headers: noStoreHeaders })
  }
}
