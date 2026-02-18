const parseIntSafe = (value, fallback) => {
  const n = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const RETRYABLE_HTTP_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])

const detectHttpStatus = (message = '') => {
  const match = String(message).match(/\((\d{3})\)/)
  return match ? Number(match[1]) : null
}

const isAbortError = (error) => {
  if (!error) return false
  if (error.name === 'AbortError' || error.code === 'ABORT_ERR') return true
  return /abort/i.test(String(error.message || ''))
}

const isRetryableError = (error, { parentAborted = false } = {}) => {
  if (!error) return false
  if (parentAborted) return false

  const status = detectHttpStatus(error.message)
  if (status && !RETRYABLE_HTTP_STATUS.has(status)) return false
  if (status && RETRYABLE_HTTP_STATUS.has(status)) return true

  const msg = String(error.message || '').toLowerCase()
  if (msg.includes('kein adapter')) return false
  if (msg.includes('invalid')) return false
  if (msg.includes('parse')) return false

  return isAbortError(error)
    || msg.includes('timeout')
    || msg.includes('timed out')
    || msg.includes('econnreset')
    || msg.includes('enotfound')
    || msg.includes('network')
    || msg.includes('fetch failed')
}

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(signal.reason || new Error('Aborted before delay'))
    return
  }
  const timeout = setTimeout(() => {
    cleanup()
    resolve()
  }, ms)
  const onAbort = () => {
    cleanup()
    reject(signal.reason || new Error('Aborted during delay'))
  }
  const cleanup = () => {
    clearTimeout(timeout)
    if (signal) signal.removeEventListener('abort', onAbort)
  }
  if (signal) signal.addEventListener('abort', onAbort, { once: true })
})

const mergeSignals = (...signals) => {
  const valid = signals.filter(Boolean)
  if (!valid.length) return undefined
  const controller = new AbortController()

  const abortFrom = (source) => {
    if (!controller.signal.aborted) controller.abort(source?.reason)
  }

  for (const signal of valid) {
    if (signal.aborted) {
      abortFrom(signal)
      break
    }
    signal.addEventListener('abort', () => abortFrom(signal), { once: true })
  }

  return controller.signal
}

const runWithTimeout = async (runner, { timeoutMs, parentSignal, timeoutLabel }) => {
  const controller = new AbortController()
  let timer

  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const timeoutError = new Error(`${timeoutLabel} timeout after ${timeoutMs}ms`)
      controller.abort(timeoutError)
      reject(timeoutError)
    }, timeoutMs)
  })

  try {
    return await Promise.race([
      runner(mergeSignals(parentSignal, controller.signal)),
      timeoutPromise,
    ])
  } finally {
    clearTimeout(timer)
  }
}

const matchSourceId = (sourceId = '', candidates = []) => {
  const id = String(sourceId || '').toLowerCase()
  return candidates.some((needle) => id.includes(needle))
}

export const resolveSourcePolicy = (source, runtimeDefaults = {}) => {
  const sourceId = source?.id || 'unknown-source'
  const adapterKey = source?.adapter || source?.type || 'unknown-adapter'

  const timeoutDefault = parseIntSafe(runtimeDefaults.timeoutMs, 45000)
  const retriesDefault = parseIntSafe(runtimeDefaults.retries, 1)
  const backoffDefault = parseIntSafe(runtimeDefaults.backoffMs, 1200)

  let timeoutMs = timeoutDefault
  let retries = retriesDefault

  if (adapterKey === 'parliamentOdata') {
    timeoutMs = Math.max(75000, timeoutMs)
    retries = Math.max(retries, 2)
  }

  if (adapterKey === 'parliamentOdataV2') {
    timeoutMs = Math.max(90000, timeoutMs)
    retries = Math.max(retries, 2)
  }

  if (adapterKey === 'cantonalPortal') {
    timeoutMs = 60000
    retries = Math.max(retries, 2)
  }

  if (matchSourceId(sourceId, ['business-de', 'motions-de', 'postulates-de'])) {
    timeoutMs = Math.max(timeoutMs, 85000)
    retries = Math.max(retries, 3)
  }

  if (matchSourceId(sourceId, ['parliament-affairs-v2'])) {
    timeoutMs = Math.max(timeoutMs, 100000)
    retries = Math.max(retries, 3)
  }

  if (matchSourceId(sourceId, ['cantonal-portal-core', 'cantonal-portal-priority'])) {
    timeoutMs = 60000
    retries = Math.max(retries, 2)
  }

  const sourceTimeoutOption = parseIntSafe(source?.options?.sourceTimeoutMs, timeoutMs)
  const sourceRetriesOption = parseIntSafe(source?.options?.retries, retries)

  return {
    timeoutMs: sourceTimeoutOption,
    retries: sourceRetriesOption,
    backoffMs: parseIntSafe(source?.options?.retryBackoffMs, backoffDefault),
    backoffFactor: Number(source?.options?.retryBackoffFactor || runtimeDefaults.backoffFactor || 2),
    backoffMaxMs: parseIntSafe(source?.options?.retryBackoffMaxMs, runtimeDefaults.backoffMaxMs || 12000),
  }
}

