import { execSync } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { listTasks } from '@/lib/db'

type DiaryRow = {
  id: string
  title: string
  date: string
  weekday: string
  weatherEmoji: string
  weatherLabel: string
  path: string
  excerpt: string
  content: string
}

function formatDateCH(isoDate: string) {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return isoDate
  return `${m[3]}.${m[2]}.${m[1]}`
}

function pickKeywords(raw: string) {
  const lines = raw.split(/\r?\n/).map((line) => line.trim())
  const bullets = lines
    .filter((line) => line.startsWith('- '))
    .map((line) => line.replace(/^-\s+/, ''))
    .filter(Boolean)

  return bullets.slice(0, 4).join(' · ')
}

function weekdayDE(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1))
  return new Intl.DateTimeFormat('de-CH', { weekday: 'long', timeZone: 'Europe/Zurich' }).format(dt)
}

function inferWeather(raw: string) {
  const t = raw.toLowerCase()
  if (/(regen|nass|schauer|gewitter)/.test(t)) return { emoji: '🌧️', label: 'Regen' }
  if (/(schnee|frost|eis|kalt)/.test(t)) return { emoji: '❄️', label: 'Kalt/Schnee' }
  if (/(sonn|klar|warm|heiss)/.test(t)) return { emoji: '☀️', label: 'Sonnig' }
  if (/(bewölk|wolk|grau)/.test(t)) return { emoji: '☁️', label: 'Bewölkt' }
  return { emoji: '🌤️', label: 'keine Angabe' }
}


function isoDateFromTimestamp(value: string) {
  if (!value) return null
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(dt)
  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value
  if (!year || !month || !day) return null
  return `${year}-${month}-${day}`
}

function collectActivityBulletsByDate() {
  const tasks = listTasks()
  const byDate = new Map<string, string[]>()

  for (const task of tasks) {
    const isoDate = isoDateFromTimestamp(task.updatedAt as string)
    if (!isoDate) continue

    const statusLabel = task.status === 'open'
      ? 'Backlog'
      : task.status === 'doing'
        ? 'In progress'
        : task.status === 'waiting'
          ? 'Review'
          : 'Done'

    const agent = String(task.assignee || 'unknown')
    const bullet = `- ${task.title} (${agent} · ${statusLabel})`
    if (!byDate.has(isoDate)) byDate.set(isoDate, [])
    const list = byDate.get(isoDate)!
    if (!list.includes(bullet)) list.push(bullet)
  }

  try {
    const raw = execSync(`git -C "${process.cwd()}" log --since="45 days ago" --date=short --pretty=format:%ad|%s`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const [date, subjectRaw] = trimmed.split('|')
      const subject = String(subjectRaw || '').trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !subject) continue
      const bullet = `- ${subject} (Commit)`
      if (!byDate.has(date)) byDate.set(date, [])
      const list = byDate.get(date)!
      if (!list.includes(bullet)) list.push(bullet)
    }
  } catch {
    // git history unavailable -> ignore
  }

  return byDate
}

function extractActivityBulletsFromContent(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .slice(0, 20)
}

function mergeTaskSummaryIntoDiaryRows(rows: DiaryRow[]): DiaryRow[] {
  const byDate = collectActivityBulletsByDate()
  const out: DiaryRow[] = rows.map((row) => {
    const bulletsFromActivity = byDate.get(row.date) || []
    const bulletsFromContent = extractActivityBulletsFromContent(row.content)
    const mergedBullets = (bulletsFromActivity.length > 0 ? bulletsFromActivity : bulletsFromContent)
    const activityBullets = mergedBullets.length > 0
      ? mergedBullets
      : ['- Keine erkannten Aktivitäten für diesen Tag.']

    const hasSection = /##\s*Woran wir gearbeitet haben/i.test(row.content)
    const content = hasSection
      ? row.content
      : [
          row.content.trimEnd(),
          '',
          '## Woran wir gearbeitet haben',
          ...activityBullets.slice(0, 20),
          '',
        ].join('\n')

    const excerptSource = activityBullets
      .slice(0, 4)
      .map((line) => line.replace(/^-\s+/, ''))
      .join(' · ')

    return {
      ...row,
      excerpt: excerptSource,
      content,
    }
  })

  const existingDates = new Set(out.map((row) => row.date))
  for (const [date, bullets] of byDate.entries()) {
    if (existingDates.has(date)) continue
    const content = [
      `# Tageszusammenfassung ${formatDateCH(date)}`,
      '',
      '## Woran wir gearbeitet haben',
      ...bullets.slice(0, 20),
      '',
    ].join('\n')
    const weather = inferWeather(content)
    out.push({
      id: `auto-${date}`,
      title: `${formatDateCH(date)} · Auto`,
      date,
      weekday: weekdayDE(date),
      weatherEmoji: weather.emoji,
      weatherLabel: 'aus Aktivitäten erzeugt',
      path: '../diary/auto',
      excerpt: bullets.slice(0, 4).map((line) => line.replace(/^-\s+/, '')).join(' · '),
      content,
    })
  }

  return out
}

const noStoreHeaders = {
  'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
}

function diaryBaseDir() {
  return path.join(process.cwd(), '..', 'diary')
}

export async function GET() {
  try {
    const baseDir = diaryBaseDir()
    const files = await readdir(baseDir).catch(() => [])
    const mdFiles = files.filter((f) => f.toLowerCase().endsWith('.md'))

    const rows: DiaryRow[] = []
    for (const file of mdFiles) {
      const fullPath = path.join(baseDir, file)
      const raw = await readFile(fullPath, 'utf8').catch(() => '')
      if (!raw) continue

      const date = file.replace(/\.md$/i, '')
      const title = formatDateCH(date)
      const excerpt = pickKeywords(raw)
      const weather = inferWeather(raw)

      rows.push({
        id: date,
        title,
        date,
        weekday: weekdayDE(date),
        weatherEmoji: weather.emoji,
        weatherLabel: weather.label,
        path: `../diary/${file}`,
        excerpt,
        content: raw,
      })
    }

    const merged = mergeTaskSummaryIntoDiaryRows(rows)

    merged.sort((a, b) => b.date.localeCompare(a.date))

    return NextResponse.json({ entries: merged }, { headers: noStoreHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tagebuch konnte nicht geladen werden'
    return NextResponse.json({ error: message }, { status: 500, headers: noStoreHeaders })
  }
}
