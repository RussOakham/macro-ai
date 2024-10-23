import express, { Express } from 'express'
import bodyParser from 'body-parser'
import compression from 'compression'
import cors from 'cors'

import { pino } from './logger.ts'
import { appRouter } from '../router/index.routes.ts'

const createServer = () => {
	const app: Express = express()

	app.use(pino)
	app.use(
		cors({
			credentials: true,
		}),
	)
	app.use(compression())
	app.use(bodyParser.json())

	app.use('/api', appRouter())

	return app
}

export { createServer }
