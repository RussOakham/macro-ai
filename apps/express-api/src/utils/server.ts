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
	app.use('/api-docs', cors({ origin: true, credentials: false }))
	app.use('/swagger.json', cors({ origin: true, credentials: false }))

	// Simplified CORS configuration for ephemeral environments
	// Parse CORS_ALLOWED_ORIGINS from environment or use smart defaults
	// Add * wildcard for preview/staging environments
	let corsOrigins = 'http://localhost:3000'

	if (process.env.NODE_ENV !== 'production') {
		if (process.env.APP_ENV?.startsWith('pr-')) {
			corsOrigins = `https://${process.env.APP_ENV}.macro-ai.russoakham.dev`
		} else if (process.env.APP_ENV === 'staging') {
			corsOrigins = 'https://staging-api.macro-ai.russoakham.dev'
		} else {
			corsOrigins = 'https://api.macro-ai.russoakham.dev'
		}
	}

	console.log(`[server] CORS: Configured origins: [${corsOrigins}]`)

	app.use(
		cors({
			origin: (origin, callback) => {
				// Allow requests with no origin (REST tools, same-origin)
				if (!origin) {
					callback(null, true)
					return
				}

				// Check if origin is in allowed list
				if (corsOrigins.includes(origin)) {
					callback(null, true)
					return
				}

				console.log(`[server] CORS: ❌ Denying origin: ${origin}`)
				callback(null, false)
			},
			credentials: true,
			methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
			allowedHeaders: [
				'Origin',
				'X-Requested-With',
				'Content-Type',
				'Accept',
				'Authorization',
				'X-API-KEY', // Exact case for API key middleware
				'x-api-key', // Lowercase version for browser compatibility
				'X-Api-Key', // Uppercase version for browser compatibility
				'Cache-Control',
			],
			exposedHeaders: ['cache-control'],
			maxAge: 86400,
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

	// Add middlewares (CORS must come BEFORE authentication for OPTIONS preflight)
	app.use(helmetMiddleware)
	app.use(securityHeadersMiddleware)
	app.use(defaultRateLimiter)
	app.use(apiKeyAuth) // Move API key auth after CORS to allow OPTIONS preflight

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
