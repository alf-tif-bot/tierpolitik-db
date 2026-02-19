import http from 'node:http'
import { URL } from 'node:url'
import { handler as homeDataHandler } from '../handlers/home-data.mjs'
import { handler as feedbackSubmitHandler } from '../handlers/feedback-submit.mjs'
import { handler as reviewDecisionHandler } from '../handlers/review-decision.mjs'
import { handler as reviewFastlaneTagHandler } from '../handlers/review-fastlane-tag.mjs'

const routes = new Map([
  ['/home-data', homeDataHandler],
  ['/feedback-submit', feedbackSubmitHandler],
  ['/review-decision', reviewDecisionHandler],
  ['/review-fastlane-tag', reviewFastlaneTagHandler],
])

const port = Number(process.env.MONITOR_API_PORT || 8787)
const host = process.env.MONITOR_API_HOST || '127.0.0.1'

const collectBody = async (req) => {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

const toEvent = async (req) => {
  const body = await collectBody(req)
  const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : String(v || '')]))
  return {
    httpMethod: req.method || 'GET',
    headers,
    body,
    rawUrl: req.url || '/',
  }
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  if (reqUrl.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: true, service: 'monitor-api', time: new Date().toISOString() }))
    return
  }

  const routeHandler = routes.get(reqUrl.pathname)
  if (!routeHandler) {
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: false, error: `unknown endpoint: ${reqUrl.pathname}` }))
    return
  }

  try {
    const event = await toEvent(req)
    const result = await routeHandler(event)
    const statusCode = Number(result?.statusCode || 200)
    const headers = result?.headers || { 'content-type': 'application/json; charset=utf-8' }
    res.writeHead(statusCode, headers)
    res.end(result?.body || '')
  } catch (error) {
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: false, error: error?.message || 'monitor-api-server failure' }))
  }
})

server.listen(port, host, () => {
  console.log(`[monitor-api] listening on http://${host}:${port}`)
})
