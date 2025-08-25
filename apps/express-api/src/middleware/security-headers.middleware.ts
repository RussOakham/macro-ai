import { NextFunction, Request, Response } from 'express'
import helmet from 'helmet'

import { config } from '../utils/load-config.ts'
import { pino } from '../utils/logger.ts'

const { logger } = pino

// Basic Helmet middleware with custom configuration
// Note: crossOriginEmbedderPolicy is set to !isDevelopment
// - In development: isDevelopment = true, so crossOriginEmbedderPolicy = false
// - In production/test: isDevelopment = false, so crossOriginEmbedderPolicy = true
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
	crossOriginEmbedderPolicy: config.NODE_ENV !== 'development',
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
