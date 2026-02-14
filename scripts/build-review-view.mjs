import fs from 'node:fs'

const dbPath = new URL('../data/crawler-db.json', import.meta.url)
const outPath = new URL('../public/review.html', import.meta.url)
const reviewDataPath = new URL('../data/review-items.json', import.meta.url)
const decisionsPath = new URL('../data/review-decisions.json', import.meta.url)
const fastlaneTagsPath = new URL('../data/review-fastlane-tags.json', import.meta.url)
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
const localDecisions = fs.existsSync(decisionsPath)
  ? JSON.parse(fs.readFileSync(decisionsPath, 'utf8'))
  : {}
const fastlaneTags = fs.existsSync(fastlaneTagsPath)
  ? JSON.parse(fs.readFileSync(fastlaneTagsPath, 'utf8'))
  : {}

const enabledSourceIds = new Set((db.sources || [])
  .filter((s) => s.enabled !== false)
  .map((s) => s.id))

const FIVE_YEARS_MS = 1000 * 60 * 60 * 24 * 365 * 5
const cutoffTs = Date.now() - FIVE_YEARS_MS
const isWithin5Years = (item) => {
  const iso = item?.publishedAt || item?.fetchedAt
  if (!iso) return false
  const ts = Date.parse(String(iso))
  if (Number.isNaN(ts)) return false
  return ts >= cutoffTs
}

const baseReviewItems = [...db.items]
  .filter((item) => enabledSourceIds.has(item.sourceId))
  .filter((item) => {
    const sid = String(item.sourceId || '')
    return sid.startsWith('ch-parliament-') || sid.startsWith('ch-municipal-')
  })
  .filter((item) => ['queued', 'approved', 'published'].includes(item.status))
  .filter((item) => isWithin5Years(item))

const affairKey = (item) => String(item.externalId || '').split('-')[0] || `${item.sourceId}:${item.externalId}`
const entryKey = (item) => `${item.sourceId}:${item.externalId}`
const decidedEntryKeys = new Set(Object.keys(localDecisions || {}))
const decidedAffairKeys = new Set(Object.keys(localDecisions || {})
  .map((id) => {
    const externalId = String(id).split(':')[1] || ''
    return String(externalId).split('-')[0]
  })
  .filter(Boolean))

const langRank = (item) => {
  const src = String(item.sourceId || '').toLowerCase()
  if (src.endsWith('-de')) return 0
  if (src.endsWith('-fr')) return 1
  if (src.endsWith('-it')) return 2
  return 3
}

const statusRank = (item) => {
  const s = String(item.status || '')
  if (s === 'published') return 3
  if (s === 'approved') return 2
  if (s === 'queued' || s === 'new') return 1
  return 0
}

const pickPreferredItem = (next, current) => {
  const betterStatus = statusRank(next) > statusRank(current)
  const betterLang = langRank(next) < langRank(current)
  const betterScore = (next.score ?? 0) > (current.score ?? 0)

  if (betterStatus || (!betterStatus && (betterLang || (!betterLang && betterScore)))) {
    return next
  }
  return current
}

const grouped = new Map()
for (const item of baseReviewItems) {
  const key = affairKey(item)
  const prev = grouped.get(key)
  if (!prev) {
    grouped.set(key, item)
    continue
  }
  grouped.set(key, pickPreferredItem(item, prev))
}

const normalizeForKey = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

const extractBusinessNo = (item) => {
  const title = String(item?.title || '').replace(/\s+/g, ' ').trim()
  const fromTitle = title.match(/\b(\d{2}\.\d{2,4})\b/)
  if (fromTitle?.[1]) return fromTitle[1]

  const rawExternal = String(item?.externalId || '').split('-')[0]
  const numericExternal = rawExternal.match(/^(\d{4})(\d{2,4})$/)
  if (numericExternal) {
    const yy = numericExternal[1].slice(2)
    const suffix = String(Number(numericExternal[2]))
    if (suffix && suffix !== 'NaN') return `${yy}.${suffix}`
  }

  return ''
}

