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

export function createRssAdapter() {
  return {
    async fetch(source) {
      let xml = ''
      try {
        const response = await fetch(source.url)
        if (!response.ok) throw new Error(`RSS fetch failed (${response.status}) for ${source.id}`)
        xml = await response.text()
      } catch (error) {
        const allowFallback = process.env.CRAWLER_ENABLE_FIXTURE_FALLBACK === '1'
        if (!source.fallbackPath || !allowFallback) throw error
        const fallback = new URL(`../../${source.fallbackPath}`, import.meta.url)
        xml = fs.readFileSync(fallback, 'utf8')
      }
      let parsed = parseItems(xml)
      if (parsed.length === 0 && source.fallbackPath && process.env.CRAWLER_ENABLE_FIXTURE_FALLBACK === '1') {
        const fallback = new URL(`../../${source.fallbackPath}`, import.meta.url)
        parsed = parseItems(fs.readFileSync(fallback, 'utf8'))
      }

      const now = new Date().toISOString()
      return parsed.slice(0, 25).map((item) => {
        const date = item.pubDate ? new Date(item.pubDate) : null
        const publishedAt = date && !Number.isNaN(date.getTime()) ? date.toISOString() : null

        return {
          sourceId: source.id,
          sourceUrl: source.url,
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
