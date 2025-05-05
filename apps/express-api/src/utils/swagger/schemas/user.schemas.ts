// User-related schema definitions
export const userSchemas = {
	User: {
		type: 'object',
		required: ['id', 'email', 'createdAt', 'updatedAt'],
		properties: {
			id: {
				type: 'string',
				description: 'User ID (from Cognito)',
				example: 'user123',
			},
			email: {
				type: 'string',
				description: 'User email',
				example: 'user@example.com',
			},
			createdAt: {
				type: 'string',
				format: 'date-time',
				description: 'User creation timestamp',
				example: '2023-01-01T00:00:00Z',
			},
			updatedAt: {
				type: 'string',
				format: 'date-time',
				description: 'User last update timestamp',
				example: '2023-01-01T00:00:00Z',
			},
			lastLoginAt: {
				type: 'string',
				format: 'date-time',
				description: 'User last login timestamp',
				example: '2023-01-01T00:00:00Z',
			},
		},
	},
}
