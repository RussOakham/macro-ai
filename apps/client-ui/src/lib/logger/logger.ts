import { LoggerOptions, pino } from 'pino'

const pinoOptions: LoggerOptions = {
	transport: {
		target: 'pino-pretty',
	},
	enabled: process.env.NODE_ENV !== 'test',
	browser: {
		serialize: true,
		asObject: true,
	},
}

const logger = pino(pinoOptions)

export { logger }
