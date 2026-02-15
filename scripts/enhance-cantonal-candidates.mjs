import fs from 'node:fs'

const configPath = new URL('../crawler/config.cantonal-sources.json', import.meta.url)
const cantons = JSON.parse(fs.readFileSync(configPath, 'utf8'))

const addMap = {
  FR: ['https://fr.ratsinfomanagement.net'],
  GR: ['https://gr.ratsinfomanagement.net'],
  JU: ['https://ju.ratsinfomanagement.net'],
  LU: ['https://lu.ratsinfomanagement.net'],
  NE: ['https://ne.ratsinfomanagement.net'],
  NW: ['https://nw.ratsinfomanagement.net'],
  OW: ['https://ow.ratsinfomanagement.net'],
  SH: ['https://sh.ratsinfomanagement.net'],
  SO: ['https://so.ratsinfomanagement.net'],
  TG: ['https://tg.ratsinfomanagement.net'],
  UR: ['https://ur.ratsinfomanagement.net'],
  VS: ['https://vs.ratsinfomanagement.net'],
  ZG: ['https://zg.ratsinfomanagement.net'],
}

let touched = 0
for (const entry of cantons) {
  const extras = addMap[String(entry.canton || '').toUpperCase()]
  if (!extras?.length) continue
  const current = Array.isArray(entry.urlCandidates) ? entry.urlCandidates : []
  const merged = [...new Set([...current, ...extras])]
  if (merged.length !== current.length) {
    entry.urlCandidates = merged
    touched += 1
  }
}

fs.writeFileSync(configPath, JSON.stringify(cantons, null, 2) + '\n')
console.log('Enhanced cantonal candidates', { touched })
