import pino from 'pino'

const logger = pino({
	transport: {
		target: 'pino-pretty',
	},
	enabled: process.env.NODE_ENV !== 'test',
	browser: {
		serialize: true,
		asObject: true,
	},
})

export { logger }
