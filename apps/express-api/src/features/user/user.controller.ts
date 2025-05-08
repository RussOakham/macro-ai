import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'

import { tryCatch } from '../../utils/error-handling/try-catch.ts'
import { pino } from '../../utils/logger.ts'
import { ErrorType } from '../../utils/standardize-error.ts'

import { userService } from './user.services.ts'
import { TMessageBase, TUserResponse } from './user.types.ts'

const { logger } = pino

export const userController = {
	/**
	 * Get the current authenticated user's profile
	 * Requires the verifyAuth middleware to be applied
	 */
	getCurrentUser: async (req: Request, res: Response) => {
		// The userId is added by the verifyAuth middleware
		if (!req.userId) {
			logger.error('[userController - getCurrentUser]: No user ID in request')
			res.status(StatusCodes.UNAUTHORIZED).json({
				message: 'Authentication required',
			})
			return
		}

		const { data: user, error } = await tryCatch(
			userService.getUserById({ userId: req.userId }),
		)

		// Handle errors
		if (error) {
			logger.error({
				msg: '[userController - getCurrentUser]: Error retrieving current user',
				userId: req.userId,
				error: error.message,
				type: error.type,
				details: error.details,
			})
			switch (error.type) {
				case ErrorType.UnauthorizedError: {
					const authResponse: TMessageBase = {
						message: 'Authentication required',
					}

					res.status(StatusCodes.UNAUTHORIZED).json(authResponse)
					return
				}
				case ErrorType.NotFoundError: {
					const notFoundResponse: TMessageBase = {
						message: 'User not found',
					}
					res.status(StatusCodes.NOT_FOUND).json(notFoundResponse)
					return
				}
				default: {
					const internalResponse: TMessageBase = {
						message: 'Internal server error',
					}
					res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(internalResponse)
					return
				}
			}
		}

		const userResponse: TUserResponse = {
			user: {
				id: user.id,
				email: user.email,
				emailVerified: user.emailVerified,
				firstName: user.firstName,
				lastName: user.lastName,
				createdAt: user.createdAt,
				updatedAt: user.updatedAt,
				lastLogin: user.lastLogin,
			},
		}

		res.status(StatusCodes.OK).json(userResponse)
	},
}
