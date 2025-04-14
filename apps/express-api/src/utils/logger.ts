import { HttpLogger, Options, pinoHttp } from 'pino-http'

const createLogger = (nodeEnv: string): HttpLogger => {
	const pinoOptions: Options = {
		transport: {
			target: 'pino-pretty',
		},
		enabled: nodeEnv !== 'test',
		quietReqLogger: true,
		quietResLogger: true,
	}

	return pinoHttp(pinoOptions)
}

// Initialize with default value, will be reconfigured when config is loaded
let pino: HttpLogger = createLogger('development')

const configureLogger = (nodeEnv: string): void => {
	pino = createLogger(nodeEnv)
}

export { configureLogger, pino }