const hardDuplicateKey = (item) => {
  const businessNo = extractBusinessNo(item)
  const normalizedTitle = normalizeForKey(String(item?.title || '').replace(/\b\d{2}\.\d{2,4}\b/g, ''))

  if (businessNo && normalizedTitle) return `hard:${businessNo}|${normalizedTitle}`
  if (businessNo) return `hard:${businessNo}`
  return `id:${item.sourceId}:${item.externalId}`
}

const hardGrouped = new Map()
for (const item of grouped.values()) {
  const key = hardDuplicateKey(item)
  const prev = hardGrouped.get(key)
  if (!prev) {
    hardGrouped.set(key, item)
    continue
  }
  hardGrouped.set(key, pickPreferredItem(item, prev))
}

const isHighConfidenceReview = (item) => {
  const reason = String(item.reviewReason || '').toLowerCase()
  const score = Number(item.score || 0)
  const queued = item.status === 'queued' || item.status === 'new'
  if (!queued) return false
  if (reason.includes('feedback-negative-only') || reason.includes('noise-without-anchor')) return false

  const hasStrongRule = reason.includes('[anchor+score]') || reason.includes('[anchor2+support]') || reason.includes('[feedback-recall]')
  const hasAnchorSignal = /anchor=(?!-)/.test(reason)
  return hasStrongRule && hasAnchorSignal && score >= 0.78
}

const reviewItems = [...hardGrouped.values()]
  .sort((a, b) => {
    const aPending = (a.status === 'queued' || a.status === 'new') ? 1 : 0
    const bPending = (b.status === 'queued' || b.status === 'new') ? 1 : 0
    if (bPending !== aPending) return bPending - aPending

    const aFast = isHighConfidenceReview(a) ? 1 : 0
    const bFast = isHighConfidenceReview(b) ? 1 : 0
    if (bFast !== aFast) return bFast - aFast

    const scoreDelta = Number(b.score || 0) - Number(a.score || 0)
    if (Math.abs(scoreDelta) > 0.0001) return scoreDelta

    const aTs = Date.parse(String(a.publishedAt || a.fetchedAt || '')) || 0
    const bTs = Date.parse(String(b.publishedAt || b.fetchedAt || '')) || 0
    return bTs - aTs
  })

const sourceMap = new Map((db.sources || []).map((s) => [s.id, s.label]))

const esc = (v = '') => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
// Status-Summen werden clientseitig aus den aktuell sichtbaren Zeilen berechnet.

