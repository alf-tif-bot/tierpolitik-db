import fs from 'node:fs'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'

const noStoreHeaders = {
  'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
}

const workspaceRoot = path.resolve(process.cwd(), '..')
const maxChars = 200_000
const maxPathLength = 1_024

function isWithinWorkspace(resolvedPath: string) {
  const relative = path.relative(workspaceRoot, resolvedPath)
  if (!relative) return true

  const normalized = relative.replace(/\\/g, '/')
  return !normalized.startsWith('../') && !path.isAbsolute(relative)
}

function isAllowedTextFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  return ['.md', '.txt', '.json', '.yml', '.yaml', '.ps1', '.sh', '.ts', '.tsx', '.js', '.mjs', '.cjs'].includes(ext)
}

export async function GET(req: NextRequest) {
  const requestedRaw = req.nextUrl.searchParams.get('path')
  const requested = String(requestedRaw || '').trim()
  if (!requested) {
    return NextResponse.json({ error: 'path fehlt' }, { status: 400, headers: noStoreHeaders })
  }

  if (requested.length > maxPathLength) {
    return NextResponse.json({ error: `path zu lang (max. ${maxPathLength} Zeichen)` }, { status: 400, headers: noStoreHeaders })
  }

  if (/\u0000/.test(requested)) {
    return NextResponse.json({ error: 'path enthaelt ungueltige Zeichen' }, { status: 400, headers: noStoreHeaders })
  }

  if (/[\r\n\t]/.test(requested)) {
    return NextResponse.json({ error: 'path enthaelt ungueltige Steuerzeichen' }, { status: 400, headers: noStoreHeaders })
  }

  const normalizedRequested = requested.replace(/\\/g, '/')

  if (/^[a-z][a-z\d+.-]*:\/\//i.test(normalizedRequested)) {
    return NextResponse.json({ error: 'URL-Pfade sind nicht erlaubt' }, { status: 400, headers: noStoreHeaders })
  }

  const resolved = path.resolve(normalizedRequested)

  if (!isWithinWorkspace(resolved)) {
    return NextResponse.json({ error: 'Pfad ausserhalb Workspace nicht erlaubt' }, { status: 403, headers: noStoreHeaders })
  }

  let canonicalPath = resolved
  try {
    canonicalPath = fs.realpathSync.native ? fs.realpathSync.native(resolved) : fs.realpathSync(resolved)
  } catch {
    canonicalPath = resolved
  }

  if (!isWithinWorkspace(canonicalPath)) {
    return NextResponse.json({ error: 'Symlink-Ziel ausserhalb Workspace nicht erlaubt' }, { status: 403, headers: noStoreHeaders })
  }

  if (!isAllowedTextFile(canonicalPath)) {
    return NextResponse.json({ error: 'Dateityp nicht als Text-Vorschau erlaubt' }, { status: 400, headers: noStoreHeaders })
  }

  try {
    const stat = fs.statSync(canonicalPath)
    if (!stat.isFile()) {
      return NextResponse.json({ error: 'Keine Datei' }, { status: 400, headers: noStoreHeaders })
    }

    const maxReadBytes = maxChars * 4 + 4096
    const fd = fs.openSync(canonicalPath, 'r')

    let raw = ''
    try {
      const bytesToRead = Math.max(0, Math.min(stat.size, maxReadBytes))
      const buffer = Buffer.alloc(bytesToRead)
      const bytesRead = fs.readSync(fd, buffer, 0, bytesToRead, 0)
      raw = buffer.subarray(0, bytesRead).toString('utf8')
    } finally {
      fs.closeSync(fd)
    }

    const truncated = stat.size > maxReadBytes || raw.length > maxChars
    const content = truncated ? `${raw.slice(0, maxChars)}\n\n…[gekürzt]` : raw

    return NextResponse.json(
      {
        path: canonicalPath,
        size: stat.size,
        truncated,
        content,
      },
      { headers: noStoreHeaders },
    )
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    const message = err?.message || 'Unbekannter Fehler'

    if (err?.code === 'ENOENT') {
      return NextResponse.json({ error: 'Datei nicht gefunden' }, { status: 404, headers: noStoreHeaders })
    }

    if (err?.code === 'EISDIR') {
      return NextResponse.json({ error: 'Keine Datei' }, { status: 400, headers: noStoreHeaders })
    }

    if (err?.code === 'ENOTDIR') {
      return NextResponse.json({ error: 'Ungueltiger Pfad' }, { status: 400, headers: noStoreHeaders })
    }

    if (err?.code === 'ENAMETOOLONG') {
      return NextResponse.json({ error: 'Pfad ist zu lang' }, { status: 400, headers: noStoreHeaders })
    }

    if (err?.code === 'EACCES' || err?.code === 'EPERM') {
      return NextResponse.json({ error: 'Zugriff auf Datei verweigert' }, { status: 403, headers: noStoreHeaders })
    }

    return NextResponse.json(
      { error: `Datei konnte nicht gelesen werden: ${message}` },
      { status: 500, headers: noStoreHeaders },
    )
  }
}
