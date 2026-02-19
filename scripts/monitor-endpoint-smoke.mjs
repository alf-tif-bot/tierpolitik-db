const base = process.env.MONITOR_API_BASE || 'http://127.0.0.1:8787'

const tests = [
  { name: 'GET /healthz', path: '/healthz', method: 'GET', expected: [200] },
  { name: 'GET /home-data', path: '/home-data', method: 'GET', expected: [200] },
  { name: 'POST /feedback-submit invalid', path: '/feedback-submit', method: 'POST', body: { title: '' }, expected: [400] },
  { name: 'POST /review-decision invalid', path: '/review-decision', method: 'POST', body: { id: 'bad', status: 'queued' }, expected: [400] },
  { name: 'POST /review-fastlane-tag invalid', path: '/review-fastlane-tag', method: 'POST', body: { id: 'bad', fastlane: true }, expected: [400] },
]

const results = []
for (const test of tests) {
  const res = await fetch(`${base}${test.path}`, {
    method: test.method,
    headers: { 'content-type': 'application/json' },
    body: test.body ? JSON.stringify(test.body) : undefined,
  })
  const text = await res.text()
  const ok = test.expected.includes(res.status)
  results.push({ ...test, status: res.status, ok, body: text.slice(0, 160) })
}

const failed = results.filter((r) => !r.ok)
for (const row of results) {
  console.log(`${row.ok ? 'PASS' : 'FAIL'} ${row.name} -> ${row.status}`)
}
if (failed.length) {
  console.error(JSON.stringify(failed, null, 2))
  process.exit(1)
}
