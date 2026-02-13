import { adapters } from '../crawler/adapters/index.mjs'
import { runCollect } from '../crawler/workflow.mjs'

const result = await runCollect({ adapters })
console.log('Collect OK', result)
