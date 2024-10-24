import express, { Express } from 'express'
import compression from 'compression'
import cors from 'cors'
import { json } from 'body-parser'

import { pino } from './logger.ts'
import { appRouter } from '../router/index.routes.ts'

const createServer = (): Express => {
	const app: Express = express()

	app.use(pino)
	app.use(
		cors({
			credentials: true,
		}),
	)
	app.use(compression())
	app.use(json())

	app.use('/api', appRouter())

	return app
}

export { createServer }
