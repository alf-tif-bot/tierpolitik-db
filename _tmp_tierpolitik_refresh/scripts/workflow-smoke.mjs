import { runPublish } from '../crawler/workflow.mjs'
import { runRelevanceFilter } from '../crawler/relevance.mjs'

const relevanceResult = runRelevanceFilter({ minScore: 0.25 })
const publishResult = runPublish()
console.log('Workflow OK', { relevanceResult, publishResult })
