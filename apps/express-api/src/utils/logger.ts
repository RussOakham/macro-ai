import { pinoHttp, HttpLogger, Options } from 'pino-http'

const pinoOptions: Options = {
	transport: {
		target: 'pino-pretty',
	},
	enabled: process.env.NODE_ENV !== 'test',
}

const pino: HttpLogger = pinoHttp(pinoOptions)

export { pino }
