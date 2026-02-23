import { execFile } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { NextResponse } from 'next/server'

const execFileAsync = promisify(execFile)

const noStoreHeaders = {
  'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
}

function resolveOpenClawBin() {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming')
    return path.join(appData, 'npm', 'openclaw.cmd')
  }

  return 'openclaw'
}

function runtimeEnv() {
  return {
    ...process.env,
    PATH: `${process.env.PATH || ''}:/opt/homebrew/bin:/usr/local/bin`,
    HOME: process.env.HOME || os.homedir(),
  }
}

async function runOpenclaw(args: string[]) {
  const { stdout, stderr } = await execFileAsync(resolveOpenClawBin(), args, {
    env: runtimeEnv(),
    timeout: 45_000,
    windowsHide: true,
    maxBuffer: 2 * 1024 * 1024,
  })

  return { stdout, stderr }
}

async function runShell(command: string, timeout = 120_000) {
  const { stdout, stderr } = await execFileAsync('/bin/bash', ['-lc', command], {
    env: runtimeEnv(),
    timeout,
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  })

  return { stdout, stderr }
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json().catch(() => ({}))) as { action?: string }
    const action = payload?.action || ''

    if (!action) {
      return NextResponse.json({ ok: false, error: 'action missing' }, { status: 400, headers: noStoreHeaders })
    }

    if (action === 'heartbeat-enable') {
      const result = await runOpenclaw(['system', 'heartbeat', 'enable', '--json'])
      return NextResponse.json({ ok: true, action, ...result }, { headers: noStoreHeaders })
    }

    if (action === 'heartbeat-disable') {
      const result = await runOpenclaw(['system', 'heartbeat', 'disable', '--json'])
      return NextResponse.json({ ok: true, action, ...result }, { headers: noStoreHeaders })
    }

    if (action === 'gateway-restart') {
      const result = await runOpenclaw(['gateway', 'restart'])
      return NextResponse.json({ ok: true, action, ...result }, { headers: noStoreHeaders })
    }

    if (action === 'cockpit-self-heal') {
      const result = await runShell(
        'cd /Users/alf/.openclaw/workspace/cockpit && rm -rf .next && npm run build && launchctl kickstart -k gui/$(id -u)/ai.openclaw.cockpit-server',
        240_000,
      )
      return NextResponse.json({ ok: true, action, ...result }, { headers: noStoreHeaders })
    }

    return NextResponse.json({ ok: false, error: `unsupported action: ${action}` }, { status: 400, headers: noStoreHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'control action failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500, headers: noStoreHeaders })
  }
}
