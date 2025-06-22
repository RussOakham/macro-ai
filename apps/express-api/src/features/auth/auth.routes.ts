import { type Router } from 'express'
import { StatusCodes } from 'http-status-codes'

import { verifyAuth } from '../../middleware/auth.middleware.ts'
import { authRateLimiter } from '../../middleware/rate-limit.middleware.ts'
import { validate } from '../../middleware/validation.middleware.ts'
import {
	CognitoCodeMismatchErrorSchema,
	CognitoExpiredCodeErrorSchema,
	CognitoUsernameExistsErrorSchema,
	CognitoUserNotConfirmedErrorSchema,
	ConflictErrorSchema,
	ForbiddenErrorSchema,
	InternalServerErrorSchema,
	NotFoundErrorSchema,
	RateLimitErrorSchema,
	registry,
	UnauthorizedErrorSchema,
	ValidationErrorSchema,
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
	summary: 'Register new user',
	description:
		'Creates a new user account with email and password. Sends confirmation email to verify the account.',
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
			description: 'User registered successfully - confirmation email sent',
			content: {
				'application/json': {
					schema: authResponseSchema,
				},
			},
		},
		[StatusCodes.BAD_REQUEST]: {
			description:
				'Invalid request data - validation failed or passwords do not match',
			content: {
				'application/json': {
					schema: ValidationErrorSchema,
				},
			},
		},
		[StatusCodes.CONFLICT]: {
			description: 'Conflict - User already exists (from database check)',
			content: {
				'application/json': {
					schema: ConflictErrorSchema,
				},
			},
		},
		[StatusCodes.UNPROCESSABLE_ENTITY]: {
			description: 'User already exists in Cognito (UsernameExistsException)',
			content: {
				'application/json': {
					schema: CognitoUsernameExistsErrorSchema,
				},
			},
		},
		[StatusCodes.TOO_MANY_REQUESTS]: {
			description: 'Too many registration attempts - rate limit exceeded',
			content: {
				'application/json': {
					schema: RateLimitErrorSchema,
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: 'Server error - Cognito or database error',
			content: {
				'application/json': {
					schema: InternalServerErrorSchema,
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
	summary: 'Confirm user registration',
	description:
		'Confirms user registration using the confirmation code sent via email.',
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
			description:
				'Invalid confirmation code (CodeMismatchException) or request data validation failed',
			content: {
				'application/json': {
					schema: CognitoCodeMismatchErrorSchema,
				},
			},
		},
		[StatusCodes.GONE]: {
			description: 'Verification code has expired (ExpiredCodeException)',
			content: {
				'application/json': {
					schema: CognitoExpiredCodeErrorSchema,
				},
			},
		},
		[StatusCodes.NOT_FOUND]: {
			description: 'User not found',
			content: {
				'application/json': {
					schema: NotFoundErrorSchema,
				},
			},
		},
		[StatusCodes.FORBIDDEN]: {
			description: 'Forbidden - User already confirmed',
			content: {
				'application/json': {
					schema: ForbiddenErrorSchema,
				},
			},
		},
		[StatusCodes.TOO_MANY_REQUESTS]: {
			description: 'Too many confirmation attempts - rate limit exceeded',
			content: {
				'application/json': {
					schema: RateLimitErrorSchema,
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: 'Server error - Cognito or database error',
			content: {
				'application/json': {
					schema: InternalServerErrorSchema,
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
	summary: 'Resend confirmation code',
	description:
		"Resends the confirmation code to the user's email address for account verification.",
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
			description:
				'Invalid request data - validation failed or invalid email format',
			content: {
				'application/json': {
					schema: ValidationErrorSchema,
				},
			},
		},
		[StatusCodes.NOT_FOUND]: {
			description: 'User not found',
			content: {
				'application/json': {
					schema: NotFoundErrorSchema,
				},
			},
		},
		[StatusCodes.FORBIDDEN]: {
			description: 'Forbidden - User already confirmed',
			content: {
				'application/json': {
					schema: ForbiddenErrorSchema,
				},
			},
		},
		[StatusCodes.TOO_MANY_REQUESTS]: {
			description: 'Too many resend attempts - rate limit exceeded',
			content: {
				'application/json': {
					schema: RateLimitErrorSchema,
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: 'Server error - Cognito or database error',
			content: {
				'application/json': {
					schema: InternalServerErrorSchema,
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
	summary: 'User login',
	description:
		'Authenticates a user with email and password, returning access tokens upon successful login.',
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
			description: 'Invalid credentials or request data',
			content: {
				'application/json': {
					schema: ValidationErrorSchema,
				},
			},
		},
		[StatusCodes.UNAUTHORIZED]: {
			description: 'Unauthorized - Invalid email or password',
			content: {
				'application/json': {
					schema: UnauthorizedErrorSchema,
				},
			},
		},
		[StatusCodes.FORBIDDEN]: {
			description: 'Forbidden - User not confirmed (UserNotConfirmedException)',
			content: {
				'application/json': {
					schema: CognitoUserNotConfirmedErrorSchema,
				},
			},
		},
		[StatusCodes.TOO_MANY_REQUESTS]: {
			description: 'Too many login attempts - rate limit exceeded',
			content: {
				'application/json': {
					schema: RateLimitErrorSchema,
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: 'Server error - Cognito or database error',
			content: {
				'application/json': {
					schema: InternalServerErrorSchema,
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
	summary: 'Initiate password reset',
	description:
		"Initiates password reset process by sending a reset code to the user's email address.",
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
			description:
				'Password reset initiated successfully - reset code sent to email',
			content: {
				'application/json': {
					schema: authResponseSchema,
				},
			},
		},
		[StatusCodes.BAD_REQUEST]: {
			description: 'Invalid request data - validation failed',
			content: {
				'application/json': {
					schema: ValidationErrorSchema,
				},
			},
		},
		[StatusCodes.NOT_FOUND]: {
			description: 'User not found',
			content: {
				'application/json': {
					schema: NotFoundErrorSchema,
				},
			},
		},
		[StatusCodes.TOO_MANY_REQUESTS]: {
			description: 'Too many password reset attempts - rate limit exceeded',
			content: {
				'application/json': {
					schema: RateLimitErrorSchema,
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: 'Server error - Cognito or database error',
			content: {
				'application/json': {
					schema: InternalServerErrorSchema,
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
	summary: 'Confirm password reset',
	description:
		'Confirms password reset using the reset code and sets a new password.',
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
			description:
				'Invalid reset code (CodeMismatchException) or request data validation failed',
			content: {
				'application/json': {
					schema: CognitoCodeMismatchErrorSchema,
				},
			},
		},
		[StatusCodes.GONE]: {
			description: 'Reset code has expired (ExpiredCodeException)',
			content: {
				'application/json': {
					schema: CognitoExpiredCodeErrorSchema,
				},
			},
		},
		[StatusCodes.NOT_FOUND]: {
			description: 'User not found',
			content: {
				'application/json': {
					schema: NotFoundErrorSchema,
				},
			},
		},
		[StatusCodes.TOO_MANY_REQUESTS]: {
			description: 'Too many password reset attempts - rate limit exceeded',
			content: {
				'application/json': {
					schema: RateLimitErrorSchema,
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: 'Server error - Cognito or database error',
			content: {
				'application/json': {
					schema: InternalServerErrorSchema,
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
	summary: 'User logout',
	description: 'Logs out the authenticated user and invalidates their session.',
	security: [{ cookieAuth: [] }],
	responses: {
		[StatusCodes.OK]: {
			description: 'User logged out successfully',
			content: {
				'application/json': {
					schema: authResponseSchema,
				},
			},
		},
		[StatusCodes.UNAUTHORIZED]: {
			description: 'Unauthorized - Authentication required',
			content: {
				'application/json': {
					schema: UnauthorizedErrorSchema,
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: 'Server error - Cognito or database error',
			content: {
				'application/json': {
					schema: InternalServerErrorSchema,
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
	summary: 'Refresh access token',
	description: "Refreshes the user's access token using a valid refresh token.",
	responses: {
		[StatusCodes.OK]: {
			description: 'Access token refreshed successfully',
			content: {
				'application/json': {
					schema: loginResponseSchema,
				},
			},
		},
		[StatusCodes.BAD_REQUEST]: {
			description: 'Invalid refresh token or request data',
			content: {
				'application/json': {
					schema: ValidationErrorSchema,
				},
			},
		},
		[StatusCodes.UNAUTHORIZED]: {
			description: 'Unauthorized - Invalid or expired refresh token',
			content: {
				'application/json': {
					schema: UnauthorizedErrorSchema,
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: 'Server error - Cognito or database error',
			content: {
				'application/json': {
					schema: InternalServerErrorSchema,
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
	summary: 'Get authenticated user information',
	description: "Retrieves the authenticated user's information from Cognito.",
	security: [{ cookieAuth: [] }],
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
					schema: UnauthorizedErrorSchema,
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: 'Server error - Cognito or database error',
			content: {
				'application/json': {
					schema: InternalServerErrorSchema,
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
		validate(confirmForgotPasswordRequestSchema),
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
