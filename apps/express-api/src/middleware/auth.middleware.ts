import type { NextFunction, Request, Response } from 'express'

import { CognitoService } from '../features/auth/auth.services.ts'
import { getAccessToken } from '../utils/cookies.ts'
import { tryCatchSync } from '../utils/error-handling/try-catch.ts'
import { UnauthorizedError } from '../utils/errors.ts'
import { pino } from '../utils/logger.ts'
import { handleServiceError } from '../utils/response-handlers.ts'

const { logger } = pino
const cognito = new CognitoService()

/**
 * Middleware to verify authentication using Cognito access tokens
 * Uses Go-style error handling with centralized error middleware
 * Extracts the access token from cookies, verifies it with Cognito,
 * and adds the user ID to the request object
 */
const verifyAuth = async (req: Request, res: Response, next: NextFunction) => {
	// Extract access token from cookies using Go-style error handling
	const [accessToken, accessTokenError] = tryCatchSync(
		() => getAccessToken(req),
		'verifyAuth',
	)

	if (accessTokenError) {
		// Handle token expired error specifically
		if (accessTokenError.message.includes('Token expired')) {
			logger.warn('[middleware - verifyAuth]: Token expired')
			const error = new UnauthorizedError(
				'Authentication token expired',
				'verifyAuth middleware',
			)
			next(error)
			return
		}

		logger.error({
			msg: '[middleware - verifyAuth]: Error retrieving access token',
			error: accessTokenError.message,
		})
		const error = new UnauthorizedError(
			'Authentication failed',
			'verifyAuth middleware',
		)
		next(error)
		return
	}

	if (!accessToken) {
		logger.warn('[middleware - verifyAuth]: No access token provided')
		const error = new UnauthorizedError(
			'Authentication required',
			'verifyAuth middleware',
		)
		next(error)
		return
	}

	// Verify token with Cognito service using Go-style error handling
	const [cognitoUser, cognitoError] = await cognito.getAuthUser(accessToken)

	if (cognitoError) {
		logger.error({
			msg: '[middleware - verifyAuth]: Error verifying token',
			error: cognitoError.message,
		})
		// Pass the original error from the service layer
		next(cognitoError)
		return
	}

	// Handle Cognito Service Errors
	const serviceResult = handleServiceError(
		cognitoUser,
		'Error verifying token',
		'middleware - verifyAuth',
	)

	if (!serviceResult.success) {
		const error = new UnauthorizedError(
			serviceResult.error.message,
			'verifyAuth middleware',
		)
		next(error)
		return
	}

	// Check if user exists in Cognito
	if (!cognitoUser.Username) {
		logger.warn('[middleware - verifyAuth]: Invalid access token')
		const error = new UnauthorizedError(
			'Invalid authentication token',
			'verifyAuth middleware',
		)
		next(error)
		return
	}

	// Add user ID to request object for route handlers
	req.userId = cognitoUser.Username

	logger.debug({
		msg: '[middleware - verifyAuth]: Authentication successful',
		userId: req.userId,
	})

	next()
}

export { verifyAuth }
