import fs from 'node:fs'

const decode = (text) => text.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()

const getTag = (xml, tag) => {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i'))
  return match ? decode(match[1]) : ''
}

const parseItems = (xml) => {
  const chunks = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map((m) => m[0])
  return chunks.map((item) => ({
    title: getTag(item, 'title'),
    summary: getTag(item, 'description'),
    link: getTag(item, 'link'),
    pubDate: getTag(item, 'pubDate') || null,
    guid: getTag(item, 'guid') || null,
  })).filter((x) => x.title && x.link)
}

const slugify = (value) => value.toLowerCase().replace(/https?:\/\//, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

async function fetchRssXml(url, sourceId) {
  const response = await fetch(url)
  if (!response.ok || response.status === 202) {
    throw new Error(`RSS fetch failed (${response.status}) for ${sourceId}`)
  }
  const xml = await response.text()
  if (!xml || !xml.trim()) {
    throw new Error(`RSS fetch returned empty body for ${sourceId}`)
  }
  return xml
}

export function createRssAdapter() {
  return {
    async fetch(source) {
      const candidates = [source.url, ...(source.alternateUrls || [])].filter(Boolean)
      let xml = ''
      let selectedUrl = source.url
      let lastError = null

      for (const candidateUrl of candidates) {
        try {
          xml = await fetchRssXml(candidateUrl, source.id)
          const parsed = parseItems(xml)
          if (parsed.length > 0) {
            selectedUrl = candidateUrl
            break
          }
          lastError = new Error(`RSS parsed without items for ${source.id} (${candidateUrl})`)
        } catch (error) {
          lastError = error
        }
      }

      const fallbackAllowed = source.fallbackMode === 'alwaysOnFailure' || process.env.CRAWLER_ENABLE_FIXTURE_FALLBACK === '1'
      if ((!xml || parseItems(xml).length === 0) && source.fallbackPath && fallbackAllowed) {
        const fallback = new URL(`../../${source.fallbackPath}`, import.meta.url)
        xml = fs.readFileSync(fallback, 'utf8')
      }

      if (!xml) {
        throw lastError || new Error(`RSS fetch failed for ${source.id}`)
      }

      const parsed = parseItems(xml)
      if (parsed.length === 0) {
        throw lastError || new Error(`RSS parsing failed for ${source.id}`)
      }

      const now = new Date().toISOString()
      return parsed.slice(0, 25).map((item) => {
        const date = item.pubDate ? new Date(item.pubDate) : null
        const publishedAt = date && !Number.isNaN(date.getTime()) ? date.toISOString() : null

        return {
          sourceId: source.id,
          sourceUrl: selectedUrl || source.url,
          externalId: slugify(item.guid || item.link),
          title: item.title,
          summary: item.summary,
          body: item.summary,
          publishedAt,
          fetchedAt: now,
          language: 'de',
          score: 0,
          matchedKeywords: [],
          status: 'new',
          reviewReason: '',
        }
      })
    },
  }
}
