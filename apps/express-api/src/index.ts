import { config } from '../config/default.ts'

import { pino } from './utils/logger.ts'
import { createServer } from './utils/server.ts'

const { logger } = pino

try {
	const httpServer = createServer()

	httpServer.listen(config.port, () => {
		logger.info(
			`[server]: Server is running on port: ${config.port.toString()}`,
		)
	})
} catch (error) {
	logger.error('[server]: Failed to start server:', error)
	process.exit(1)
}
