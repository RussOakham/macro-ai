import { type Router } from 'express'
import { StatusCodes } from 'http-status-codes'

import { verifyAuth } from '../../middleware/auth.middleware.ts'
import { apiRateLimiter } from '../../middleware/rate-limit.middleware.ts'
import {
	ErrorResponseSchema,
	registry,
} from '../../utils/swagger/openapi-registry.ts'

import { userController } from './user.controller.ts'
import { userResponseSchema } from './user.schemas.ts'

// Register user routes with OpenAPI
// Get current user profile
registry.registerPath({
	method: 'get',
	path: '/users/me',
	tags: ['Users'],
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
		[StatusCodes.UNAUTHORIZED]: {
			description: 'Unauthorized - Authentication required or token expired',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		[StatusCodes.TOO_MANY_REQUESTS]: {
			description: 'Too many requests - rate limit exceeded',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: 'Internal server error',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
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
}

export { userRouter }
