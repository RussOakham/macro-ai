import { HttpLogger, Options, pinoHttp } from 'pino-http'

const pinoOptions: Options = {
	transport: {
		target: 'pino-pretty',
	},
	enabled: process.env.NODE_ENV !== 'test',
	quietReqLogger: true,
	quietResLogger: true,
}

const pino: HttpLogger = pinoHttp(pinoOptions)

export { pino }
