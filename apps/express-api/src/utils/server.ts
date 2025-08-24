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

	// Default CORS for application routes (credentialed dev/preview origins)
	// Parse CORS_ALLOWED_ORIGINS if provided; fall back to localhost defaults
	const rawEnv = process.env.CORS_ALLOWED_ORIGINS ?? ''
	const appEnv = process.env.APP_ENV ?? ''
	const isPreview = appEnv.startsWith('pr-')
	const parsedCorsOrigins = rawEnv
		.split(',')
		.map((o) => o.trim())
		.filter((o) => o.length > 0)
		.map((o) => (o.endsWith('/') ? o.replace(/\/+$/, '') : o))

	// Get custom domain from environment variables (aligns with CDK configuration)
	const customDomainName = process.env.CUSTOM_DOMAIN_NAME // e.g., "macro-ai.russoakham.dev"

	// Pattern-based CORS matching for preview environments with custom domains
	const isCustomDomainPreview = isPreview && customDomainName
	const previewDomainPattern = isCustomDomainPreview
		? new RegExp(`^https://pr-\\d+\\.${customDomainName.replace('.', '\\.')}$`)
		: null

	// Add custom domain origins for preview environments - CONFIGURABLE PATTERNS
	const customDomainOrigins =
		isPreview && process.env.PR_NUMBER && customDomainName
			? [
					`https://pr-${process.env.PR_NUMBER}.${customDomainName}`, // Frontend
					`https://pr-${process.env.PR_NUMBER}-api.${customDomainName}`, // API
				]
			: []

	// Add production and staging origins (only if custom domain is configured)
	const productionOrigins = customDomainName
		? [
				`https://${customDomainName}`, // Production frontend
				`https://staging.${customDomainName}`, // Staging frontend
				`https://api.${customDomainName}`, // Production API
				`https://staging-api.${customDomainName}`, // Staging API
			]
		: []

	const effectiveOrigins =
		parsedCorsOrigins.length > 0
			? [...parsedCorsOrigins, ...customDomainOrigins, ...productionOrigins]
			: [
					'http://localhost:3000',
					'http://localhost:3040',
					...customDomainOrigins,
					...productionOrigins,
				]

	app.use(
		cors({
			origin: (origin, callback) => {
				console.log(`[server] CORS: Testing origin: ${origin ?? 'null'}`)

				// Allow REST tools or same-origin (no Origin header)
				if (!origin) {
					console.log(
						'[server] CORS: Allowing null origin (REST tools/same-origin)',
					)
					callback(null, true)
					return
				}

				// Normalize by stripping trailing slashes
				const normalized = origin.replace(/\/+$/, '')
				console.log(`[server] CORS: Normalized origin: ${normalized}`)

				// Check explicit allowed origins first
				const allowedSet = new Set(
					effectiveOrigins.map((o) => o.replace(/\/+$/, '')),
				)
				console.log(
					`[server] CORS: Allowed origins set: [${Array.from(allowedSet).join(', ')}]`,
				)

				if (allowedSet.has(normalized)) {
					console.log(
						`[server] CORS: ✅ Allowing origin via explicit list: ${normalized}`,
					)
					callback(null, true)
					return
				}

				// For preview environments with custom domains, use pattern matching
				console.log(
					`[server] CORS: Pattern matching - previewDomainPattern: ${previewDomainPattern?.toString() ?? 'null'}`,
				)
				if (previewDomainPattern?.test(normalized)) {
					console.log(
						`[server] CORS: ✅ Allowing preview domain via pattern: ${normalized}`,
					)
					callback(null, true)
					return
				}

				// Deny all other origins
				console.log(`[server] CORS: ❌ Denying origin: ${normalized}`)
				console.log(
					`[server] CORS: Reason - not in allowed list and doesn't match pattern`,
				)
				callback(null, false)
			},
			credentials: true,
			exposedHeaders: ['cache-control'],
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
