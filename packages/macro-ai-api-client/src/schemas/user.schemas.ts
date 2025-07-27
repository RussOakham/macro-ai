import { z } from 'zod'

// ============================================================================
// SHARED SCHEMAS
// ============================================================================

// Full user profile schema
const userProfileSchema = z
	.object({
		id: z.string().uuid(),
		email: z.string().max(255),
		emailVerified: z.boolean().nullable(),
		firstName: z.string().max(255).nullable(),
		lastName: z.string().max(255).nullable(),
		createdAt: z.string().nullable(),
		updatedAt: z.string().nullable(),
		lastLogin: z.string().nullable(),
	})
	.passthrough()

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

// Currently no request schemas needed for user endpoints
// All user endpoints are GET requests with path parameters only

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

// GET /users/:id response
const getUsersId_Response = z
	.object({
		user: userProfileSchema,
	})
	.passthrough()

// GET /users/me response
const getUsersMe_Response = z
	.object({
		user: userProfileSchema,
	})
	.passthrough()

// ============================================================================
// EXPORTS
// ============================================================================

export const userSchemas = {
	// Response schemas
	getUsersId_Response,
	getUsersMe_Response,
	// Shared schemas
	userProfileSchema,
}

// Individual exports for direct access
export {
	// Response schemas
	getUsersId_Response,
	getUsersMe_Response,
	// Shared schemas
	userProfileSchema,
}
