import fs from 'node:fs'

const filePath = new URL('../data/user-input.json', import.meta.url)
const [title, url = 'https://tierimfokus.ch'] = process.argv.slice(2)

if (!title) {
  console.error('Nutzung: node scripts/user-input-submit.mjs "Titel" "https://quelle"')
  process.exit(1)
}

const list = JSON.parse(fs.readFileSync(filePath, 'utf8'))
list.push({
  id: `user-${Date.now()}`,
  title,
  url,
  summary: '',
  createdAt: new Date().toISOString(),
  processed: false,
})
fs.writeFileSync(filePath, JSON.stringify(list, null, 2))
console.log('User-Input gespeichert')
