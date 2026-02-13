import fs from 'node:fs'

const dbPath = new URL('../data/crawler-db.json', import.meta.url)
const outPath = new URL('../public/review.html', import.meta.url)
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'))

const enabledSourceIds = new Set((db.sources || [])
  .filter((s) => s.enabled !== false)
  .map((s) => s.id))

const baseReviewItems = [...db.items]
  .filter((item) => enabledSourceIds.has(item.sourceId))
  .filter((item) => String(item.sourceId || '').startsWith('ch-parliament-'))
  .filter((item) => ['queued', 'approved', 'published'].includes(item.status))

const affairKey = (item) => String(item.externalId || '').split('-')[0] || `${item.sourceId}:${item.externalId}`
const langRank = (item) => {
  const src = String(item.sourceId || '').toLowerCase()
  if (src.endsWith('-de')) return 0
  if (src.endsWith('-fr')) return 1
  if (src.endsWith('-it')) return 2
  return 3
}

const grouped = new Map()
for (const item of baseReviewItems) {
  const key = affairKey(item)
  const prev = grouped.get(key)
  if (!prev) {
    grouped.set(key, item)
    continue
  }

  const betterLang = langRank(item) < langRank(prev)
  const betterScore = (item.score ?? 0) > (prev.score ?? 0)
  if (betterLang || (!betterLang && betterScore)) {
    grouped.set(key, item)
  }
}

const reviewItems = [...grouped.values()]
  .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))

const sourceMap = new Map((db.sources || []).map((s) => [s.id, s.label]))

const esc = (v = '') => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const counts = reviewItems.reduce((acc, item) => {
  acc[item.status] = (acc[item.status] || 0) + 1
  return acc
}, {})

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

const humanizeReason = (reason = '') => {
  if (!reason) return '-'
  const text = String(reason)

  const rule = (text.match(/\[(.*?)\]/)?.[1] || '').trim()
  const score = (text.match(/score=([0-9.]+)/)?.[1] || '').trim()
  const anchor = (text.match(/anchor=([^·]+)/)?.[1] || '').trim()
  const support = (text.match(/support=([^·]+)/)?.[1] || '').trim()
  const noise = (text.match(/noise=([^·]+)/)?.[1] || '').trim()

  const ruleMap = {
    'anchor+score': 'Klare Tier-Relevanz (Schlüsselbegriffe + Score erfüllt)',
    'anchor2+support': 'Mehrere starke Tier-Begriffe mit zusätzlichem Kontext',
    'missing-anchor': 'Keine klaren Tier-Schlüsselbegriffe gefunden',
    'below-threshold': 'Tierbezug vorhanden, aber Relevanz aktuell zu schwach',
  }

  const toList = (v) => v && v !== '-' ? v.split('|').map((x) => x.trim()).filter(Boolean) : []
  const anchorList = toList(anchor)
  const supportList = toList(support).filter((x) => !anchorList.includes(x))

  const parts = []
  if (rule) parts.push(`<div><strong>Bewertung:</strong> ${esc(ruleMap[rule] || rule)}</div>`)
  if (anchorList.length) parts.push(`<div><strong>Tier-Begriffe:</strong> ${esc(anchorList.join(', '))}</div>`)
  if (supportList.length) parts.push(`<div><strong>Kontext:</strong> ${esc(supportList.join(', '))}</div>`)
  if (noise && noise !== '-') parts.push(`<div><strong>Störsignale:</strong> ${esc(noise.replaceAll('|', ', '))}</div>`)
  if (score) parts.push(`<div><strong>Score:</strong> ${esc(score)}</div>`)

  return parts.length ? parts.join('') : esc(text)
}

const rows = reviewItems.map((item) => {
  const id = `${item.sourceId}:${item.externalId}`
  const isPending = item.status === 'queued' || item.status === 'new'
  const pendingBadge = isPending ? '<strong class="pending">offen</strong>' : '<span class="historic">historisch</span>'
  const sourceLabel = esc(sourceMap.get(item.sourceId) || item.sourceId)
  const sourceUrl = resolveOriginalUrl(item)
  const originalLink = sourceUrl
    ? `<a class="orig-link" href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">Original-Vorstoss öffnen</a>`
    : '<span class="muted">kein gültiger Link</span>'

  return `
<tr data-id="${esc(id)}">
<td>
  <strong>${esc(item.title)}</strong><br>
  <small>${esc(item.summary || '')}</small><br>
  ${originalLink}
</td>
<td>
  <div>${sourceLabel}</div>
  <small class="muted">${esc(item.sourceId)}</small>
</td>
<td>${(item.score ?? 0).toFixed(2)}</td>
<td>${esc((item.matchedKeywords || []).join(', '))}</td>
<td>${esc(item.status)} (${pendingBadge})</td>
<td><small>${humanizeReason(item.reviewReason || '-')}</small></td>
<td>
<button onclick="setDecision(this,'${esc(id)}','approved')">Approve</button>
<button onclick="setDecision(this,'${esc(id)}','rejected')">Reject</button>
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
</style>
</head>
<body>
  <main class="wrap">
    <h1>Review-Ansicht</h1>
    <p>Es werden nur relevante Einträge gezeigt (queued/approved/published). Wenn ein Vorstoss in mehreren Sprachen vorliegt, wird bevorzugt die <strong>deutsche Version</strong> angezeigt. Approve/Reject blendet den Eintrag sofort aus; mit <strong>Entscheidungen exportieren</strong> + <code>npm run crawler:apply-review</code> wird es in JSON/DB übernommen.</p>
    <p class="status">Status-Summen (sichtbar): queued=${counts.queued || 0}, approved=${counts.approved || 0}, published=${counts.published || 0}</p>
    <nav class="links"><a href="/">Zur App</a><a href="/user-input.html">User-Input</a></nav>
    <p class="export"><button onclick="exportDecisions()">Entscheidungen exportieren</button></p>
    <table>
      <thead>
        <tr>
          <th>Titel</th>
          <th>Quelle</th>
          <th>Score</th>
          <th>Treffer</th>
          <th>Status</th>
          <th>Warum relevant / nicht</th>
          <th>Aktion</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="7">Keine Einträge.</td></tr>'}</tbody>
    </table>
  </main>
<script>
const key='tierpolitik.review';
const read=()=>JSON.parse(localStorage.getItem(key)||'{}');
const write=(v)=>localStorage.setItem(key,JSON.stringify(v,null,2));

function hideDecidedRows(){
  const decisions = read();
  document.querySelectorAll('tr[data-id]').forEach((row)=>{
    const id = row.getAttribute('data-id');
    if (id && decisions[id]) row.style.display = 'none';
  });
}

async function setDecision(btn,id,status){
  const decidedAt = new Date().toISOString();

  try {
    const res = await fetch('/.netlify/functions/review-decision', {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({ id, status, decidedAt })
    });

    if(!res.ok){
      const txt = await res.text();
      throw new Error(txt || 'Decision API failed');
    }
  } catch(err) {
    alert('Konnte Entscheidung nicht serverseitig speichern. Bitte später erneut versuchen.');
    console.error(err);
    return;
  }

  const s=read();
  s[id]={status,decidedAt};
  write(s);

  const row = btn?.closest('tr[data-id]');
  if (row) row.style.display='none';
}

function exportDecisions(){
  const blob=new Blob([JSON.stringify(read(),null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='review-decisions.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

hideDecidedRows();
</script>
</body>
</html>`

fs.writeFileSync(outPath, html)
console.log(`Review-Ansicht gebaut: ${outPath.pathname} (${reviewItems.length} Eintraege)`)
