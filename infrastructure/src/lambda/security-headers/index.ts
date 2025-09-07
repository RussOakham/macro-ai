import { CloudFrontRequestEvent, CloudFrontResponseEvent } from 'aws-lambda'

interface SecurityHeadersConfig {
	environment: string
	enableDetailedLogging: boolean
	customHeaders: Record<string, string>
	contentSecurityPolicy: string
	corsAllowedOrigins: string[]
	enableHsts: boolean
	hstsMaxAge: number
	enableXFrameOptions: boolean
	xFrameOptionsValue: string
}

function getSecurityConfig(): SecurityHeadersConfig {
	return {
		environment: process.env.ENVIRONMENT || 'development',
		enableDetailedLogging: process.env.ENABLE_DETAILED_LOGGING === 'true',
		customHeaders: JSON.parse(process.env.CUSTOM_HEADERS || '{}'),
		contentSecurityPolicy: process.env.CONTENT_SECURITY_POLICY || '',
		corsAllowedOrigins: JSON.parse(process.env.CORS_ALLOWED_ORIGINS || '[]'),
		enableHsts: process.env.ENABLE_HSTS === 'true',
		hstsMaxAge: parseInt(process.env.HSTS_MAX_AGE || '31536000'),
		enableXFrameOptions: process.env.ENABLE_X_FRAME_OPTIONS === 'true',
		xFrameOptionsValue: process.env.X_FRAME_OPTIONS_VALUE || 'DENY',
	}
}

function isCorsRequest(request: any): boolean {
	return !!(
		request.headers['origin'] ||
		request.headers['Origin'] ||
		request.headers['access-control-request-method'] ||
		request.headers['Access-Control-Request-Method']
	)
}

function getOriginFromRequest(request: any): string | null {
	const origin = request.headers['origin'] || request.headers['Origin']
	return Array.isArray(origin) ? origin[0]?.value : origin?.value || null
}

function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
	return allowedOrigins.some((allowedOrigin) => {
		if (allowedOrigin === '*') return true
		if (allowedOrigin.startsWith('*.')) {
			const domain = allowedOrigin.slice(2)
			return origin.endsWith(domain)
		}
		return origin === allowedOrigin
	})
}

function addSecurityHeaders(
	response: any,
	config: SecurityHeadersConfig,
	request?: any,
): void {
	const headers = response.headers || {}

	// Content Security Policy
	if (config.contentSecurityPolicy) {
		headers['content-security-policy'] = [
			{
				key: 'Content-Security-Policy',
				value: config.contentSecurityPolicy,
			},
		]
	}

	// HTTP Strict Transport Security (HSTS)
	if (config.enableHsts) {
		headers['strict-transport-security'] = [
			{
				key: 'Strict-Transport-Security',
				value: `max-age=${config.hstsMaxAge}; includeSubDomains; preload`,
			},
		]
	}

	// X-Frame-Options
	if (config.enableXFrameOptions) {
		headers['x-frame-options'] = [
			{
				key: 'X-Frame-Options',
				value: config.xFrameOptionsValue,
			},
		]
	}

	// X-Content-Type-Options
	headers['x-content-type-options'] = [
		{
			key: 'X-Content-Type-Options',
			value: 'nosniff',
		},
	]

	// X-XSS-Protection
	headers['x-xss-protection'] = [
		{
			key: 'X-XSS-Protection',
			value: '1; mode=block',
		},
	]

	// Referrer Policy
	headers['referrer-policy'] = [
		{
			key: 'Referrer-Policy',
			value: 'strict-origin-when-cross-origin',
		},
	]

	// Permissions Policy (formerly Feature Policy)
	headers['permissions-policy'] = [
		{
			key: 'Permissions-Policy',
			value: 'camera=(), microphone=(), geolocation=(), payment=()',
		},
	]

	// Handle CORS headers if this is a CORS request
	if (request && isCorsRequest(request)) {
		const origin = getOriginFromRequest(request)

		if (origin && isOriginAllowed(origin, config.corsAllowedOrigins)) {
			headers['access-control-allow-origin'] = [
				{
					key: 'Access-Control-Allow-Origin',
					value: origin,
				},
			]

			headers['access-control-allow-credentials'] = [
				{
					key: 'Access-Control-Allow-Credentials',
					value: 'true',
				},
			]

			headers['access-control-allow-methods'] = [
				{
					key: 'Access-Control-Allow-Methods',
					value: 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
				},
			]

			headers['access-control-allow-headers'] = [
				{
					key: 'Access-Control-Allow-Headers',
					value: 'Content-Type, Authorization, X-API-Key, X-Requested-With',
				},
			]

			headers['access-control-max-age'] = [
				{
					key: 'Access-Control-Max-Age',
					value: '86400', // 24 hours
				},
			]
		}
	}

	// Add custom headers
	Object.entries(config.customHeaders).forEach(([key, value]) => {
		headers[key.toLowerCase()] = [
			{
				key,
				value,
			},
		]
	})

	response.headers = headers
}

function logSecurityEvent(
	message: string,
	level: 'INFO' | 'WARN' | 'ERROR',
	details?: any,
): void {
	const config = getSecurityConfig()

	if (!config.enableDetailedLogging && level === 'INFO') {
		return
	}

	const logEntry = {
		timestamp: new Date().toISOString(),
		level,
		message,
		environment: config.environment,
		...(details && { details }),
	}

	console.log(JSON.stringify(logEntry))
}

export async function handler(
	event: CloudFrontRequestEvent | CloudFrontResponseEvent,
): Promise<any> {
	try {
		const config = getSecurityConfig()

		logSecurityEvent('Security headers handler invoked', 'INFO', {
			eventType: event.Records[0].cf.eventType,
			requestId: event.Records[0].cf.requestId,
		})

		// Handle different CloudFront events
		if (event.Records[0].cf.eventType === 'viewer-request') {
			// For request events, just pass through (security headers are added on response)
			return event.Records[0].cf.request
		} else if (event.Records[0].cf.eventType === 'viewer-response') {
			// For response events, add security headers
			const response = event.Records[0].cf.response
			const request = event.Records[0].cf.request

			addSecurityHeaders(response, config, request)

			logSecurityEvent('Security headers added to response', 'INFO', {
				statusCode: response.status,
				headersAdded: Object.keys(response.headers || {}),
			})

			return response
		} else if (event.Records[0].cf.eventType === 'origin-request') {
			// For origin request events, add security-related headers to the request
			const request = event.Records[0].cf.request

			// Add security headers to the request that will be sent to origin
			if (!request.headers) {
				request.headers = {}
			}

			// Add X-Forwarded-Proto if not present
			if (!request.headers['x-forwarded-proto']) {
				request.headers['x-forwarded-proto'] = [
					{
						key: 'X-Forwarded-Proto',
						value: request.clientIp.includes(':') ? 'https' : 'https', // Assume HTTPS
					},
				]
			}

			return request
		} else if (event.Records[0].cf.eventType === 'origin-response') {
			// For origin response events, add security headers before sending to viewer
			const response = event.Records[0].cf.response
			const request = event.Records[0].cf.request

			addSecurityHeaders(response, config, request)

			return response
		}

		// Default: return the request/response unchanged
		return event.Records[0].cf.request || event.Records[0].cf.response
	} catch (error) {
		logSecurityEvent('Error in security headers handler', 'ERROR', {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		})

		// In case of error, return the original request/response
		return event.Records[0].cf.request || event.Records[0].cf.response
	}
}

// Export for testing
export {
	getSecurityConfig,
	addSecurityHeaders,
	isCorsRequest,
	isOriginAllowed,
	getOriginFromRequest,
}
