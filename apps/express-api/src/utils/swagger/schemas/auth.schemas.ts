// Auth-related schema definitions
export const authSchemas = {
	GetAuthUserResponse: {
		type: 'object',
		required: ['id', 'email', 'emailVerified'],
		properties: {
			id: {
				type: 'string',
				description: 'User ID',
				example: 'user123',
			},
			email: {
				type: 'string',
				description: 'User email',
				example: 'user@example.com',
			},
			emailVerified: {
				type: 'boolean',
				description: "Whether the user's email is verified",
				example: true,
			},
		},
	},
	// Add other auth schemas here
}
