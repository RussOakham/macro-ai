import { HttpLogger, Options, pinoHttp } from 'pino-http'

/**
 * Check if running in Lambda environment
 */
const isLambdaEnvironment = (): boolean => {
	return !!(
		process.env.AWS_LAMBDA_FUNCTION_NAME ??
		process.env.AWS_LAMBDA_RUNTIME_API ??
		process.env.LAMBDA_RUNTIME_DIR
	)
}

const createLogger = (nodeEnv: string): HttpLogger => {
	const isLambda = isLambdaEnvironment()
	const isDevelopment = nodeEnv === 'development'

	// Only use pino-pretty in development and NOT in Lambda
	const shouldUsePrettyTransport = isDevelopment && !isLambda

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
		// Lambda/production configuration without pino-pretty
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
