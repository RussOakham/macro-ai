import bodyParser from 'body-parser'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express, { Express } from 'express'
import path from 'path'
import swaggerUi from 'swagger-ui-express'

import { apiKeyAuth } from '../middleware/api-key.middleware.ts'
import { errorHandler } from '../middleware/error.middleware.ts'
import { defaultRateLimiter } from '../middleware/rate-limit.middleware.ts'
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

	// Public endpoints: allow broad CORS for browser access (no credentials)
	app.use(
		'/api/health',
		cors({
			origin: true, // reflect request origin
			credentials: false,
			methods: ['GET', 'OPTIONS'],
			allowedHeaders: [
				'Origin',
				'X-Requested-With',
				'Content-Type',
				'Accept',
				'Authorization',
				'X-API-KEY',
				'Cache-Control',
			],
			maxAge: 86400,
		}),
	)
	app.use('/api-docs', cors({ origin: true, credentials: false }))
	app.use('/swagger.json', cors({ origin: true, credentials: false }))

	// Default CORS for application routes (credentialed dev/preview origins)
	// Parse CORS_ALLOWED_ORIGINS if provided; fall back to localhost defaults
	const parsedCorsOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
		.split(',')
		.map((o) => o.trim())
		.filter((o) => o.length > 0)
	const effectiveOrigins =
		parsedCorsOrigins.length > 0
			? parsedCorsOrigins
			: ['http://localhost:3000', 'http://localhost:3040']
	app.use(
		cors({
			origin: effectiveOrigins,
			credentials: true,
			exposedHeaders: ['cache-control'], // 'set-cookie' cannot be exposed via CORS
			methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
			allowedHeaders: [
				'Origin',
				'X-Requested-With',
				'Content-Type',
				'Accept',
				'Authorization',
				'X-API-KEY',
				'Cache-Control',
			],
			maxAge: 86400, // 24 hours
		}),
	)
	// Conditional compression - disable for streaming endpoints
	app.use(
		compression({
			filter: (req, res) => {
				// Don't compress streaming endpoints
				if (req.path.includes('/stream')) {
					return false
				}
				// Use default compression filter for other endpoints
				return compression.filter(req, res)
			},
		}),
	)
	app.use(bodyParser.json())
	app.use(express.urlencoded({ extended: true }))
	app.use(cookieParser())

	// Add middlewares
	app.use(apiKeyAuth)
	app.use(helmetMiddleware)
	app.use(securityHeadersMiddleware)
	app.use(defaultRateLimiter)

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
