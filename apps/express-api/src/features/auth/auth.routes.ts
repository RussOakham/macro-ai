import { type Router } from 'express'
import { StatusCodes } from 'http-status-codes'

import { verifyAuth } from '../../middleware/auth.middleware.ts'
import { authRateLimiter } from '../../middleware/rate-limit.middleware.ts'
import { validate } from '../../middleware/validation.middleware.ts'
import {
	ErrorResponseSchema,
	registry,
} from '../../utils/swagger/openapi-registry.ts'

import { authController } from './auth.controller.ts'
import {
	authResponseSchema,
	confirmForgotPasswordRequestSchema,
	confirmRegistrationRequestSchema,
	forgotPasswordRequestSchema,
	getAuthUserResponseSchema,
	loginRequestSchema,
	loginResponseSchema,
	registerUserRequestSchema,
	resendConfirmationCodeRequestSchema,
} from './auth.schemas.ts'

// Register auth routes with OpenAPI
// Register endpoint
registry.registerPath({
	method: 'post',
	path: '/auth/register',
	tags: ['Authentication'],
	request: {
		body: {
			content: {
				'application/json': {
					schema: registerUserRequestSchema,
				},
			},
		},
	},
	responses: {
		[StatusCodes.CREATED]: {
			description: 'User registered successfully',
			content: {
				'application/json': {
					schema: authResponseSchema,
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
		[StatusCodes.NOT_FOUND]: {
			description: 'User not found',
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

// Confirm registration endpoint
registry.registerPath({
	method: 'post',
	path: '/auth/confirm-registration',
	tags: ['Authentication'],
	request: {
		body: {
			content: {
				'application/json': {
					schema: confirmRegistrationRequestSchema,
				},
			},
		},
	},
	responses: {
		[StatusCodes.OK]: {
			description: 'User registration confirmed successfully',
			content: {
				'application/json': {
					schema: authResponseSchema,
				},
			},
		},
		[StatusCodes.BAD_REQUEST]: {
			description: 'Invalid confirmation code',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		[StatusCodes.NOT_FOUND]: {
			description: 'User not found',
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

// Resend confirmation code endpoint
registry.registerPath({
	method: 'post',
	path: '/auth/resend-confirmation-code',
	tags: ['Authentication'],
	request: {
		body: {
			content: {
				'application/json': {
					schema: resendConfirmationCodeRequestSchema,
				},
			},
		},
	},
	responses: {
		[StatusCodes.OK]: {
			description: 'Confirmation code resent successfully',
			content: {
				'application/json': {
					schema: authResponseSchema,
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
		[StatusCodes.NOT_FOUND]: {
			description: 'User not found',
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

// Login endpoint
registry.registerPath({
	method: 'post',
	path: '/auth/login',
	tags: ['Authentication'],
	request: {
		body: {
			content: {
				'application/json': {
					schema: loginRequestSchema,
				},
			},
		},
	},
	responses: {
		[StatusCodes.OK]: {
			description: 'User logged in successfully',
			content: {
				'application/json': {
					schema: loginResponseSchema,
				},
			},
		},
		[StatusCodes.BAD_REQUEST]: {
			description: 'Invalid credentials',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		[StatusCodes.NOT_FOUND]: {
			description: 'User not found',
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

// Forgot password endpoint
registry.registerPath({
	method: 'post',
	path: '/auth/forgot-password',
	tags: ['Authentication'],
	request: {
		body: {
			content: {
				'application/json': {
					schema: forgotPasswordRequestSchema,
				},
			},
		},
	},
	responses: {
		[StatusCodes.OK]: {
			description: 'Password reset initiated successfully',
			content: {
				'application/json': {
					schema: authResponseSchema,
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
		[StatusCodes.NOT_FOUND]: {
			description: 'User not found',
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

// Confirm forgot password endpoint
registry.registerPath({
	method: 'post',
	path: '/auth/confirm-forgot-password',
	tags: ['Authentication'],
	request: {
		body: {
			content: {
				'application/json': {
					schema: confirmForgotPasswordRequestSchema,
				},
			},
		},
	},
	responses: {
		[StatusCodes.OK]: {
			description: 'Password reset successfully',
			content: {
				'application/json': {
					schema: authResponseSchema,
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
		[StatusCodes.NOT_FOUND]: {
			description: 'User not found',
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

// Logout endpoint
registry.registerPath({
	method: 'post',
	path: '/auth/logout',
	tags: ['Authentication'],
	responses: {
		[StatusCodes.OK]: {
			description: 'User logged out successfully',
			content: {
				'application/json': {
					schema: authResponseSchema,
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

// Refresh token endpoint
registry.registerPath({
	method: 'post',
	path: '/auth/refresh',
	tags: ['Authentication'],
	responses: {
		[StatusCodes.OK]: {
			description: 'Access token refreshed successfully',
			content: {
				'application/json': {
					schema: loginRequestSchema,
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

// Get authenticated user endpoint
registry.registerPath({
	method: 'get',
	path: '/auth/user',
	tags: ['Authentication'],
	responses: {
		[StatusCodes.OK]: {
			description: 'User information retrieved successfully',
			content: {
				'application/json': {
					schema: getAuthUserResponseSchema,
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

const authRouter = (router: Router) => {
	// Register
	router.post(
		'/auth/register',
		authRateLimiter,
		validate(registerUserRequestSchema),
		authController.register,
	)

	// Confirm registration
	router.post(
		'/auth/confirm-registration',
		authRateLimiter,
		validate(confirmRegistrationRequestSchema),
		authController.confirmRegistration,
	)

	// Resend confirmation code
	router.post(
		'/auth/resend-confirmation-code',
		authRateLimiter,
		validate(resendConfirmationCodeRequestSchema),
		authController.resendConfirmationCode,
	)

	// Login
	router.post(
		'/auth/login',
		authRateLimiter,
		validate(loginRequestSchema),
		authController.login,
	)

	// Forgot password
	router.post(
		'/auth/forgot-password',
		authRateLimiter,
		validate(forgotPasswordRequestSchema),
		authController.forgotPassword,
	)

	// Confirm forgot password
	router.post(
		'/auth/confirm-forgot-password',
		authRateLimiter,
		authController.confirmForgotPassword,
	)

	// The following routes don't need the strict auth rate limiter
	// as they're already protected by authentication

	// Logout
	router.post('/auth/logout', verifyAuth, authController.logout)

	// Refresh token
	router.post('/auth/refresh', authController.refreshToken)

	// Get authenticated user
	router.get('/auth/user', verifyAuth, authController.getAuthUser)
}

export { authRouter }
