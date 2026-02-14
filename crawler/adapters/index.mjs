import { createRssAdapter } from './rssAdapter.mjs'
import { createParliamentOdataAdapter } from './parliamentOdataAdapter.mjs'
import { createParliamentOdataV2Adapter } from './parliamentOdataV2Adapter.mjs'
import { createCantonRegistryAdapter } from './cantonRegistryAdapter.mjs'
import { createCantonalPortalAdapter } from './cantonalPortalAdapter.mjs'
import { createMunicipalParliamentAdapter } from './municipalParliamentAdapter.mjs'

const rss = createRssAdapter()
const parliamentOdata = createParliamentOdataAdapter()
const parliamentOdataV2 = createParliamentOdataV2Adapter()
const cantonRegistry = createCantonRegistryAdapter()
const cantonalPortal = createCantonalPortalAdapter()
const municipalParliament = createMunicipalParliamentAdapter()

export const adapters = {
  rss,
  parliamentOdata,
  parliamentOdataV2,
  cantonRegistry,
  cantonalPortal,
  municipalParliament,
}
