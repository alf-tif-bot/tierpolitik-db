const PARTY_ALIASES: Array<[RegExp, string]> = [
  [/^sozialdemokratische\s+fraktion$/i, 'SP'],
  [/^sp(\s|$)/i, 'SP'],
  [/^gr[èéeüu]ne\s+schweiz$/iu, 'Grüne'],
  [/^gruene\s+schweiz$/i, 'Grüne'],
  [/^grune\s+schweiz$/i, 'Grüne'],
  [/^grüne(\s+fraktion)?$/iu, 'Grüne'],
  [/^die\s+mitte(\s+fraktion)?$/i, 'Die Mitte'],
  [/^fdp(\.|\s|$)|^fdp\.die\s+liberalen/i, 'FDP'],
  [/^svp(\s|$)|^schweizerische\s+volkspartei/i, 'SVP'],
  [/^glp(\s|$)|^grünliberale/i, 'GLP'],
  [/^evp(\s|$)|^evangelische\s+volkspartei/i, 'EVP'],
  [/^csp(\s|$)/i, 'CSP'],
]

export const normalizePartyName = (party?: string): string => {
  const raw = String(party || '').trim()
  if (!raw) return ''

  const normalized = raw.normalize('NFKC')
  for (const [pattern, label] of PARTY_ALIASES) {
    if (pattern.test(normalized)) return label
  }
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
    const first = parts[0]
    const last = parts[parts.length - 1]
    const likelyParticles = new Set(['de', 'del', 'della', 'di', 'du', 'von', 'van', 'la', 'le'])
    const firstLooksParticle = likelyParticles.has(first.toLowerCase()) || first[0] === first[0]?.toLowerCase()
    const lastLooksFirstName = /^[A-ZÄÖÜ][a-zäöüàâéèêîïôûùç-]+$/.test(last)

    if (firstLooksParticle && lastLooksFirstName) {
      return `${last} ${parts.slice(0, -1).join(' ')}`.trim()
    }
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
