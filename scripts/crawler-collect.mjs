import fs from 'node:fs'
import path from 'node:path'
import { adapters } from '../crawler/adapters/index.mjs'
import { runCollect } from '../crawler/workflow.mjs'

const HEALTH_PATH = path.resolve(process.cwd(), 'data/crawler-collect-health.json')
const ALERT_LOG_PATH = path.resolve(process.cwd(), 'data/crawler-alerts.log')
const FEDERAL_SOURCE_RX = /^ch-parliament-/
const TIMEOUT_RX = /timeout|timed out/i

const readHealth = () => {
  try {
    if (!fs.existsSync(HEALTH_PATH)) return { federalTimeoutStreak: 0, lastAlertAt: null }
    return JSON.parse(fs.readFileSync(HEALTH_PATH, 'utf8'))
  } catch {
    return { federalTimeoutStreak: 0, lastAlertAt: null }
  }
}

const appendAlertLog = (line) => {
  fs.appendFileSync(ALERT_LOG_PATH, `${line}\n`, 'utf8')
}

const result = await runCollect({ adapters })

const healthBefore = readHealth()
const federalStats = (result.sourceStats || []).filter((s) => FEDERAL_SOURCE_RX.test(String(s.sourceId || '')))
const timedOutFederal = federalStats.filter((s) => s.ok === false && TIMEOUT_RX.test(String(s.reason || '')))
const hasFederalTimeout = timedOutFederal.length > 0

const nextStreak = hasFederalTimeout ? Number(healthBefore.federalTimeoutStreak || 0) + 1 : 0
const nowIso = new Date().toISOString()
const healthAfter = {
  federalTimeoutStreak: nextStreak,
  lastRunAt: nowIso,
  lastFederalTimeoutCount: timedOutFederal.length,
  lastFederalSourcesChecked: federalStats.length,
  lastAlertAt: healthBefore.lastAlertAt || null,
}

if (nextStreak >= 2) {
  const detail = timedOutFederal.map((s) => `${s.sourceId}: ${s.reason}`).join(' | ')
  const alertLine = `[crawler-alert] FEDERAL_TIMEOUT_STREAK=${nextStreak} timedOut=${timedOutFederal.length} details=${detail}`
  console.error(alertLine)
  appendAlertLog(`${nowIso} ${alertLine}`)
  healthAfter.lastAlertAt = nowIso
}

fs.writeFileSync(HEALTH_PATH, JSON.stringify(healthAfter, null, 2))

console.log('Collect OK', result)
console.log('Collect Health', healthAfter)
