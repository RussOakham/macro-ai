import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'

import { CognitoService } from '../features/auth/auth.services.ts'
import { getAccessToken } from '../utils/cookies.ts'
import { pino } from '../utils/logger.ts'
import { standardizeError } from '../utils/standardize-error.ts'

const { logger } = pino
const cognito = new CognitoService()

/**
 * Middleware to verify authentication using Cognito access tokens
 * Extracts the access token from cookies, verifies it with Cognito,
 * and adds the user ID to the request object
 */
const verifyAuth = async (req: Request, res: Response, next: NextFunction) => {
	try {
		// Extract access token from cookies
		const accessToken = getAccessToken(req)

		if (!accessToken) {
			logger.warn('[middleware - verifyAuth]: No access token provided')
			res.status(StatusCodes.UNAUTHORIZED).json({
				message: 'Authentication required',
			})
			return
		}

		// Verify token with Cognito service
		const cognitoUser = await cognito.getAuthUser(accessToken)

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
	} catch (error: unknown) {
		const err = standardizeError(error)

		// Handle token expired error specifically
		if (err.message.includes('Token expired')) {
			logger.warn('[middleware - verifyAuth]: Token expired')
			res.status(StatusCodes.UNAUTHORIZED).json({
				message: 'Authentication token expired',
				code: 'TOKEN_EXPIRED',
			})
			return
		}

		logger.error({
			msg: '[middleware - verifyAuth]: Authentication error',
			error: err.message,
		})

		res.status(StatusCodes.UNAUTHORIZED).json({
			message: 'Authentication failed',
		})
	}
}

export { verifyAuth }
