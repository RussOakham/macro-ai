import { type Router } from 'express'
import { StatusCodes } from 'http-status-codes'

import { verifyAuth } from '../../middleware/auth.middleware.ts'
import { apiRateLimiter } from '../../middleware/rate-limit.middleware.ts'
import {
	InternalServerErrorSchema,
	NotFoundErrorSchema,
	RateLimitErrorSchema,
	registry,
	UnauthorizedErrorSchema,
	ValidationErrorSchema,
} from '../../utils/swagger/openapi-registry.ts'
import { userController } from './user.controller.ts'
import { userResponseSchema } from './user.schemas.ts'

// Register user routes with OpenAPI

// Get user by ID
registry.registerPath({
	method: 'get',
	path: '/users/{id}',
	tags: ['Users'],
	summary: 'Get user by ID',
	description:
		"Retrieves a user's profile information by their unique identifier. Requires authentication.",
	security: [{ cookieAuth: [] }],
	parameters: [
		{
			name: 'id',
			in: 'path',
			required: true,
			description: 'The unique identifier of the user',
			schema: {
				type: 'string',
				format: 'uuid',
				example: '123e4567-e89b-12d3-a456-426614174000',
			},
		},
	],
	responses: {
		[StatusCodes.OK]: {
			description: 'User profile retrieved successfully',
			content: {
				'application/json': {
					schema: userResponseSchema,
				},
			},
		},
		[StatusCodes.BAD_REQUEST]: {
			description: 'Invalid user ID format or missing required parameters',
			content: {
				'application/json': {
					schema: ValidationErrorSchema,
				},
			},
		},
		[StatusCodes.UNAUTHORIZED]: {
			description:
				'Unauthorized - Authentication required, token expired, or invalid token',
			content: {
				'application/json': {
					schema: UnauthorizedErrorSchema,
				},
			},
		},
		[StatusCodes.NOT_FOUND]: {
			description: 'User not found - No user exists with the specified ID',
			content: {
				'application/json': {
					schema: NotFoundErrorSchema,
				},
			},
		},
		[StatusCodes.TOO_MANY_REQUESTS]: {
			description: 'Too many requests - rate limit exceeded',
			content: {
				'application/json': {
					schema: RateLimitErrorSchema,
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: 'Internal server error - Database or service error',
			content: {
				'application/json': {
					schema: InternalServerErrorSchema,
				},
			},
		},
	},
})

// Get current user profile
registry.registerPath({
	method: 'get',
	path: '/users/me',
	tags: ['Users'],
	summary: 'Get current user profile',
	description:
		"Retrieves the authenticated user's profile information including personal details and account status",
	security: [{ cookieAuth: [] }],
	responses: {
		[StatusCodes.OK]: {
			description: 'User profile retrieved successfully',
			content: {
				'application/json': {
					schema: userResponseSchema,
				},
			},
		},
		[StatusCodes.BAD_REQUEST]: {
			description: 'Invalid request - Authentication token validation failed',
			content: {
				'application/json': {
					schema: ValidationErrorSchema,
				},
			},
		},
		[StatusCodes.UNAUTHORIZED]: {
			description:
				'Unauthorized - Authentication required, token expired, or invalid token',
			content: {
				'application/json': {
					schema: UnauthorizedErrorSchema,
				},
			},
		},
		[StatusCodes.NOT_FOUND]: {
			description:
				'User not found - The authenticated user does not exist in the system',
			content: {
				'application/json': {
					schema: NotFoundErrorSchema,
				},
			},
		},
		[StatusCodes.TOO_MANY_REQUESTS]: {
			description: 'Too many requests - rate limit exceeded',
			content: {
				'application/json': {
					schema: RateLimitErrorSchema,
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: 'Internal server error - Database or service error',
			content: {
				'application/json': {
					schema: InternalServerErrorSchema,
				},
			},
		},
	},
})

const userRouter = (router: Router) => {
	// Get current user
	router.get(
		'/users/me',
		verifyAuth,
		apiRateLimiter,
		userController.getCurrentUser,
	)

	// Get user by ID
	router.get(
		'/users/:id',
		verifyAuth,
		apiRateLimiter,
		userController.getUserById,
	)
}

export { userRouter }
