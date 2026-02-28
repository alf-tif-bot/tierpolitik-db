import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { NextResponse } from 'next/server'

const execFileAsync = promisify(execFile)

const noStoreHeaders = {
  'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
}

type CronJobRaw = {
  id?: string
  name?: string
  agentId?: string
  enabled?: boolean
  source?: 'openclaw' | 'launchd'
  createdAtMs?: number
  updatedAtMs?: number
  sessionTarget?: string
  wakeMode?: string
  payload?: {
    kind?: string
    message?: string
  }
  delivery?: {
    mode?: string
    channel?: string
    to?: string
  }
  schedule?: {
    kind?: 'every' | 'cron'
    everyMs?: number
    expr?: string
    tz?: string
  }
  state?: {
    nextRunAtMs?: number
    lastRunAtMs?: number
    lastStatus?: string
    lastRunStatus?: string
    lastDurationMs?: number
    lastError?: string
    consecutiveErrors?: number
    lastDelivered?: boolean
    lastDeliveryStatus?: string
  }
}

type CronJobsFile = {
  jobs?: CronJobRaw[]
}

type CronJobView = ReturnType<typeof toJobView>

function formatSchedule(job: CronJobRaw) {
  const schedule = job.schedule
  if (!schedule) return 'unbekannt'

  if (schedule.kind === 'every' && typeof schedule.everyMs === 'number') {
    const minutes = Math.round(schedule.everyMs / 60_000)
    if (minutes < 60) return `alle ${minutes} Min.`

    const hours = Number((schedule.everyMs / 3_600_000).toFixed(2))
    return `alle ${hours} Std.`
  }

  if (schedule.kind === 'cron' && schedule.expr) {
    const parts = schedule.expr.trim().split(/\s+/)
    if (parts.length === 5) {
      const [m, h, dom, mon, dow] = parts
      if (/^\d{1,2}$/.test(m) && /^\d{1,2}$/.test(h) && dom === '*' && mon === '*' && dow === '*') {
        return `täglich ${h.padStart(2, '0')}:${m.padStart(2, '0')}`
      }
      if (/^\d{1,2}$/.test(m) && /^\d{1,2}$/.test(h) && dom === '*' && mon === '*' && /^\d$/.test(dow)) {
        const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
        const label = days[Number(dow)] || `Tag ${dow}`
        return `wöchentlich ${label} ${h.padStart(2, '0')}:${m.padStart(2, '0')}`
      }
      if (/^\d{1,2}$/.test(m) && /^\d{1,2}$/.test(h) && /^\d{1,2}$/.test(dom) && mon === '*' && dow === '*') {
        return `monatlich am ${dom}. um ${h.padStart(2, '0')}:${m.padStart(2, '0')}`
      }
    }
    return `cron ${schedule.expr}`
  }

  return 'unbekannt'
}

function resolveOpenClawBin() {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming')
    const candidate = path.join(appData, 'npm', 'openclaw.cmd')
    if (existsSync(candidate)) return candidate
  }

  return 'openclaw'
}

async function cronListJson() {
  if (process.platform === 'win32') {
    const openclawBin = resolveOpenClawBin().replace(/'/g, "''")
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', `& '${openclawBin}' cron list --json`], {
      windowsHide: true,
      timeout: 20_000,
      maxBuffer: 2 * 1024 * 1024,
    })
    return stdout
  }

  const { stdout } = await execFileAsync(resolveOpenClawBin(), ['cron', 'list', '--json'], {
    windowsHide: true,
    timeout: 20_000,
    maxBuffer: 2 * 1024 * 1024,
  })
  return stdout
}

async function readCronJobsFileFallback() {
  const jobsFile = path.join(os.homedir(), '.openclaw', 'cron', 'jobs.json')
  const raw = await readFile(jobsFile, 'utf8')
  const parsed = JSON.parse(raw) as CronJobsFile
  return Array.isArray(parsed.jobs) ? parsed.jobs : []
}

function inferCronType(job: CronJobRaw) {
  const name = String(job.name || '').toLowerCase()
  const agentId = String(job.agentId || '').toLowerCase()
  const message = String(job.payload?.message || '').toLowerCase()

  if (name.includes('security') || message.includes('security') || message.includes('sicher')) return 'Security'
  if (name.includes('backup') || name.includes('restic') || message.includes('backup')) return 'Backup'
  if (name.includes('crawler') || name.includes('monitor')) return 'Monitoring'
  if (name.includes('health') || agentId.includes('health')) return 'Health'
  if (agentId.startsWith('tif-') || name.includes('tif') || message.includes('tier im fokus') || message.includes('tierimfokus')) return 'TIF'
  if (name.includes('content') || message.includes('newsletter') || message.includes('social')) return 'Content'
  if (name.includes('workspace') || message.includes('workspace')) return 'Ops'

  return 'General'
}

