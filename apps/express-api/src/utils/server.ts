import bodyParser from 'body-parser'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express, { Express } from 'express'
import path from 'path'
import swaggerUi from 'swagger-ui-express'

import { apiKeyAuth } from '../middleware/api-key.middleware.ts'
import { errorHandler } from '../middleware/error.middleware.ts'
import {
	helmetMiddleware,
	securityHeadersMiddleware,
} from '../middleware/security-headers.middleware.ts'
import { appRouter } from '../router/index.routes.ts'

import { pino } from './logger.ts'

// Export options for use in generate-swagger.ts

const createServer = (): Express => {
	const app: Express = express()

	// Add static file serving for swagger.json
	app.use(express.static(path.join(process.cwd(), 'public')))

	app.use(pino)
	app.use(
		cors({
			origin: ['http://localhost:3000', 'http://localhost:3030'],
			credentials: true,
			exposedHeaders: ['set-cookie'],
			methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
			allowedHeaders: [
				'Origin',
				'X-Requested-With',
				'Content-Type',
				'Accept',
				'Authorization',
				'X-API-KEY',
			],
			maxAge: 86400, // 24 hours
		}),
	)
	app.use(compression())
	app.use(bodyParser.json())
	app.use(express.urlencoded({ extended: true }))
	app.use(cookieParser())

	// Add middlewares
	app.use(apiKeyAuth)
	app.use(helmetMiddleware)
	app.use(securityHeadersMiddleware)

	app.use('/api', appRouter())
	app.use(
		'/api-docs',
		swaggerUi.serve,
		swaggerUi.setup(undefined, {
			explorer: true,
			swaggerOptions: {
				url: '/swagger.json',
			},
		}),
	)

	// Add error handler last
	app.use(errorHandler)

	return app
}

export { createServer }
