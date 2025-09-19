import path from 'node:path'

import bodyParser from 'body-parser'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express, { type Express } from 'express'
import swaggerUi from 'swagger-ui-express'

import { apiKeyAuth } from '../middleware/api-key.middleware.ts'
import { errorHandler } from '../middleware/error.middleware.ts'
import { defaultRateLimiter } from '../middleware/rate-limit.middleware.ts'
import {
	helmetMiddleware,
	securityHeadersMiddleware,
} from '../middleware/security-headers.middleware.ts'
import { appRouter } from '../router/index.routes.ts'
import { doubleCsrfProtection } from './csrf.ts'
import { config } from './load-config.ts'
import { pino } from './logger.ts'

// Export options for use in generate-swagger.ts

const createServer = (): Express => {
	const app: Express = express()

	// Disable X-Powered-By header for security
	app.disable('x-powered-by')

	// Add static file serving for swagger.json
	app.use(express.static(path.join(process.cwd(), 'public')))

	app.use(pino)

	const { logger } = pino

	// Public endpoints: allow broad CORS for browser access (no credentials)
	app.use('/api-docs', cors({ origin: true, credentials: false }))
	app.use('/swagger.json', cors({ origin: true, credentials: false }))

	// Simplified CORS configuration for ephemeral environments
	let corsOrigins = 'http://localhost:3000'

	if (config.NODE_ENV === 'test') {
		corsOrigins = 'http://localhost:3000'
	}

	if (config.NODE_ENV === 'development') {
		// Local and test environments
		corsOrigins = 'http://localhost:3000'

		// Pr environments
		if (config.APP_ENV.startsWith('pr-')) {
			// For PR environments, the frontend will be on pr-XX.macro-ai.russoakham.dev
			// while the backend will be on pr-XX-api.macro-ai.russoakham.dev
			corsOrigins = `https://${config.APP_ENV}.macro-ai.russoakham.dev`
		}
	}

	if (config.NODE_ENV === 'production') {
		// Production and staging environments
		// CUSTOM_DOMAIN_NAME now includes the API subdomain (e.g., staging.api.macro-ai.russoakham.dev)
		// We need to construct the frontend domain by removing the .api part
		const apiDomain = process.env.CUSTOM_DOMAIN_NAME ?? ''
		const frontendDomain = apiDomain.replace('.api.', '.')
		corsOrigins = `https://${frontendDomain}`
	}

	logger.info(`[server] CORS: Using origins: ${corsOrigins}`)

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

				logger.warn(`[server] CORS: ❌ Denying origin: ${origin}`)
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
				// Default compression filter logic - check if response should be compressed
				return res.getHeader('content-encoding') === undefined
			},
		}),
	)
	app.use(bodyParser.json())
	app.use(express.urlencoded({ extended: true }))
	app.use(cookieParser())

	// Apply CSRF protection to all routes except public endpoints and API routes
	app.use((req, res, next) => {
		// Skip CSRF for public documentation endpoints and API routes
		if (
			req.path.startsWith('/api-docs') ||
			req.path.startsWith('/swagger.json') ||
			req.path.startsWith('/api/')
		) {
			return next()
		}
		return doubleCsrfProtection(req, res, next)
	})

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

// Note: generateCsrfToken is now exported from ./csrf.ts
export { createServer }
