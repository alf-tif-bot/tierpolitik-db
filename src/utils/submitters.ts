export const normalizePartyName = (party?: string): string => {
  const raw = String(party || '').trim()
  if (!raw) return ''

  const normalized = raw
    .normalize('NFKC')
    .replace(/GR[ÈÉEÜU]NE\s+Schweiz/giu, 'Grüne')
    .replace(/Gruene\s+Schweiz/giu, 'Grüne')
    .replace(/GRUNE\s+Schweiz/giu, 'Grüne')

  return normalized
}

export const normalizeSubmitterName = (name?: string): string => {
  const raw = String(name || '').trim()
  if (!raw) return ''

  if (raw.includes(',')) {
    const [last, first] = raw.split(',').map((v) => v.trim())
    if (first && last) return `${first} ${last}`
  }

  const parts = raw.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const firstName = parts[parts.length - 1]
    const lastName = parts.slice(0, -1).join(' ')
    return `${firstName} ${lastName}`.trim()
  }

  return raw
}

export const formatSubmitterDisplay = (name?: string, party?: string): string => {
  const normalizedName = normalizeSubmitterName(name)
  const normalizedParty = normalizePartyName(party)

  if (!normalizedName) return normalizedParty ? `(${normalizedParty})` : ''
  if (!normalizedParty || /^unbekannt$/i.test(normalizedParty)) return normalizedName
  return `${normalizedName} (${normalizedParty})`
}
