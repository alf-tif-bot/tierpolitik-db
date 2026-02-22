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

type CronJobRaw = {
  id?: string
  name?: string
  enabled?: boolean
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
  }
}

type CronJobsFile = {
  jobs?: CronJobRaw[]
}

function formatSchedule(job: CronJobRaw) {
  const schedule = job.schedule
  if (!schedule) return 'unbekannt'

  if (schedule.kind === 'every' && typeof schedule.everyMs === 'number') {
    const minutes = Math.round(schedule.everyMs / 60_000)
    if (minutes < 60) return `every ${minutes}m`

    const hours = Number((schedule.everyMs / 3_600_000).toFixed(2))
    return `every ${hours}h`
  }

  if (schedule.kind === 'cron' && schedule.expr) {
    return schedule.tz ? `cron ${schedule.expr} @ ${schedule.tz}` : `cron ${schedule.expr}`
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

function toJobView(job: CronJobRaw) {
  const nextRunAtMs = typeof job.state?.nextRunAtMs === 'number' ? job.state.nextRunAtMs : null

  return {
    id: String(job.id || ''),
    name: String(job.name || 'Ohne Namen'),
    enabled: job.enabled !== false,
    scheduleLabel: formatSchedule(job),
    status: String(job.state?.lastStatus || 'idle'),
    nextRunAtMs,
    nextRunAtIso: nextRunAtMs ? new Date(nextRunAtMs).toISOString() : null,
    lastRunAtMs: typeof job.state?.lastRunAtMs === 'number' ? job.state.lastRunAtMs : null,
  }
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

    const normalized = jobs
      .map(toJobView)
      .filter((job) => job.id)
      .sort((a, b) => {
        const aTs = a.nextRunAtMs ?? Number.MAX_SAFE_INTEGER
        const bTs = b.nextRunAtMs ?? Number.MAX_SAFE_INTEGER
        if (aTs !== bTs) return aTs - bTs
        return a.name.localeCompare(b.name, 'de-CH')
      })

    return NextResponse.json({ jobs: normalized }, { headers: noStoreHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OpenClaw cron list failed'
    return NextResponse.json({ error: `Cron-Jobs konnten nicht geladen werden: ${message}` }, { status: 500, headers: noStoreHeaders })
  }
}
