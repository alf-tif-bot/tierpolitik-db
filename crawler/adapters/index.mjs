import { createRssAdapter } from './rssAdapter.mjs'
import { createParliamentOdataAdapter } from './parliamentOdataAdapter.mjs'

const rss = createRssAdapter()
const parliamentOdata = createParliamentOdataAdapter()

export const adapters = {
  rss,
  parliamentOdata,
}
