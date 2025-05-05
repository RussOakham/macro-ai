// User-related schema definitions
export const userSchemas = {
	UserProfile: {
		type: 'object',
		required: ['id', 'email', 'emailVerified'],
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
			emailVerified: {
				type: 'boolean',
				description: 'Whether the user email is verified',
				example: true,
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
			lastLogin: {
				type: 'string',
				format: 'date-time',
				description: 'User last login timestamp',
				example: '2023-01-01T00:00:00Z',
			},
		},
	},
	// Add CreateUserRequest schema if needed for API documentation
	CreateUserRequest: {
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
			emailVerified: {
				type: 'boolean',
				description: 'Whether the user email is verified',
				example: false,
			},
			firstName: {
				type: 'string',
				description: 'User first name (optional)',
				example: 'John',
			},
			lastName: {
				type: 'string',
				description: 'User last name (optional)',
				example: 'Doe',
			},
		},
	},
}
