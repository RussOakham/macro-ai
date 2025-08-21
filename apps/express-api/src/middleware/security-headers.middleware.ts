import { NextFunction, Request, Response } from 'express'
import helmet from 'helmet'

import { assertConfig } from '../../config/default.ts'
import { pino } from '../utils/logger.ts'

const { logger } = pino
const config = assertConfig()
const isDevelopment = config.nodeEnv === 'development'

// Basic Helmet middleware with custom configuration
const helmetMiddleware = helmet({
	contentSecurityPolicy: {
		directives: {
			defaultSrc: ["'self'"],
			scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
			styleSrc: ["'self'", "'unsafe-inline'"],
			imgSrc: ["'self'", 'data:', 'https:'],
			connectSrc: ["'self'", 'https://cognito-idp.*.amazonaws.com'],
			fontSrc: ["'self'"],
			objectSrc: ["'none'"],
			mediaSrc: ["'self'"],
			frameSrc: ["'none'"],
		},
	},
	crossOriginEmbedderPolicy: !isDevelopment,
	crossOriginOpenerPolicy: { policy: 'same-origin' },
	crossOriginResourcePolicy: { policy: 'same-site' },
	dnsPrefetchControl: { allow: false },
	frameguard: { action: 'deny' },
	hsts: {
		maxAge: 31536000,
		includeSubDomains: true,
		preload: true,
	},
	ieNoOpen: true,
	noSniff: true,
	originAgentCluster: true,
	permittedCrossDomainPolicies: { permittedPolicies: 'none' },
	referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
	xssFilter: true,
})

// Custom security headers middleware
const securityHeadersMiddleware = (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	// Additional custom security headers
	res.setHeader('X-Content-Type-Options', 'nosniff')
	res.setHeader('X-Frame-Options', 'DENY')
	res.setHeader('X-XSS-Protection', '1; mode=block')
	res.setHeader('X-Download-Options', 'noopen')
	res.setHeader('X-Permitted-Cross-Domain-Policies', 'none')

	// Cache control
	res.setHeader(
		'Cache-Control',
		'no-store, no-cache, must-revalidate, proxy-revalidate',
	)
	res.setHeader('Pragma', 'no-cache')
	res.setHeader('Expires', '0')

	logger.debug('[middleware - securityHeaders]: Security headers applied')
	next()
}

export { helmetMiddleware, securityHeadersMiddleware }
