import {
	boolean,
	pgTable,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

import { registerZodSchema } from '../../utils/swagger/openapi-registry.ts'

const usersTable = pgTable(
	'users',
	{
		id: uuid('id').primaryKey(),
		email: varchar('email', { length: 255 }).notNull().unique(),
		emailVerified: boolean('email_verified').default(false),
		firstName: varchar('first_name', { length: 255 }),
		lastName: varchar('last_name', { length: 255 }),
		createdAt: timestamp('created_at').defaultNow(),
		updatedAt: timestamp('updated_at').defaultNow(),
		lastLogin: timestamp('last_login'),
	},
	(users) => [uniqueIndex('email_idx').on(users.email)],
)

// Generate Zod schemas for type validation
const insertUserSchema = createInsertSchema(usersTable)
const selectUserSchema = createSelectSchema(usersTable)

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

// Custom Schemas
const messageBaseSchema = registerZodSchema(
	'MessageBase',
	z.object({
		message: z.string().openapi({ description: 'Response message' }),
	}),
	'Base response with a message',
)

// Add a schema for validating user ID
const userIdSchema = registerZodSchema(
	'UserId',
	z.string().uuid('Invalid user ID format'),
	'User ID validation schema',
)

export {
	insertUserSchema,
	messageBaseSchema,
	selectUserSchema,
	updateUserProfileSchema,
	userIdSchema,
	userProfileSchema,
	userResponseSchema,
	usersTable,
}
