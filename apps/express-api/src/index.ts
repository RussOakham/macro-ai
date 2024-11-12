import config from 'config'

import { pino } from './utils/logger.ts'
import { createServer } from './utils/server.ts'

const port = config.get<number>('port')

const { logger } = pino

const httpServer = createServer()

httpServer.listen(port, () => {
	logger.info(`[server]: Server is running on port: ${port.toString()}`)
})
