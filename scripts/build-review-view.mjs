import fs from 'node:fs'

const dbPath = new URL('../data/crawler-db.json', import.meta.url)
const outPath = new URL('../public/review.html', import.meta.url)
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'))

const reviewItems = [...db.items]
  .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))

const esc = (v = '') => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const counts = reviewItems.reduce((acc, item) => {
  acc[item.status] = (acc[item.status] || 0) + 1
  return acc
}, {})

const rows = reviewItems.map((item) => {
  const id = `${item.sourceId}:${item.externalId}`
  const isPending = item.status === 'queued' || item.status === 'new'
  const pendingBadge = isPending ? '<strong style="color:#b45309">offen</strong>' : 'historisch'
  return `
<tr>
<td><strong>${esc(item.title)}</strong><br><small>${esc(item.summary || '')}</small></td>
<td>${esc(item.sourceId)}</td>
<td>${(item.score ?? 0).toFixed(2)}</td>
<td>${esc((item.matchedKeywords || []).join(', '))}</td>
<td>${esc(item.status)} (${pendingBadge})</td>
<td><small>${esc(item.reviewReason || '-')}</small></td>
<td>
<button onclick="setDecision('${esc(id)}','approved')">Approve</button>
<button onclick="setDecision('${esc(id)}','rejected')">Reject</button>
</td>
</tr>`
}).join('')

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Crawler Review</title>
<style>body{font-family:Arial,sans-serif;padding:24px;max-width:1200px;margin:0 auto}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border:1px solid #ddd;padding:8px;vertical-align:top}button{margin-right:6px}code{background:#f3f3f3;padding:2px 4px}.links{display:flex;gap:8px;flex-wrap:wrap}.links a{display:inline-block;border:1px solid #ddd;padding:6px 10px;border-radius:999px;text-decoration:none;color:#222}</style></head>
<body>
<h1>Review-Ansicht</h1>
<p>Vollansicht aller Stati (new/queued/approved/rejected/published). Entscheidungen als JSON exportieren und danach mit <code>npm run crawler:apply-review</code> in die DB übernehmen.</p>
<p>Status-Summen: new=${counts.new || 0}, queued=${counts.queued || 0}, approved=${counts.approved || 0}, rejected=${counts.rejected || 0}, published=${counts.published || 0}</p>
<nav class="links"><a href="/crawler.html">Zur Crawler-Ansicht</a><a href="/">Zur App</a></nav>
<p><button onclick="exportDecisions()">Entscheidungen exportieren</button></p>
<table><thead><tr><th>Titel</th><th>Quelle</th><th>Score</th><th>Treffer</th><th>Status</th><th>Warum relevant / nicht</th><th>Aktion</th></tr></thead><tbody>${rows || '<tr><td colspan="7">Keine Einträge.</td></tr>'}</tbody></table>
<script>
const key='tierpolitik.review';
const read=()=>JSON.parse(localStorage.getItem(key)||'{}');
const write=(v)=>localStorage.setItem(key,JSON.stringify(v,null,2));
function setDecision(id,status){const s=read();s[id]={status,decidedAt:new Date().toISOString()};write(s);alert('Gespeichert: '+id+' -> '+status)}
function exportDecisions(){const blob=new Blob([JSON.stringify(read(),null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='review-decisions.json';a.click();URL.revokeObjectURL(a.href)}
</script>
</body></html>`

fs.writeFileSync(outPath, html)
console.log(`Review-Ansicht gebaut: ${outPath.pathname} (${reviewItems.length} Eintraege)`)