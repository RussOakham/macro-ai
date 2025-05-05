// User-related schema definitions
export const userSchemas = {
	UserProfile: {
		type: 'object',
		required: ['id', 'email'],
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
			firstName: {
				type: 'string',
				description: 'User first name',
				example: 'John',
			},
			lastName: {
				type: 'string',
				description: 'User last name',
				example: 'Doe',
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
