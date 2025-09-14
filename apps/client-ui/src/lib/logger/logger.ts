import { pino } from 'pino'
import type { LoggerOptions } from 'pino'

const pinoOptions: LoggerOptions = {
	browser: {
		asObject: true,
		serialize: true,
	},
	enabled: process.env.NODE_ENV !== 'test',
	transport: {
		target: 'pino-pretty',
	},
}

const logger = pino(pinoOptions)

export { logger }
