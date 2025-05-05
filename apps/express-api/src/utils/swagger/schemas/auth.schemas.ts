// Auth-related schema definitions
export const authSchemas = {
	AuthResponse: {
		type: 'object',
		required: ['message'],
		properties: {
			message: {
				type: 'string',
				example:
					'Registration successful. Please check your email for verification code.',
			},
			user: {
				type: 'object',
				properties: {
					id: {
						type: 'string',
						example: 'user123',
					},
					email: {
						type: 'string',
						example: 'user@example.com',
					},
				},
			},
			tokens: {
				type: 'object',
				properties: {
					accessToken: {
						type: 'string',
						example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
					},
					refreshToken: {
						type: 'string',
						example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
					},
					expiresIn: {
						type: 'number',
						example: 3600,
					},
				},
			},
		},
	},
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
	TokenResponse: {
		type: 'object',
		required: ['accessToken', 'refreshToken', 'expiresIn'],
		properties: {
			accessToken: {
				type: 'string',
				description: 'JWT access token',
				example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
			},
			refreshToken: {
				type: 'string',
				description: 'JWT refresh token',
				example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
			},
			expiresIn: {
				type: 'number',
				description: 'Token expiration time in seconds',
				example: 3600,
			},
		},
	},
	LoginRequest: {
		type: 'object',
		required: ['email', 'password'],
		properties: {
			email: {
				type: 'string',
				description: 'User email',
				example: 'user@example.com',
			},
			password: {
				type: 'string',
				description: 'User password',
				example: 'Password123!',
			},
		},
	},
	RegisterRequest: {
		type: 'object',
		required: ['email', 'password'],
		properties: {
			email: {
				type: 'string',
				description: 'User email',
				example: 'user@example.com',
			},
			password: {
				type: 'string',
				description: 'User password',
				example: 'Password123!',
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
	RefreshTokenRequest: {
		type: 'object',
		required: ['refreshToken'],
		properties: {
			refreshToken: {
				type: 'string',
				description: 'JWT refresh token',
				example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
			},
		},
	},
	ForgotPasswordRequest: {
		type: 'object',
		required: ['email'],
		properties: {
			email: {
				type: 'string',
				description: 'User email',
				example: 'user@example.com',
			},
		},
	},
	ConfirmForgotPasswordRequest: {
		type: 'object',
		required: ['email', 'code', 'newPassword'],
		properties: {
			email: {
				type: 'string',
				description: 'User email',
				example: 'user@example.com',
			},
			code: {
				type: 'string',
				description: 'Verification code sent to email',
				example: '123456',
			},
			newPassword: {
				type: 'string',
				description: 'New password',
				example: 'NewPassword123!',
			},
		},
	},
	ConfirmRegistration: {
		type: 'object',
		required: ['username', 'code'],
		properties: {
			username: {
				type: 'string',
				description: 'User email address',
				example: 'user@example.com',
			},
			code: {
				type: 'number',
				description: 'Verification code sent to email',
				example: 123456,
			},
		},
	},
	ResendConfirmationCode: {
		type: 'object',
		required: ['username'],
		properties: {
			username: {
				type: 'string',
				description: 'User email address',
				example: 'user@example.com',
			},
		},
	},
	// Add other auth schemas here
}
