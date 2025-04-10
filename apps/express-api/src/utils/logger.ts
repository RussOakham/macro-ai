import config from 'config'
import { HttpLogger, Options, pinoHttp } from 'pino-http'

const nodeEnv = config.get<string>('nodeEnv')

const pinoOptions: Options = {
	transport: {
		target: 'pino-pretty',
	},
	enabled: nodeEnv !== 'test',
	quietReqLogger: true,
	quietResLogger: true,
}

const pino: HttpLogger = pinoHttp(pinoOptions)

export { pino }
