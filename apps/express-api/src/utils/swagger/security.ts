// Security scheme definitions
export const securitySchemes = {
	cookieAuth: {
		type: 'apiKey',
		in: 'cookie',
		name: 'macro-ai-accessToken',
	},
	apiKeyAuth: {
		type: 'apiKey',
		in: 'header',
		name: 'X-API-KEY',
	},
}

// Default security requirements
export const security = [
	{
		cookieAuth: [],
		apiKeyAuth: [],
	},
]
