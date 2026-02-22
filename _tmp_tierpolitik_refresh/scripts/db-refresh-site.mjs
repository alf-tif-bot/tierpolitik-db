import { spawnSync } from 'node:child_process'

const steps = [
  ['npm', ['run', 'db:migrate-json']],
  ['npm', ['run', 'db:sync-json']],
  ['npm', ['run', 'home:build-data']],
  ['npm', ['run', 'crawler:build-review']],
  ['npm', ['run', 'crawler:export']],
  ['npm', ['run', 'crawler:build-public']],
]

for (const [cmd, args] of steps) {
  const label = `${cmd} ${args.join(' ')}`
  console.log(`\n▶ ${label}`)
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: true })
  if (res.status !== 0) {
    console.error(`\n✖ Fehler bei: ${label}`)
    process.exit(res.status ?? 1)
  }
}

console.log('\n✅ Website-Artefakte aus DB aktualisiert (JSON + review/public Seiten).')
