// Central export file for all response definitions
export const responses = {
	BadRequest: {
		description:
			'Bad Request - The request was malformed or contains invalid parameters',
		content: {
			'application/json': {
				schema: {
					type: 'object',
					properties: {
						message: {
							type: 'string',
							example: 'Validation Failed',
						},
						details: {
							type: 'object',
							example: { field: 'Error details' },
						},
					},
				},
			},
		},
	},
	Unauthorized: {
		description: 'Unauthorized - Authentication is required or has failed',
		content: {
			'application/json': {
				schema: {
					type: 'object',
					properties: {
						message: {
							type: 'string',
							example: 'Invalid credentials',
						},
					},
				},
			},
		},
	},
	Forbidden: {
		description:
			'Forbidden - The user does not have permission to access the resource',
		content: {
			'application/json': {
				schema: {
					type: 'object',
					properties: {
						message: {
							type: 'string',
							example: 'Access denied',
						},
					},
				},
			},
		},
	},
	NotFound: {
		description: 'Not Found - The requested resource was not found',
		content: {
			'application/json': {
				schema: {
					type: 'object',
					properties: {
						message: {
							type: 'string',
							example: 'Resource not found',
						},
					},
				},
			},
		},
	},
	ServerError: {
		description: 'Server Error - An unexpected error occurred on the server',
		content: {
			'application/json': {
				schema: {
					type: 'object',
					properties: {
						message: {
							type: 'string',
							example: 'Internal server error',
						},
						details: {
							type: 'object',
							example: { error: 'Error details' },
						},
					},
				},
			},
		},
	},
}
