export function getHashId(): string | null {
  const hash = window.location.hash.replace('#', '').trim()
  return hash.length ? hash : null
}

export function setHashId(id: string): void {
  window.location.hash = id
}

export function clearHashId(): void {
  history.replaceState(null, '', window.location.pathname + window.location.search)
}