const isValidHttpUrl = (value = '') => {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

const resolveOriginalUrl = (item) => {
  if (isValidHttpUrl(item.sourceUrl)) return item.sourceUrl

  if (item.sourceId?.startsWith('ch-parliament-business-')) {
    const affairId = String(item.externalId || '').split('-')[0]
    if (/^\d+$/.test(affairId)) {
      return `https://www.parlament.ch/de/ratsbetrieb/suche-curia-vista/geschaeft?AffairId=${affairId}`
    }
  }

  return ''
}

const clean = (v = '') => String(v).replace(/\s+/g, ' ').trim()

const isGenericStatusSummary = (text = '') => {
  const low = clean(text).toLowerCase()
  return (
    low.includes('stellungnahme zum vorstoss liegt vor')
    || low.includes('beratung in kommission')
    || low.includes('erledigt')
    || low.includes('fin des discussions en commission')
  )
}

const summarizeForReview = (item) => {
  const title = clean(item.title)
  const summary = clean(item.summary)
  const reason = String(item.reviewReason || '')

  const stance = (reason.match(/stance=([^·]+)/)?.[1] || 'neutral/unklar').trim()
  const anchor = (reason.match(/anchor=([^·]+)/)?.[1] || '').trim().replaceAll('|', ', ')
  const support = (reason.match(/support=([^·]+)/)?.[1] || '').trim().replaceAll('|', ', ')

  if (summary && !isGenericStatusSummary(summary)) return summary

  const topicHint = anchor && anchor !== '-' ? anchor : support && support !== '-' ? support : 'allgemeine Tierpolitik'
  const stanceLabel = stance === 'pro-tierschutz'
    ? 'stellt eher einen positiven Bezug zum Tierschutz her'
    : stance === 'tierschutzkritisch'
      ? 'kann aus Tierschutzsicht kritisch sein'
      : 'hat einen indirekten bzw. unklaren Tierbezug'

  return `Kurzfassung: Das Geschäft behandelt ${topicHint}. Einordnung: Es ${stanceLabel}.`
}

const humanizeReason = (reason = '') => {
  if (!reason) return '-'
  const text = String(reason)

  const rule = (text.match(/\[(.*?)\]/)?.[1] || '').trim()
  const score = (text.match(/score=([0-9.]+)/)?.[1] || '').trim()
  const stance = (text.match(/stance=([^·]+)/)?.[1] || '').trim()
  const anchor = (text.match(/anchor=([^·]+)/)?.[1] || '').trim()
  const support = (text.match(/support=([^·]+)/)?.[1] || '').trim()
  const people = (text.match(/people=([^·]+)/)?.[1] || '').trim()
  const noise = (text.match(/noise=([^·]+)/)?.[1] || '').trim()

  const ruleMap = {
    'anchor+score': 'Klare Tier-Relevanz (Schlüsselbegriffe + Score erfüllt)',
    'anchor2+support': 'Mehrere starke Tier-Begriffe mit zusätzlichem Kontext',
    'whitelist+theme': 'Thematisch relevant und von priorisiertem Parlamentsprofil',
    'missing-anchor': 'Keine klaren Tier-Schlüsselbegriffe gefunden',
    'below-threshold': 'Tierbezug vorhanden, aber Relevanz aktuell zu schwach',
  }

  const toList = (v) => v && v !== '-' ? v.split('|').map((x) => x.trim()).filter(Boolean) : []
  const anchorList = toList(anchor)
  const supportList = toList(support).filter((x) => !anchorList.includes(x))
  const peopleList = toList(people)

  const stanceMap = {
    'pro-tierschutz': 'pro Tierschutz',
    'tierschutzkritisch': 'tierschutzkritisch',
    'neutral/unklar': 'neutral / unklar',
  }

  const parts = []
  if (stance) parts.push(`<div><strong>Einordnung:</strong> ${esc(stanceMap[stance] || stance)}</div>`)
  if (rule) parts.push(`<div><strong>Bewertung:</strong> ${esc(ruleMap[rule] || rule)}</div>`)
  if (anchorList.length) parts.push(`<div><strong>Tier-Begriffe:</strong> ${esc(anchorList.join(', '))}</div>`)
  if (supportList.length) parts.push(`<div><strong>Kontext:</strong> ${esc(supportList.join(', '))}</div>`)
  if (peopleList.length) parts.push(`<div><strong>Priorisierte Profile:</strong> ${esc(peopleList.join(', '))}</div>`)
  if (noise && noise !== '-') parts.push(`<div><strong>Störsignale:</strong> ${esc(noise.replaceAll('|', ', '))}</div>`)
  if (score) parts.push(`<div><strong>Score:</strong> ${esc(score)}</div>`)

  return parts.length ? parts.join('') : esc(text)
}

const fastLaneItems = reviewItems.filter((item) => {
  if (!isHighConfidenceReview(item)) return false
  if (decidedEntryKeys.has(entryKey(item))) return false
  if (decidedAffairKeys.has(affairKey(item))) return false
  return true
})

const fastLaneRows = fastLaneItems.map((item) => {
  const id = `${item.sourceId}:${item.externalId}`
  const scoreValue = Number(item.score || 0)
  const isTaggedFastlane = Boolean(fastlaneTags[id]?.fastlane)
  return `<div class="fastlane-card" data-id="${esc(id)}" data-fastlane-tagged="${isTaggedFastlane ? '1' : '0'}">
    <div class="fastlane-head">
      <strong>${esc(item.title)}</strong>
      <span class="fastlane-score">${scoreValue.toFixed(2)}</span>
    </div>
    <div class="fastlane-actions">
      <button onclick="setDecision(this,'${esc(id)}','approved')">Approve</button>
      <button onclick="setDecision(this,'${esc(id)}','rejected')">Reject</button>
      <button class="tag-btn" data-tag-btn="${esc(id)}" onclick="toggleFastlaneTag(this,'${esc(id)}')">${isTaggedFastlane ? '⭐ Fastlane' : '☆ Fastlane'}</button>
      <a class="orig-link" href="${esc(resolveOriginalUrl(item) || '#')}" target="_blank" rel="noopener noreferrer">Original</a>
    </div>
  </div>`
}).join('')

const rows = reviewItems.map((item) => {
  const fastLane = isHighConfidenceReview(item)
  const id = `${item.sourceId}:${item.externalId}`
  const isPending = item.status === 'queued' || item.status === 'new'
  const pendingBadge = isPending ? '<strong class="pending">offen</strong>' : '<span class="historic">historisch</span>'
  const sourceLabel = esc(sourceMap.get(item.sourceId) || item.sourceId)
  const entryType = item.sourceId === 'user-input' || item.sourceId === 'user-feedback' ? 'User-Feedback' : 'Crawler'
  const scoreValue = Number(item.score || 0)
  const priorityLabel = fastLane ? 'fast-lane' : (scoreValue >= 0.8 ? 'hoch' : scoreValue >= 0.55 ? 'mittel' : 'niedriger')
  const sourceUrl = resolveOriginalUrl(item)
  const isTaggedFastlane = Boolean(fastlaneTags[id]?.fastlane)
  const originalLink = sourceUrl
    ? `<a class="orig-link" href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">Original-Vorstoss öffnen</a>`
    : '<span class="muted">kein gültiger Link</span>'

  return `
<tr data-id="${esc(id)}" data-status="${esc(item.status)}" data-fastlane-tagged="${isTaggedFastlane ? '1' : '0'}" class="${fastLane ? 'row-fastlane' : ''}">
<td>
  <strong>${esc(item.title)}</strong><br>
  <small>${esc(summarizeForReview(item))}</small><br>
  ${originalLink}
</td>
<td>${entryType}</td>
<td>
  <div>${sourceLabel}</div>
  <small class="muted">${esc(item.sourceId)}</small>
</td>
<td>${scoreValue.toFixed(2)}<br><small class="muted">Priorität: ${priorityLabel}</small>${fastLane ? '<br><small class="fast-lane">⚡ Sehr wahrscheinlich relevant</small>' : ''}${isTaggedFastlane ? '<br><small class="fast-lane">⭐ von dir als Fastlane markiert</small>' : ''}</td>
<td>${esc((item.matchedKeywords || []).join(', '))}</td>
<td>${esc(item.status)} (${pendingBadge})</td>
<td><small>${humanizeReason(item.reviewReason || '-')}</small></td>
<td>
<button onclick="setDecision(this,'${esc(id)}','approved')">Approve</button>
<button onclick="setDecision(this,'${esc(id)}','rejected')">Reject</button>
<button class="tag-btn" data-tag-btn="${esc(id)}" onclick="toggleFastlaneTag(this,'${esc(id)}')">${isTaggedFastlane ? '⭐ Fastlane' : '☆ Fastlane'}</button>
</td>
</tr>`
}).join('')

const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Crawler Review</title>
<style>
  body{font-family:Inter,Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:24px}
  .wrap{max-width:1280px;margin:0 auto}
  h1{margin:0 0 8px}
  p{color:#a9bfd8}
  code{background:#1f2937;border:1px solid #334155;color:#dbeafe;padding:1px 5px;border-radius:6px}
  .links{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}
  .links a{display:inline-block;border:1px solid rgba(255,255,255,.18);padding:6px 10px;border-radius:999px;text-decoration:none;color:#dbeafe}
  .status{margin:10px 0 14px;color:#bfdbfe}
  button{margin-right:6px;border:1px solid #4b5563;border-radius:8px;padding:5px 9px;background:#22364f;color:#e8effa;cursor:pointer}
  button:hover{background:#2b4565}
  .export{margin:10px 0 12px}
  table{width:100%;border-collapse:collapse;background:#111827;border:1px solid #334155;border-radius:12px;overflow:hidden}
  td,th{border-bottom:1px solid #1f2937;padding:10px;vertical-align:top;text-align:left}
  th{background:#1b2433;color:#dbeafe;font-weight:700;position:sticky;top:0}
  tr:hover td{background:#172133}
  .orig-link{display:inline-block;margin-top:6px;color:#93c5fd}
  .muted{color:#94a3b8}
  .pending{color:#f59e0b}
  .historic{color:#94a3b8}
  .fast-lane{color:#fbbf24;font-weight:700}
  .row-fastlane td{background:rgba(251,191,36,.08)}
  .fastlane-wrap{margin:12px 0 16px;padding:12px;border:1px solid #475569;border-radius:10px;background:#111827}
  .fastlane-wrap h2{font-size:16px;margin:0 0 10px;color:#fde68a}
  .fastlane-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px}
  .fastlane-card{border:1px solid #334155;border-radius:10px;padding:10px;background:#0b1220}
  .fastlane-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
  .fastlane-score{font-weight:700;color:#fde68a}
  .fastlane-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:8px}
  @media (max-width: 760px){
    body{padding:12px}
    td,th{padding:8px;font-size:13px}
    .fastlane-wrap{position:sticky;top:0;z-index:5}
  }
</style>
</head>
<body>
  <main class="wrap">
    <h1>Review-Ansicht</h1>
    <p>Es werden nur relevante Einträge gezeigt (queued/approved/published). Wenn ein Vorstoss in mehreren Sprachen vorliegt, wird bevorzugt die <strong>deutsche Version</strong> angezeigt. Approve/Reject blendet den Eintrag sofort aus; mit <strong>Entscheidungen exportieren</strong> + <code>npm run crawler:apply-review</code> wird es in JSON/DB übernommen.</p>
    <p class="status" id="status-summary">Status-Summen (sichtbar): queued=0, approved=0, published=0</p>
    <nav class="links"><a href="/">Zur App</a><a href="/user-input.html">User-Input</a></nav>
    <p class="export"><button onclick="exportDecisions()">Entscheidungen exportieren</button> <button onclick="toggleDecided()" id="toggle-decided">Bereits bearbeitete anzeigen</button></p>
    <p id="decision-status" class="muted" aria-live="polite"></p>
    ${fastLaneRows ? `<section class="fastlane-wrap">
      <h2>⚡ Fast-Lane</h2>
      <div class="fastlane-grid">${fastLaneRows}</div>
    </section>` : ''}
    <table>
      <thead>
        <tr>
          <th>Titel</th>
          <th>Typ</th>
          <th>Quelle</th>
          <th>Score</th>
          <th>Treffer</th>
          <th>Status</th>
          <th>Warum relevant / nicht</th>
          <th>Aktion</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="8">Keine Einträge.</td></tr>'}</tbody>
    </table>
  </main>
<script>
const key='tierpolitik.review';
const uiKey='tierpolitik.review.ui';
const fastlaneTagKey='tierpolitik.review.fastlaneTags';
const initialFastlaneTags=${JSON.stringify(fastlaneTags)};
const read=()=>JSON.parse(localStorage.getItem(key)||'{}');
const write=(v)=>localStorage.setItem(key,JSON.stringify(v,null,2));
const readFastlaneTags=()=>{
  const local = JSON.parse(localStorage.getItem(fastlaneTagKey)||'{}');
  return { ...initialFastlaneTags, ...local };
};
const writeFastlaneTags=(v)=>localStorage.setItem(fastlaneTagKey,JSON.stringify(v));
const readUi=()=>JSON.parse(localStorage.getItem(uiKey)||'{}');
const writeUi=(v)=>localStorage.setItem(uiKey,JSON.stringify(v));

let showDecided = Boolean(readUi().showDecided);

function updateStatusSummary(){
  const stats = { queued: 0, approved: 0, published: 0 }
  let visibleRows = 0
  document.querySelectorAll('tr[data-id]').forEach((row)=>{
    const hidden = row.style.display === 'none'
    if (hidden) return
    visibleRows += 1
    const status = row.getAttribute('data-status')
    if (status && status in stats) stats[status] += 1
  })
  const el = document.getElementById('status-summary')
  if (el) {
    el.textContent = 'Status-Summen (sichtbar): queued=' + stats.queued + ', approved=' + stats.approved + ', published=' + stats.published
    if (visibleRows === 0) el.textContent += ' · keine offenen Einträge'
  }
}

function hideDecidedRows(){
  const decisions = read();
  const rows = [...document.querySelectorAll('tr[data-id]')]
  const decidedById = {}

  rows.forEach((row)=>{
    const id = row.getAttribute('data-id');
    if (!id) return
    const status = row.getAttribute('data-status') || ''
    const serverDecided = status !== 'queued' && status !== 'new'
    const localDecided = Boolean(decisions[id])
    const decided = serverDecided || localDecided
    decidedById[id] = decided
    row.style.display = (!showDecided && decided) ? 'none' : ''
  });

  document.querySelectorAll('.fastlane-card[data-id]').forEach((card)=>{
    const id = card.getAttribute('data-id')
    if (!id) return
    const decided = Boolean(decidedById[id]) || Boolean(decisions[id])
    card.style.display = decided ? 'none' : ''
  })

  const btn = document.getElementById('toggle-decided')
  if (btn) btn.textContent = showDecided ? 'Bearbeitete ausblenden' : 'Bereits bearbeitete anzeigen'
  updateStatusSummary();
}

function toggleDecided(){
  showDecided = !showDecided
  writeUi({ showDecided })
  hideDecidedRows()
}

function renderFastlaneTagButton(id){
  const tags = readFastlaneTags();
  const isTagged = Boolean(tags[id]?.fastlane);
  document.querySelectorAll('[data-tag-btn="' + id + '"]').forEach((btn)=>{
    btn.textContent = isTagged ? '⭐ Fastlane' : '☆ Fastlane';
  });
}

async function toggleFastlaneTag(btn,id){
  const tags = readFastlaneTags();
  const next = !Boolean(tags[id]?.fastlane);
  const taggedAt = new Date().toISOString();
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/.netlify/functions/review-fastlane-tag', {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({ id, fastlane: next, taggedAt }),
    });
    if(!res.ok){
      const txt = await res.text();
      throw new Error(txt || 'Fastlane tag API failed');
    }
  } catch(err) {
    alert('Konnte Fastlane-Tag nicht speichern.');
    console.error(err);
    if (btn) btn.disabled = false;
    return;
  }

  tags[id] = { fastlane: next, taggedAt };
  writeFastlaneTags(tags);
  renderFastlaneTagButton(id);

  const row = document.querySelector('tr[data-id="' + id + '"]');
  if (row) row.setAttribute('data-fastlane-tagged', next ? '1' : '0');
  const card = document.querySelector('.fastlane-card[data-id="' + id + '"]');
  if (card) card.setAttribute('data-fastlane-tagged', next ? '1' : '0');

  if (btn) btn.disabled = false;
}

async function setDecision(btn,id,status){
  const decidedAt = new Date().toISOString();
  const statusEl = document.getElementById('decision-status');
  if (statusEl) statusEl.textContent = 'Speichere Entscheidung…';

  if (btn) btn.disabled = true;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const res = await fetch('/.netlify/functions/review-decision', {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({ id, status, decidedAt }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if(!res.ok){
      const txt = await res.text();
      throw new Error(txt || 'Decision API failed');
    }
  } catch(err) {
    const msg = String(err?.message || err || 'unbekannter Fehler').slice(0, 220)
    if (statusEl) statusEl.textContent = 'Fehler beim Speichern: ' + msg;
    alert('Konnte Entscheidung nicht serverseitig speichern.\\n' + msg);
    console.error(err);
    if (btn) btn.disabled = false;
    return;
  }

  const s=read();
  s[id]={status,decidedAt};
  write(s);

  const row = document.querySelector('tr[data-id="' + id + '"]');
  if (row) {
    row.setAttribute('data-status', status)
    row.style.opacity = '0.72'
    if (!showDecided) row.style.display='none'
  }

  const card = document.querySelector('.fastlane-card[data-id="' + id + '"]');
  if (card) card.style.display = 'none'
  updateStatusSummary();
  if (statusEl) statusEl.textContent = 'Entscheidung gespeichert.';
}

function exportDecisions(){
  const blob=new Blob([JSON.stringify(read(),null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='review-decisions.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

for (const id of Object.keys(readFastlaneTags())) renderFastlaneTagButton(id)
hideDecidedRows();
</script>
</body>
</html>`

fs.writeFileSync(outPath, html)
fs.writeFileSync(reviewDataPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  total: reviewItems.length,
  ids: reviewItems.map((item) => `${item.sourceId}:${item.externalId}`),
}, null, 2))
console.log(`Review-Ansicht gebaut: ${outPath.pathname} (${reviewItems.length} Eintraege)`)
