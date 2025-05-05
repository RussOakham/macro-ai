// Error response schema definitions
export const errorSchemas = {
	// These can be reused across the API
	ErrorResponse: {
		type: 'object',
		properties: {
			message: {
				type: 'string',
				example: 'Error message',
			},
			details: {
				type: 'object',
				example: { field: 'Error details' },
			},
		},
	},
}
