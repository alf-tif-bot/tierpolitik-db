export function toFrenchQuotes(value: string): string {
  const text = String(value || '')
  // Replace straight double-quoted segments with French guillemets
  return text.replace(/"([^"]+)"/g, '«$1»')
}
