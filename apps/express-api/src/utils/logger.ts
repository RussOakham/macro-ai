import { HttpLogger, Options, pinoHttp } from 'pino-http'

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
let pino: HttpLogger = createLogger('development')

const configureLogger = (nodeEnv: string): void => {
	pino = createLogger(nodeEnv)
}

export { configureLogger, pino }
