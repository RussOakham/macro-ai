import { z } from 'zod'

import { registerZodSchema } from '../../utils/swagger/openapi-registry.ts'

import { selectUserSchema } from './user.schema.ts'

// Convert Drizzle-generated schema to OpenAPI
const userProfileSchema = registerZodSchema(
	'UserProfile',
	selectUserSchema.openapi({ description: 'User profile information' }),
)

const updateUserProfileSchema = registerZodSchema(
	'UpdateUserProfile',
	z.object({
		firstName: z
			.string()
			.optional()
			.openapi({ description: 'User first name' }),
		lastName: z.string().optional().openapi({ description: 'User last name' }),
	}),
	'Update user profile request',
)

const userResponseSchema = registerZodSchema(
	'UserResponse',
	z.object({
		user: userProfileSchema.openapi({ description: 'User profile data' }),
	}),
	'User profile response',
)

export { updateUserProfileSchema, userProfileSchema, userResponseSchema }
