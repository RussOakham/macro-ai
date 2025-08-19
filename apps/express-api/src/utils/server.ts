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
	// Enhanced health endpoints for ALB and monitoring
	app.use('/api/health/detailed', cors({ origin: true, credentials: false }))
	app.use('/api/health/ready', cors({ origin: true, credentials: false }))
	app.use('/api/health/live', cors({ origin: true, credentials: false }))
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

	// Log effective CORS configuration at startup
	// Note: In preview envs with empty origins, Express will still use localhost here,
	// but Lambda utilities will refuse to fall back for preflight handling and responses.
	console.log('[server] ===== COMPREHENSIVE CORS DIAGNOSTICS =====')
	console.log('[server] Environment Variables:')
	console.log(`  NODE_ENV: "${process.env.NODE_ENV ?? 'undefined'}"`)
	console.log(`  APP_ENV: "${appEnv}" (isPreview=${String(isPreview)})`)
	console.log(`  PR_NUMBER: "${process.env.PR_NUMBER ?? 'undefined'}"`)
	console.log(`  CUSTOM_DOMAIN_NAME: "${customDomainName ?? 'undefined'}"`)
	console.log(`  CORS_ALLOWED_ORIGINS (raw): "${rawEnv}"`)
	console.log('[server] CORS Processing:')

	const parsedOriginsStr = parsedCorsOrigins.map((o) => `"${o}"`).join(', ')
	console.log(
		`  CORS_ALLOWED_ORIGINS (parsed/normalized): [${parsedOriginsStr}]`,
	)
	console.log(`  isCustomDomainPreview: ${String(isCustomDomainPreview)}`)
	console.log(
		`  previewDomainPattern: ${previewDomainPattern?.toString() ?? 'null'}`,
	)

	const customOriginsStr = customDomainOrigins.map((o) => `"${o}"`).join(', ')
	console.log(`  customDomainOrigins: [${customOriginsStr}]`)

	const productionOriginsStr = productionOrigins.map((o) => `"${o}"`).join(', ')
	console.log(`  productionOrigins: [${productionOriginsStr}]`)

	const effectiveOriginsStr = effectiveOrigins.map((o) => `"${o}"`).join(', ')
	console.log(`  Express CORS origin setting: [${effectiveOriginsStr}]`)
	console.log('[server] ===== END CORS DIAGNOSTICS =====')

	// Also log all environment variables for debugging
	console.log('[server] ===== ALL ENVIRONMENT VARIABLES =====')
	Object.keys(process.env)
		.filter(
			(key) =>
				key.includes('CORS') ||
				key.includes('DOMAIN') ||
				key.includes('APP_ENV') ||
				key.includes('PR_'),
		)
		.sort((a, b) => a.localeCompare(b))
		.forEach((key) => {
			console.log(`  ${key}: "${process.env[key] ?? 'undefined'}"`)
		})
	console.log('[server] ===== END ENVIRONMENT VARIABLES =====')

	// Add middleware to log all incoming requests for debugging
	app.use((req, res, next) => {
		console.log(`[server] REQUEST: ${req.method} ${req.url}`)
		console.log(
			`[server] REQUEST: Origin header: ${req.headers.origin ?? 'null'}`,
		)
		if (req.method === 'OPTIONS') {
			console.log(`[server] REQUEST: ⚠️ PREFLIGHT REQUEST detected`)
			console.log(
				`[server] REQUEST: Access-Control-Request-Method: ${req.headers['access-control-request-method'] ?? 'null'}`,
			)
			console.log(
				`[server] REQUEST: Access-Control-Request-Headers: ${req.headers['access-control-request-headers'] ?? 'null'}`,
			)
		}

		// EMERGENCY CORS FIX: Add basic CORS headers to all responses
		res.header('Access-Control-Allow-Origin', req.headers.origin ?? '*')
		res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
		res.header(
			'Access-Control-Allow-Headers',
			'Origin,X-Requested-With,Content-Type,Accept,Authorization,X-API-KEY,Cache-Control',
		)
		res.header('Access-Control-Allow-Credentials', 'true')

		console.log(
			`[server] EMERGENCY CORS: Applied headers for ${req.method} ${req.url}`,
		)

		// Handle preflight requests immediately
		if (req.method === 'OPTIONS') {
			console.log(
				`[server] EMERGENCY: Handling OPTIONS preflight with manual headers`,
			)
			return res.status(200).end()
		}

		next()
	})

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

	// Add middleware to log CORS response headers
	app.use((req, res, next) => {
		const originalSend = res.send
		res.send = function (body) {
			if (req.method === 'OPTIONS') {
				console.log(`[server] RESPONSE: ⚠️ PREFLIGHT RESPONSE`)
				console.log(
					`[server] RESPONSE: Access-Control-Allow-Origin: ${res.getHeader('Access-Control-Allow-Origin') as string}`,
				)
				console.log(
					`[server] RESPONSE: Access-Control-Allow-Methods: ${res.getHeader('Access-Control-Allow-Methods') as string}`,
				)
				console.log(
					`[server] RESPONSE: Access-Control-Allow-Headers: ${res.getHeader('Access-Control-Allow-Headers') as string}`,
				)
				console.log(
					`[server] RESPONSE: Access-Control-Allow-Credentials: ${res.getHeader('Access-Control-Allow-Credentials') as string}`,
				)
			}
			return originalSend.call(this, body)
		}
		next()
	})

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
