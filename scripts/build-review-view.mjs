import fs from 'node:fs'

const dbPath = new URL('../data/crawler-db.json', import.meta.url)
const outPath = new URL('../public/review.html', import.meta.url)
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
const reviewItems = db.items.filter((item) => item.status === 'queued' || item.status === 'rejected')

const rows = reviewItems
  .map((item) => `\n<tr>\n<td>${item.title}</td>\n<td>${item.sourceId}</td>\n<td>${item.score.toFixed(2)}</td>\n<td>${item.matchedKeywords.join(', ')}</td>\n<td>\n<button onclick="setDecision('${item.sourceId}:${item.externalId}','approved')">Approve</button>\n<button onclick="setDecision('${item.sourceId}:${item.externalId}','rejected')">Reject</button>\n</td>\n</tr>\n`)
  .join('')

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Crawler Review</title>
<style>body{font-family:Arial,sans-serif;padding:24px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}button{margin-right:6px}code{background:#f3f3f3;padding:2px 4px}</style></head>
<body>
<h1>Review-Ansicht (MVP)</h1>
<p>Entscheidungen werden lokal im Browser gespeichert (<code>localStorage.tierpolitik.review</code>) und können exportiert werden.</p>
<button onclick="exportDecisions()">Entscheidungen exportieren</button>
<table><thead><tr><th>Titel</th><th>Quelle</th><th>Score</th><th>Treffer</th><th>Aktion</th></tr></thead><tbody>${rows}</tbody></table>
<script>
const key='tierpolitik.review';
const read=()=>JSON.parse(localStorage.getItem(key)||'{}');
const write=(v)=>localStorage.setItem(key,JSON.stringify(v,null,2));
function setDecision(id,status){const s=read();s[id]={status,decidedAt:new Date().toISOString()};write(s);alert('Gespeichert: '+id+' -> '+status)}
function exportDecisions(){const blob=new Blob([JSON.stringify(read(),null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='review-decisions.json';a.click();URL.revokeObjectURL(a.href)}
</script>
</body></html>`

fs.writeFileSync(outPath, html)
console.log(`Review-Ansicht gebaut: ${outPath.pathname}`)
