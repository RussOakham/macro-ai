import pino from 'pino'
import { HttpLogger, Options, pinoHttp } from 'pino-http'

import { config } from './load-config.ts'

const createLogger = (nodeEnv: string): HttpLogger => {
	const isDevelopment = nodeEnv === 'development'

	// Only use pino-pretty in development
	const shouldUsePrettyTransport = isDevelopment

	let pinoOptions: Options

	const baseOptions = {
		enabled: nodeEnv !== 'test',
		quietReqLogger: true,
		quietResLogger: true,
	}

	if (shouldUsePrettyTransport) {
		// Development configuration with pino-pretty
		pinoOptions = {
			...baseOptions,
			transport: {
				target: 'pino-pretty',
			},
		}
	} else {
		// Production configuration without pino-pretty
		pinoOptions = {
			...baseOptions,
			level: config.NODE_ENV === 'development' ? 'debug' : 'info',
			formatters: {
				level: (label) => ({ level: label }),
			},
			timestamp: true,
			customLogLevel: (req, res, err) => {
				if (res.statusCode >= 500 || err) return 'error'
				if (res.statusCode >= 400) return 'warn'
				return 'info' // or 'silent' to suppress
			},
			customSuccessMessage: function (req, res, time) {
				return `✅ ${req.method ?? ''} ${req.url ?? ''} → ${res.statusCode.toString()} in ${time.toString()}ms`
			},
			customErrorMessage: function (req, res, err) {
				return `❌ ${req.method ?? ''} ${req.url ?? ''} → ${res.statusCode.toString()} (${err.message})`
			},
		}
	}

	return pinoHttp(pinoOptions)
}

// Initialize with default value, will be reconfigured when config is loaded
// eslint-disable-next-line import-x/no-mutable-exports
let httpLogger: HttpLogger = createLogger('development')

const configureLogger = (nodeEnv: string): void => {
	httpLogger = createLogger(nodeEnv)
}

// General-purpose logger for non-HTTP logging
export const logger = pino({
	level: process.env.LOG_LEVEL ?? 'info',
	transport:
		process.env.NODE_ENV === 'development'
			? {
					target: 'pino-pretty',
					options: {
						colorize: true,
						translateTime: 'SYS:standard',
						ignore: 'pid,hostname',
					},
				}
			: undefined,
})

export { configureLogger, httpLogger as pino }
