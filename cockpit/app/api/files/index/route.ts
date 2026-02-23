import fs from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'

const noStoreHeaders = {
  'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
}

const workspaceRoot = path.resolve(process.cwd(), '..')
const maxEntries = 600
const allowedExt = new Set(['.md', '.txt', '.json', '.yml', '.yaml', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.ps1', '.sh'])

type IndexEntry = {
  name: string
  path: string
  relPath: string
  group: string
}

function relToWorkspace(filePath: string) {
  return path.relative(workspaceRoot, filePath).replace(/\\/g, '/')
}

function walkDir(dir: string, group: string, entries: IndexEntry[], depth = 0) {
  if (entries.length >= maxEntries) return
  if (depth > 5) return

  let dirEntries: fs.Dirent[] = []
  try {
    dirEntries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const item of dirEntries) {
    if (entries.length >= maxEntries) return
    if (item.name.startsWith('.git')) continue
    if (item.name === 'node_modules' || item.name === 'dist' || item.name === '.next') continue

    const abs = path.join(dir, item.name)

    if (item.isDirectory()) {
      walkDir(abs, group, entries, depth + 1)
      continue
    }

    if (!item.isFile()) continue
    const ext = path.extname(item.name).toLowerCase()
    if (!allowedExt.has(ext)) continue

    entries.push({
      name: item.name,
      path: abs.replace(/\\/g, '/'),
      relPath: relToWorkspace(abs),
      group,
    })
  }
}

export async function GET() {
  const entries: IndexEntry[] = []

  const roots = [
    { dir: workspaceRoot, group: 'Workspace Core', shallow: true },
    { dir: path.join(workspaceRoot, 'memory'), group: 'Memory (Daily)', shallow: false },
    { dir: path.join(workspaceRoot, 'tierpolitik-vorstoesse-db'), group: 'Tierpolitik Monitor', shallow: false },
    { dir: path.join(workspaceRoot, 'Physio'), group: 'Health (Physio)', shallow: false },
    { dir: path.join(workspaceRoot, 'cockpit'), group: 'Cockpit', shallow: false },
  ]

  for (const root of roots) {
    if (!fs.existsSync(root.dir)) continue

    if (root.shallow) {
      const list = fs.readdirSync(root.dir, { withFileTypes: true })
      for (const item of list) {
        if (entries.length >= maxEntries) break
        if (!item.isFile()) continue
        const ext = path.extname(item.name).toLowerCase()
        if (!allowedExt.has(ext)) continue
        const abs = path.join(root.dir, item.name)
        entries.push({
          name: item.name,
          path: abs.replace(/\\/g, '/'),
          relPath: relToWorkspace(abs),
          group: root.group,
        })
      }
    } else {
      walkDir(root.dir, root.group, entries)
    }
  }

  entries.sort((a, b) => a.group.localeCompare(b.group) || a.relPath.localeCompare(b.relPath))

  return NextResponse.json({ entries }, { headers: noStoreHeaders })
}
