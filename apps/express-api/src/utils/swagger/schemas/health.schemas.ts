// Health-related schema definitions
export const healthSchemas = {
	HealthResponse: {
		type: 'object',
		properties: {
			message: {
				type: 'string',
				example: 'Api Health Status: OK',
			},
		},
	},
}
