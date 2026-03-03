import os from 'node:os'
import { NextResponse } from 'next/server'

const noStoreHeaders = {
  'cache-control': 'no-store, no-cache, max-age=0, must-revalidate',
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

function localIPv4s() {
  const nets = os.networkInterfaces()
  const values: string[] = []

  for (const entries of Object.values(nets)) {
    for (const net of entries || []) {
      if (!net) continue
      if (net.family !== 'IPv4') continue
      if (net.internal) continue
      values.push(net.address)
    }
  }

  return [...new Set(values)]
}

export async function GET() {
  return jsonNoStore({
    hostname: os.hostname(),
    ips: localIPv4s(),
  })
}
