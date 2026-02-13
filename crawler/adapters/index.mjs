import { createRssAdapter } from './rssAdapter.mjs'
import { createParliamentOdataAdapter } from './parliamentOdataAdapter.mjs'
import { createParliamentOdataV2Adapter } from './parliamentOdataV2Adapter.mjs'
import { createCantonRegistryAdapter } from './cantonRegistryAdapter.mjs'

const rss = createRssAdapter()
const parliamentOdata = createParliamentOdataAdapter()
const parliamentOdataV2 = createParliamentOdataV2Adapter()
const cantonRegistry = createCantonRegistryAdapter()

export const adapters = {
  rss,
  parliamentOdata,
  parliamentOdataV2,
  cantonRegistry,
}