function toJobView(job: CronJobRaw) {
  const nextRunAtMs = typeof job.state?.nextRunAtMs === 'number' ? job.state.nextRunAtMs : null

  return {
    id: String(job.id || ''),
    name: String(job.name || 'Ohne Namen'),
    agentId: typeof job.agentId === 'string' ? job.agentId : null,
    enabled: job.enabled !== false,
    scheduleLabel: formatSchedule(job),
    scheduleKind: job.schedule?.kind || null,
    scheduleExpr: typeof job.schedule?.expr === 'string' ? job.schedule.expr : null,
    scheduleTz: typeof job.schedule?.tz === 'string' ? job.schedule.tz : null,
    scheduleEveryMs: typeof job.schedule?.everyMs === 'number' ? job.schedule.everyMs : null,
    status: String(job.state?.lastStatus || 'idle'),
    cronType: inferCronType(job),
    source: job.source === 'launchd' ? 'launchd' : 'openclaw',
    sessionTarget: typeof job.sessionTarget === 'string' ? job.sessionTarget : null,
    wakeMode: typeof job.wakeMode === 'string' ? job.wakeMode : null,
    payloadKind: typeof job.payload?.kind === 'string' ? job.payload.kind : null,
    payloadMessage: typeof job.payload?.message === 'string' ? job.payload.message : null,
    deliveryMode: typeof job.delivery?.mode === 'string' ? job.delivery.mode : null,
    deliveryChannel: typeof job.delivery?.channel === 'string' ? job.delivery.channel : null,
    deliveryTo: typeof job.delivery?.to === 'string' ? job.delivery.to : null,
    deliveryTargetLabel: null as string | null,
    createdAtMs: typeof job.createdAtMs === 'number' ? job.createdAtMs : null,
    updatedAtMs: typeof job.updatedAtMs === 'number' ? job.updatedAtMs : null,
    nextRunAtMs,
    nextRunAtIso: nextRunAtMs ? new Date(nextRunAtMs).toISOString() : null,
    lastRunAtMs: typeof job.state?.lastRunAtMs === 'number' ? job.state.lastRunAtMs : null,
    lastRunStatus: typeof job.state?.lastRunStatus === 'string' ? job.state.lastRunStatus : null,
    lastDurationMs: typeof job.state?.lastDurationMs === 'number' ? job.state.lastDurationMs : null,
    lastError: typeof job.state?.lastError === 'string' ? job.state.lastError : null,
    consecutiveErrors: typeof job.state?.consecutiveErrors === 'number' ? job.state.consecutiveErrors : null,
    lastDelivered: typeof job.state?.lastDelivered === 'boolean' ? job.state.lastDelivered : null,
    lastDeliveryStatus: typeof job.state?.lastDeliveryStatus === 'string' ? job.state.lastDeliveryStatus : null,
  }
}

function nextLocalRunAt(hour: number, minute: number) {
  const now = new Date()
  const next = new Date(now)
  next.setHours(hour, minute, 0, 0)
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1)
  }
  return next.getTime()
}

async function readDiscordTokenFromConfig() {
  try {
    const cfgPath = path.join(os.homedir(), '.openclaw', 'openclaw.json')
    const raw = await readFile(cfgPath, 'utf8')
    const parsed = JSON.parse(raw) as { channels?: { discord?: { token?: string } } }
    const token = parsed?.channels?.discord?.token
    return typeof token === 'string' && token.trim() ? token.trim() : null
  } catch {
    return null
  }
}

async function resolveDiscordChannelLabels(jobs: CronJobView[]) {
  const channelIds = [...new Set(
    jobs
      .filter((job) => job.deliveryChannel === 'discord')
      .map((job) => String(job.deliveryTo || '').trim().replace(/^channel:/i, '').replace(/^user:/i, ''))
      .filter((id) => /^\d{8,}$/.test(id)),
  )]

  if (channelIds.length === 0) return jobs

  const token = await readDiscordTokenFromConfig()
  if (!token) return jobs

  const labels = new Map<string, string>()

  await Promise.all(channelIds.map(async (id) => {
    try {
      const res = await fetch(`https://discord.com/api/v10/channels/${id}`, {
        headers: { Authorization: `Bot ${token}` },
        cache: 'no-store',
      })
      if (!res.ok) return
      const payload = (await res.json()) as { name?: string; type?: number }
      const channelName = typeof payload?.name === 'string' ? payload.name.trim() : ''
      if (!channelName) return
      const pretty = payload.type === 1 ? `@${channelName}` : `#${channelName}`
      labels.set(id, pretty)
    } catch {
      // ignore network/api errors; fallback to raw channel id
    }
  }))

  return jobs.map((job) => {
    if (job.deliveryChannel !== 'discord') return job
    const target = String(job.deliveryTo || '').trim().replace(/^channel:/i, '').replace(/^user:/i, '')
    if (!target) return job
    const label = labels.get(target)
    if (!label) return job
    return { ...job, deliveryTargetLabel: `${label} (${target})` }
  })
}

