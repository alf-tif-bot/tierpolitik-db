import { execFile } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
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
  payload?: { message?: string }
}

type CronJobsFile = {
  jobs?: CronJobRaw[]
}

function runtimeEnv() {
  return {
    ...process.env,
    PATH: `${process.env.PATH || ''}:/opt/homebrew/bin:/usr/local/bin`,
    HOME: process.env.HOME || os.homedir(),
  }
}

async function runOpenclaw(args: string[]) {
  const { stdout, stderr } = await execFileAsync('openclaw', args, {
    env: runtimeEnv(),
    timeout: 45_000,
    windowsHide: true,
    maxBuffer: 2 * 1024 * 1024,
  })
  return { stdout, stderr }
}

function applyKnownMessageFixes(message: string) {
  const home = process.env.HOME || os.homedir()
  let next = message

  // Fix common write-path mistakes seen in cron payloads
  next = next.replaceAll('~/.openclaw/workspace', `${home}/.openclaw/workspace`)
  next = next.replaceAll('~/.openclaw/', `${home}/.openclaw/`)

  return next
}

async function patchCronPayloadMessage(jobId: string) {
  const jobsPath = path.join(os.homedir(), '.openclaw', 'cron', 'jobs.json')
  const raw = await readFile(jobsPath, 'utf8')
  const parsed = JSON.parse(raw) as CronJobsFile & Record<string, unknown>
  const jobs = Array.isArray(parsed.jobs) ? parsed.jobs : []

  let changed = false

  for (const job of jobs) {
    if (String(job.id || '') !== jobId) continue
    const current = typeof job.payload?.message === 'string' ? job.payload.message : ''
    if (!current) continue
    const fixed = applyKnownMessageFixes(current)
    if (fixed !== current) {
      if (!job.payload) job.payload = {}
      job.payload.message = fixed
      changed = true
    }
  }

  if (changed) {
    await writeFile(jobsPath, `${JSON.stringify({ ...parsed, jobs }, null, 2)}\n`, 'utf8')
  }

  return changed
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json().catch(() => ({}))) as { jobId?: string }
    const jobId = String(payload?.jobId || '').trim()

    if (!jobId) {
      return NextResponse.json({ ok: false, error: 'jobId missing' }, { status: 400, headers: noStoreHeaders })
    }

    const payloadPatched = await patchCronPayloadMessage(jobId)

    const runResult = await runOpenclaw(['cron', 'run', jobId])

    return NextResponse.json({ ok: true, jobId, payloadPatched, ...runResult }, { headers: noStoreHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cron-Fix fehlgeschlagen'
    return NextResponse.json({ ok: false, error: message }, { status: 500, headers: noStoreHeaders })
  }
}
