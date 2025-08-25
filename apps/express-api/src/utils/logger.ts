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
