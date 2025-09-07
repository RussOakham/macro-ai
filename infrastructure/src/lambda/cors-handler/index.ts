import { CloudFrontRequestEvent, CloudFrontResponseEvent } from 'aws-lambda'

interface CorsConfig {
	environment: string
	allowedOrigins: string[]
	allowedMethods: string[]
	allowedHeaders: string[]
	exposedHeaders: string[]
	maxAge: number
	allowCredentials: boolean
}

function getCorsConfig(): CorsConfig {
	return {
		environment: process.env.ENVIRONMENT || 'development',
		allowedOrigins: JSON.parse(process.env.ALLOWED_ORIGINS || '[]'),
		allowedMethods: JSON.parse(
			process.env.ALLOWED_METHODS || '["GET","POST","PUT","DELETE","OPTIONS"]',
		),
		allowedHeaders: JSON.parse(
			process.env.ALLOWED_HEADERS ||
				'["Content-Type","Authorization","X-Requested-With","Accept","Origin"]',
		),
		exposedHeaders: JSON.parse(process.env.EXPOSED_HEADERS || '[]'),
		maxAge: parseInt(process.env.MAX_AGE || '86400'),
		allowCredentials: process.env.ALLOW_CREDENTIALS === 'true',
	}
}

function isOriginAllowed(
	origin: string | undefined,
	allowedOrigins: string[],
): boolean {
	if (!origin) return false

	// Check exact matches
	if (allowedOrigins.includes(origin)) {
		return true
	}

	// Check wildcard patterns
	for (const allowedOrigin of allowedOrigins) {
		if (allowedOrigin.includes('*')) {
			const pattern = allowedOrigin.replace(/\*/g, '.*')
			const regex = new RegExp(`^${pattern}$`)
			if (regex.test(origin)) {
				return true
			}
		}
	}

	return false
}

function createCorsHeaders(
	origin: string | undefined,
	config: CorsConfig,
): Record<string, string> {
	const headers: Record<string, string> = {}

	// Always set Vary header to prevent caching issues
	headers['Vary'] = 'Origin'

	// Set CORS headers only if origin is allowed
	if (origin && isOriginAllowed(origin, config.allowedOrigins)) {
		headers['Access-Control-Allow-Origin'] = origin
		headers['Access-Control-Allow-Methods'] = config.allowedMethods.join(', ')
		headers['Access-Control-Allow-Headers'] = config.allowedHeaders.join(', ')
		headers['Access-Control-Max-Age'] = config.maxAge.toString()

		if (config.allowCredentials) {
			headers['Access-Control-Allow-Credentials'] = 'true'
		}

		if (config.exposedHeaders.length > 0) {
			headers['Access-Control-Expose-Headers'] =
				config.exposedHeaders.join(', ')
		}

		console.log(`✅ CORS allowed for origin: ${origin}`)
	} else {
		console.warn(`🚫 CORS blocked for origin: ${origin || 'undefined'}`)
		// Log CORS violation for monitoring
		console.log(
			JSON.stringify({
				event: 'cors_violation',
				origin: origin || 'undefined',
				timestamp: new Date().toISOString(),
				userAgent: 'cloudfront', // Will be enhanced by CloudFront
			}),
		)
	}

	return headers
}

function handlePreflightRequest(
	event: CloudFrontRequestEvent,
	config: CorsConfig,
): CloudFrontResponseEvent {
	const request = event.Records[0].cf.request
	const origin = request.headers['origin']?.[0]?.value
	const requestMethod =
		request.headers['access-control-request-method']?.[0]?.value
	const requestHeaders =
		request.headers['access-control-request-headers']?.[0]?.value

	console.log('🚀 Handling CORS preflight request', {
		origin,
		requestMethod,
		requestHeaders,
		clientIp: request.clientIp,
	})

	// Log preflight request for monitoring
	console.log(
		JSON.stringify({
			event: 'cors_preflight',
			origin: origin || 'undefined',
			requestMethod: requestMethod || 'undefined',
			requestHeaders: requestHeaders || 'undefined',
			timestamp: new Date().toISOString(),
		}),
	)

	const corsHeaders = createCorsHeaders(origin, config)

	const response: CloudFrontResponseEvent = {
		Records: [
			{
				cf: {
					config: event.Records[0].cf.config,
					request: {
						...request,
						headers: {
							...request.headers,
							...Object.fromEntries(
								Object.entries(corsHeaders).map(([key, value]) => [
									key.toLowerCase(),
									[{ key, value }],
								]),
							),
						},
					},
				},
			},
		],
	}

	return response
}

function handleActualRequest(
	event: CloudFrontResponseEvent,
	config: CorsConfig,
): CloudFrontResponseEvent {
	const response = event.Records[0].cf.response
	const request = event.Records[0].cf.request
	const origin = request.headers['origin']?.[0]?.value

	console.log('📨 Adding CORS headers to response', {
		status: response.status,
		statusDescription: response.statusDescription,
		origin,
	})

	const corsHeaders = createCorsHeaders(origin, config)

	// Add CORS headers to the response
	const updatedHeaders = {
		...response.headers,
		...Object.fromEntries(
			Object.entries(corsHeaders).map(([key, value]) => [
				key.toLowerCase(),
				[{ key, value }],
			]),
		),
	}

	const updatedResponse: CloudFrontResponseEvent = {
		Records: [
			{
				cf: {
					config: event.Records[0].cf.config,
					response: {
						...response,
						headers: updatedHeaders,
					},
				},
			},
		],
	}

	return updatedResponse
}

export async function handler(
	event: CloudFrontRequestEvent | CloudFrontResponseEvent,
): Promise<CloudFrontRequestEvent | CloudFrontResponseEvent> {
	try {
		const config = getCorsConfig()

		console.log('🔄 CORS Handler invoked', {
			eventType: 'Records' in event && event.Records[0].cf.config.eventType,
			environment: config.environment,
			allowedOriginsCount: config.allowedOrigins.length,
		})

		// Handle preflight OPTIONS requests
		if ('request' in event.Records[0].cf) {
			const requestEvent = event as CloudFrontRequestEvent
			const request = requestEvent.Records[0].cf.request

			if (request.method === 'OPTIONS') {
				return handlePreflightRequest(requestEvent, config)
			}

			// For non-OPTIONS requests, pass through but add origin to headers for response processing
			return requestEvent
		}

		// Handle response events (add CORS headers)
		const responseEvent = event as CloudFrontResponseEvent
		return handleActualRequest(responseEvent, config)
	} catch (error) {
		console.error('❌ Error in CORS handler:', error)

		// Return original event on error to avoid breaking requests
		return event
	}
}

// Export for testing
export {
	getCorsConfig,
	isOriginAllowed,
	createCorsHeaders,
	handlePreflightRequest,
	handleActualRequest,
}
