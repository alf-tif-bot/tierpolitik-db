import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'

type IdeaRow = {
  id: string
  title: string
  ideaId?: string
  approvedAt?: string
  sourceFile: string
  path: string
}

const noStoreHeaders = {
  'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
}

function extractField(content: string, field: string) {
  const re = new RegExp(`^${field}:\\s*(.+)$`, 'im')
  return content.match(re)?.[1]?.trim()
}

export async function GET() {
  try {
    const baseDir = path.join(process.cwd(), '..', 'agents', 'fundraisier', 'ideen-fundus')
    const files = await readdir(baseDir).catch(() => [])
    const mdFiles = files.filter((f) => f.toLowerCase().endsWith('.md') && f.toLowerCase() !== 'feedback-log.md')

    const rows: IdeaRow[] = []
    for (const file of mdFiles) {
      const fullPath = path.join(baseDir, file)
      const raw = await readFile(fullPath, 'utf8').catch(() => '')
      if (!raw) continue

      const firstHeading = raw.match(/^#\s+(.+)$/m)?.[1]?.trim()
      const title = firstHeading || file.replace(/\.md$/i, '')
      const ideaId = extractField(raw, 'Idea-ID') || file.replace(/\.md$/i, '')
      const approvedAt = extractField(raw, 'ApprovedAt') || undefined

      rows.push({
        id: ideaId,
        title,
        ideaId,
        approvedAt,
        sourceFile: file,
        path: path.relative(process.cwd(), fullPath),
      })
    }

    rows.sort((a, b) => (b.approvedAt || '').localeCompare(a.approvedAt || '') || b.sourceFile.localeCompare(a.sourceFile))

    return NextResponse.json({ ideas: rows }, { headers: noStoreHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fundraising-Ideen konnten nicht geladen werden'
    return NextResponse.json({ error: message }, { status: 500, headers: noStoreHeaders })
  }
}
