import { runQueue, runPublish } from '../crawler/workflow.mjs'

const queueResult = runQueue({ minScore: 0.25 })
const publishResult = runPublish()
console.log('Workflow OK', { queueResult, publishResult })
