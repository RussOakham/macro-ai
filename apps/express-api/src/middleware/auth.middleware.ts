import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'

import { CognitoService } from '../features/auth/auth.services.ts'
import { getAccessToken } from '../utils/cookies.ts'
import { tryCatchSync } from '../utils/error-handling/try-catch.ts'
import { pino } from '../utils/logger.ts'
import { handleServiceError } from '../utils/response-handlers.ts'

const { logger } = pino
const cognito = new CognitoService()

/**
 * Middleware to verify authentication using Cognito access tokens
 * Extracts the access token from cookies, verifies it with Cognito,
 * and adds the user ID to the request object
 */
const verifyAuth = async (req: Request, res: Response, next: NextFunction) => {
	// Extract access token from cookies
	const { data: accessToken, error: accessTokenError } = tryCatchSync(
		() => getAccessToken(req),
		'verifyAuth',
	)

	if (accessTokenError) {
		// Handle token expired error specifically
		if (accessTokenError.message.includes('Token expired')) {
			logger.warn('[middleware - verifyAuth]: Token expired')
			res.status(StatusCodes.UNAUTHORIZED).json({
				message: 'Authentication token expired',
				code: 'TOKEN_EXPIRED',
			})
			return
		}

		logger.error({
			msg: '[middleware - verifyAuth]: Error retrieving access token',
			error: accessTokenError,
		})
		res.status(StatusCodes.UNAUTHORIZED).json({
			message: 'Authentication failed',
		})
		return
	}

	if (!accessToken) {
		logger.warn('[middleware - verifyAuth]: No access token provided')
		res.status(StatusCodes.UNAUTHORIZED).json({
			message: 'Authentication required',
		})
		return
	}

	// Verify token with Cognito service
	const { data: cognitoUser, error: cognitoError } =
		await cognito.getAuthUser(accessToken)

	if (cognitoError) {
		logger.error({
			msg: '[middleware - verifyAuth]: Error verifying token',
			error: cognitoError,
		})
		res.status(StatusCodes.UNAUTHORIZED).json({
			message: 'Authentication failed',
		})
		return
	}

	// Handle Cognito Service Errors
	const serviceResult = handleServiceError(
		cognitoUser,
		'Error verifying token',
		'middleware - verifyAuth',
	)

	if (!serviceResult.success) {
		res
			.status(serviceResult.error.status)
			.json({ message: serviceResult.error.message })
		return
	}

	// Check if user exists in Cognito
	if (!cognitoUser.Username) {
		logger.warn('[middleware - verifyAuth]: Invalid access token')
		res.status(StatusCodes.UNAUTHORIZED).json({
			message: 'Invalid authentication token',
		})
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
