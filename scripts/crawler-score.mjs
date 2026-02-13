import { runRelevanceFilter } from '../crawler/relevance.mjs'

const result = runRelevanceFilter({ minScore: 0.34, fallbackMin: 3 })
console.log('Relevanz-Filter OK', result)
