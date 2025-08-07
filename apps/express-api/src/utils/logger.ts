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

	const pinoOptions: Options = {
		// Only add transport in development (not in Lambda/production)
		...(shouldUsePrettyTransport && {
			transport: {
				target: 'pino-pretty',
			},
		}),
		enabled: nodeEnv !== 'test',
		quietReqLogger: true,
		quietResLogger: true,
		// Add structured logging for Lambda/production
		...(!shouldUsePrettyTransport && {
			formatters: {
				level: (label) => ({ level: label }),
			},
			timestamp: true,
		}),
	}

	return pinoHttp(pinoOptions)
}

// Initialize with default value, will be reconfigured when config is loaded
let pino: HttpLogger = createLogger('development')

const configureLogger = (nodeEnv: string): void => {
	pino = createLogger(nodeEnv)
}

export { configureLogger, pino }
