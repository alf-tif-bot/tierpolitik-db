import { createRssAdapter } from './rssAdapter.mjs'

const rss = createRssAdapter()

export const adapters = {
  'ch-parlament-news': rss,
  'blv-news': rss,
  'bundesrat-news': rss,
}
