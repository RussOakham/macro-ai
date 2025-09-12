import { doubleCsrf } from 'csrf-csrf'

import { config } from './load-config.ts'

// CSRF protection configuration
const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
	getSecret: () => config.COOKIE_ENCRYPTION_KEY, // Use cookie encryption key for CSRF token generation
	getSessionIdentifier: (req) => {
		// Use user ID from auth middleware if available, otherwise use IP + User-Agent
		return req.userId || `${req.ip}-${req.get('User-Agent') || 'unknown'}`
	},
	cookieName: 'macro-ai-csrf-token',
	cookieOptions: {
		httpOnly: true,
		sameSite: 'strict',
		secure: config.NODE_ENV === 'production',
	},
	size: 64, // Token size in bytes
	ignoredMethods: ['GET', 'HEAD', 'OPTIONS'], // Methods that don't need CSRF protection
	getCsrfTokenFromRequest: (req) =>
		req.body._csrf || req.headers['x-csrf-token'],
})

// Export CSRF middleware and token generator
export { doubleCsrfProtection, generateCsrfToken }
