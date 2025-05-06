import { type Router } from 'express'
import { StatusCodes } from 'http-status-codes'

import { verifyAuth } from '../../middleware/auth.middleware.ts'
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
		[StatusCodes.BAD_REQUEST]: {
			description: 'Invalid request data',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		[StatusCodes.UNAUTHORIZED]: {
			description: 'Unauthorized - Authentication required',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		[StatusCodes.FORBIDDEN]: {
			description: 'Forbidden - User already confirmed',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		[StatusCodes.CONFLICT]: {
			description: 'Conflict - User already confirmed',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		[StatusCodes.TOO_MANY_REQUESTS]: {
			description: 'Too many requests',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: 'Server error',
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
	router.get('/users/me', verifyAuth, userController.getCurrentUser)
}

export { userRouter }
