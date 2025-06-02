import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'

import { tryCatch } from '../../utils/error-handling/try-catch.ts'
import { ErrorType } from '../../utils/errors.ts'
import { pino } from '../../utils/logger.ts'

import { userService } from './user.services.ts'
import { IUserController, TMessageBase, TUserResponse } from './user.types.ts'

const { logger } = pino

/**
 * UserController class that implements the IUserController interface
 * Handles all user-related requests
 */
class UserController implements IUserController {
	private readonly userService: typeof userService

	constructor(userSvc: typeof userService = userService) {
		this.userService = userSvc
	}

	/**
	 * Get the current authenticated user's profile
	 * Requires the verifyAuth middleware to be applied
	 */
	public getCurrentUser = async (
		req: Request,
		res: Response,
	): Promise<void> => {
		// The userId is added by the verifyAuth middleware
		if (!req.userId) {
			logger.error('[userController - getCurrentUser]: No user ID in request')
			res.status(StatusCodes.UNAUTHORIZED).json({
				message: 'Authentication required',
			})
			return
		}

		const { data: user, error } = await tryCatch(
			this.userService.getUserById({ userId: req.userId }),
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
	}

	/**
	 * Get a user by ID
	 * This method can be used for getting any user's profile
	 * Authorization checks should be implemented at the route level
	 */
	public getUserById = async (req: Request, res: Response): Promise<void> => {
		const userId = req.params.id

		if (!userId) {
			logger.error('[userController - getUserById]: No user ID provided')
			res.status(StatusCodes.BAD_REQUEST).json({
				message: 'User ID is required',
			})
			return
		}

		const { data: user, error } = await tryCatch(
			this.userService.getUserById({ userId }),
		)

		// Handle errors
		if (error) {
			logger.error({
				msg: '[userController - getUserById]: Error retrieving user',
				userId,
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
				case ErrorType.ForbiddenError: {
					const forbiddenResponse: TMessageBase = {
						message: 'Access denied',
					}
					res.status(StatusCodes.FORBIDDEN).json(forbiddenResponse)
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
	}
}

// Create an instance of the UserController
const userController = new UserController()

export { userController }