function buildLaunchdJobName(label: string) {
  if (label === 'ai.openclaw.workspace-nightly-github-update') return 'Github Backup'
  if (label === 'ai.openclaw.workspace-restic-backup') return 'Workspace Restic Backup'
  if (label === 'ch.tif.content-factory-crawler') return 'Content Crawler'
  if (label === 'ch.tif.monitor-nightly-crawler') return 'Monitor Crawler (Kanton-Rotation)'
  return label
    .replace(/^ai\.openclaw\./, '')
    .replace(/^ch\.tif\./, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

function parseLaunchdStartCalendarInterval(plist: string) {
  const hourMatch = plist.match(/<key>Hour<\/key>\s*<integer>(\d{1,2})<\/integer>/i)
  const minuteMatch = plist.match(/<key>Minute<\/key>\s*<integer>(\d{1,2})<\/integer>/i)
  if (!hourMatch || !minuteMatch) return null

  const hour = Number(hourMatch[1])
  const minute = Number(minuteMatch[1])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null

  const weekdayMatch = plist.match(/<key>Weekday<\/key>\s*<integer>(\d)<\/integer>/i)
  const dayMatch = plist.match(/<key>Day<\/key>\s*<integer>(\d{1,2})<\/integer>/i)
  const monthMatch = plist.match(/<key>Month<\/key>\s*<integer>(\d{1,2})<\/integer>/i)

  const weekday = weekdayMatch ? Number(weekdayMatch[1]) : null
  const day = dayMatch ? Number(dayMatch[1]) : null
  const month = monthMatch ? Number(monthMatch[1]) : null

  let expr = `${minute} ${hour} * * *`
  if (weekday && weekday >= 0 && weekday <= 7) expr = `${minute} ${hour} * * ${weekday}`
  if (day && day >= 1 && day <= 31) expr = `${minute} ${hour} ${day} * *`
  if (month && month >= 1 && month <= 12) expr = `${minute} ${hour} ${day || '*'} ${month} *`

  return { hour, minute, expr }
}

async function buildLaunchdMirrorJobs(): Promise<CronJobRaw[]> {
  if (process.platform !== 'darwin') return [] as CronJobRaw[]

  const launchAgentsDir = path.join(os.homedir(), 'Library', 'LaunchAgents')
  let files: string[] = []
  try {
    files = await readdir(launchAgentsDir)
  } catch {
    return [] as CronJobRaw[]
  }

  const jobs: CronJobRaw[] = []

  for (const fileName of files) {
    if (!fileName.endsWith('.plist')) continue
    if (!fileName.startsWith('ai.openclaw.') && !fileName.startsWith('ch.tif.')) continue

    const filePath = path.join(launchAgentsDir, fileName)
    let plist = ''
    try {
      plist = await readFile(filePath, 'utf8')
    } catch {
      continue
    }

    const labelMatch = plist.match(/<key>Label<\/key>\s*<string>([^<]+)<\/string>/i)
    const label = labelMatch?.[1]?.trim() || fileName.replace(/\.plist$/i, '')

    const schedule = parseLaunchdStartCalendarInterval(plist)
    if (!schedule) continue

    jobs.push({
      id: `launchd:${label}`,
      name: buildLaunchdJobName(label),
      enabled: true,
      source: 'launchd',
      schedule: { kind: 'cron', expr: schedule.expr, tz: 'Europe/Zurich' },
      state: { nextRunAtMs: nextLocalRunAt(schedule.hour, schedule.minute), lastStatus: 'scheduled' },
    })
  }

  return jobs
}

export async function GET() {
  try {
    let jobs: CronJobRaw[] = []

    try {
      const stdout = await cronListJson()
      const parsed = JSON.parse(stdout) as CronJobsFile
      jobs = Array.isArray(parsed.jobs) ? parsed.jobs : []
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (/pairing required|device token mismatch/i.test(message)) {
        jobs = await readCronJobsFileFallback()
      } else {
        throw error
      }
    }

    const launchdJobs = await buildLaunchdMirrorJobs()
    const mergedJobs = [...jobs, ...launchdJobs]

    const normalized = mergedJobs
      .map(toJobView)
      .filter((job) => job.id)
      .sort((a, b) => {
        const aTs = a.nextRunAtMs ?? Number.MAX_SAFE_INTEGER
        const bTs = b.nextRunAtMs ?? Number.MAX_SAFE_INTEGER
        if (aTs !== bTs) return aTs - bTs
        return a.name.localeCompare(b.name, 'de-CH')
      })

    const withChannelLabels = await resolveDiscordChannelLabels(normalized)

    return NextResponse.json({ jobs: withChannelLabels }, { headers: noStoreHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OpenClaw cron list failed'
    return NextResponse.json({ error: `Cron-Jobs konnten nicht geladen werden: ${message}` }, { status: 500, headers: noStoreHeaders })
  }
}