export const executeSourceFetch = async ({
  source,
  adapter,
  parentSignal,
  policy,
  onStart,
  onRetry,
  onDone,
  onFail,
}) => {
  const startedAt = Date.now()
  const attempts = Math.max(1, policy.retries + 1)
  const sourceId = source?.id || 'unknown-source'
  const adapterKey = source?.adapter || source?.type || 'unknown-adapter'

  if (onStart) onStart({ sourceId, adapterKey, timeoutMs: policy.timeoutMs, retries: policy.retries })

  let lastError = null
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const rows = await runWithTimeout(
        (signal) => adapter.fetch(source, { signal, timeoutMs: policy.timeoutMs }),
        { timeoutMs: policy.timeoutMs, parentSignal, timeoutLabel: sourceId },
      )

      const durationMs = Date.now() - startedAt
      if (onDone) onDone({ sourceId, adapterKey, fetched: rows.length, durationMs, attempt })
      return { ok: true, rows, durationMs, attempts: attempt }
    } catch (error) {
      lastError = error
      const durationMs = Date.now() - startedAt
      const parentAborted = Boolean(parentSignal?.aborted)

      const retryable = attempt < attempts && isRetryableError(error, { parentAborted })
      if (!retryable) {
        if (onFail) onFail({ sourceId, adapterKey, error, durationMs, attempt })
        return { ok: false, rows: [], durationMs, attempts: attempt, error }
      }

      const rawBackoff = policy.backoffMs * (policy.backoffFactor ** (attempt - 1))
      const jitter = 1 + ((Math.random() * 0.3) - 0.15)
      const backoffMs = Math.max(250, Math.min(policy.backoffMaxMs, Math.round(rawBackoff * jitter)))

      if (onRetry) onRetry({ sourceId, adapterKey, error, attempt, nextAttempt: attempt + 1, backoffMs })
      await sleep(backoffMs, parentSignal)
    }
  }

  return { ok: false, rows: [], durationMs: Date.now() - startedAt, attempts, error: lastError || new Error(`Unbekannter Fehler (${sourceId})`) }
}

export const readCollectEnv = (defaults = {}) => ({
  timeoutMs: parseIntSafe(process.env.CRAWLER_COLLECT_TIMEOUT_MS || process.env.CRAWLER_SOURCE_TIMEOUT_MS, defaults.timeoutMs || 45000),
  concurrency: parseIntSafe(process.env.CRAWLER_COLLECT_CONCURRENCY, defaults.concurrency || 4),
  retries: parseIntSafe(process.env.CRAWLER_COLLECT_RETRIES, defaults.retries || 1),
  backoffMs: parseIntSafe(process.env.CRAWLER_COLLECT_RETRY_BACKOFF_MS, defaults.backoffMs || 1200),
  backoffMaxMs: parseIntSafe(process.env.CRAWLER_COLLECT_RETRY_BACKOFF_MAX_MS, defaults.backoffMaxMs || 12000),
  backoffFactor: Number(process.env.CRAWLER_COLLECT_RETRY_BACKOFF_FACTOR || defaults.backoffFactor || 2),
})
