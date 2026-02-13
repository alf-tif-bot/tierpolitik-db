import fs from 'node:fs'

const dbPath = new URL('../data/crawler-db.json', import.meta.url)
const outPath = new URL('../public/crawler.html', import.meta.url)
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'))

const items = [...db.items]
  .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

const esc = (v = '') => String(v)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')

const statusLabel = (status) => {
  if (status === 'queued') return 'Neu / in Review'
  if (status === 'approved') return 'Freigegeben'
  if (status === 'published') return 'Publiziert'
  if (status === 'rejected') return 'Ausgeschlossen'
  return status
}

const rows = items.map((item) => {
  const link = esc(item.sourceUrl || '')
  const title = esc(item.title)
  const summary = esc(item.summary || item.body || '')
  const when = new Date(item.publishedAt).toLocaleString('de-CH')
  return `
  <article class="item">
    <div class="top">
      <span class="status">${statusLabel(item.status)}</span>
      <time>${when}</time>
    </div>
    <h3>${title}</h3>
    <p>${summary}</p>
    <a href="${link}" target="_blank" rel="noopener noreferrer">Original-Link öffnen</a>
  </article>`
}).join('\n')

const html = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Crawler Resultate – Tierpolitik</title>
  <style>
    body{font-family:Inter,Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:24px}
    .wrap{max-width:980px;margin:0 auto}
    h1{margin:0 0 6px}
    .sub{color:#94a3b8;margin:0 0 16px}
    .links{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px}
    .links a{color:#cbd5f5;text-decoration:none;border:1px solid rgba(255,255,255,.15);padding:6px 10px;border-radius:999px}
    .item{background:#111827;border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:14px 14px 12px;margin-bottom:10px}
    .top{display:flex;justify-content:space-between;gap:10px;font-size:.85rem;color:#94a3b8}
    .status{color:#cbd5f5}
    h3{margin:8px 0 6px;font-size:1.05rem}
    p{margin:0 0 8px;color:#cbd5e1;line-height:1.4}
    a{color:#93c5fd}
  </style>
</head>
<body>
  <main class="wrap">
    <h1>Crawler Resultate (MVP)</h1>
    <p class="sub">Öffentliche Übersicht der erkannten Vorstösse inkl. Quelle und Kurzbeschreibung.</p>
    <nav class="links">
      <a href="/review.html">Zur Review-Ansicht</a>
      <a href="/">Zur App</a>
    </nav>
    ${rows || '<p>Keine Resultate vorhanden.</p>'}
  </main>
</body>
</html>`

fs.writeFileSync(outPath, html)
console.log(`Crawler-Seite gebaut: ${outPath.pathname}`)
