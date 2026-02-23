import fs from 'node:fs'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'

const noStoreHeaders = {
  'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
}

const workspaceRoot = path.resolve(process.cwd(), '..')
const maxPathLength = 1_024
const maxContentChars = 300_000

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

function validatePath(rawPath: string) {
  const requested = String(rawPath || '').trim()
  if (!requested) return { error: 'path fehlt', status: 400 as const }
  if (requested.length > maxPathLength) return { error: `path zu lang (max. ${maxPathLength} Zeichen)`, status: 400 as const }
  if (/\u0000/.test(requested)) return { error: 'path enthaelt ungueltige Zeichen', status: 400 as const }
  if (/[\r\n\t]/.test(requested)) return { error: 'path enthaelt ungueltige Steuerzeichen', status: 400 as const }

  const normalizedRequested = requested.replace(/\\/g, '/')
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(normalizedRequested)) {
    return { error: 'URL-Pfade sind nicht erlaubt', status: 400 as const }
  }

  const resolved = path.resolve(normalizedRequested)
  if (!isWithinWorkspace(resolved)) return { error: 'Pfad ausserhalb Workspace nicht erlaubt', status: 403 as const }

  let canonicalPath = resolved
  try {
    canonicalPath = fs.realpathSync.native ? fs.realpathSync.native(resolved) : fs.realpathSync(resolved)
  } catch {
    canonicalPath = resolved
  }

  if (!isWithinWorkspace(canonicalPath)) return { error: 'Symlink-Ziel ausserhalb Workspace nicht erlaubt', status: 403 as const }
  if (!isAllowedTextFile(canonicalPath)) return { error: 'Dateityp nicht zum Speichern erlaubt', status: 400 as const }

  return { canonicalPath }
}

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungueltiges JSON im Request-Body' }, { status: 400, headers: noStoreHeaders })
  }

  const pathCheck = validatePath(body?.path)
  if ('error' in pathCheck) {
    return NextResponse.json({ error: pathCheck.error }, { status: pathCheck.status, headers: noStoreHeaders })
  }

  const content = typeof body?.content === 'string' ? body.content : null
  if (content === null) {
    return NextResponse.json({ error: 'content fehlt oder ist kein Text' }, { status: 400, headers: noStoreHeaders })
  }

  if (content.length > maxContentChars) {
    return NextResponse.json({ error: `content zu lang (max. ${maxContentChars} Zeichen)` }, { status: 400, headers: noStoreHeaders })
  }

  try {
    const stat = fs.statSync(pathCheck.canonicalPath)
    if (!stat.isFile()) {
      return NextResponse.json({ error: 'Keine Datei' }, { status: 400, headers: noStoreHeaders })
    }

    fs.writeFileSync(pathCheck.canonicalPath, content, 'utf8')
    const updated = fs.statSync(pathCheck.canonicalPath)

    return NextResponse.json(
      { ok: true, path: pathCheck.canonicalPath, size: updated.size, mtimeMs: updated.mtimeMs },
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
      { error: `Datei konnte nicht gespeichert werden: ${message}` },
      { status: 500, headers: noStoreHeaders },
    )
  }
}
