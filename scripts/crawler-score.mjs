import { runRelevanceFilter } from '../crawler/relevance.mjs'

const result = runRelevanceFilter({ minScore: 0.5 })
console.log('Relevanz-Filter OK', result)
