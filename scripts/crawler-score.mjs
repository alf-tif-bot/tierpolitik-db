import { runRelevanceFilter } from '../crawler/relevance.mjs'

const result = runRelevanceFilter({ minScore: 0.18, fallbackMin: 0 })
console.log('Relevanz-Filter OK', result)
