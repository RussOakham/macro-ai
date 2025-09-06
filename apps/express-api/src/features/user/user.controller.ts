import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'

import { UnauthorizedError, ValidationError } from '../../utils/errors.ts'
import { pino } from '../../utils/logger.ts'
import { userService } from './user.services.ts'
import { IUserController, TUserResponse } from './user.types.ts'

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
		next: NextFunction,
	): Promise<void> => {
		// The userId is added by the verifyAuth middleware
		if (!req.userId) {
			logger.error('[userController - getCurrentUser]: No user ID in request')
			const error = new UnauthorizedError(
				'Authentication required',
				'userController',
			)
			next(error)
			return
		}

		const [user, userError] = await this.userService.getUserById({
			userId: req.userId,
		})

		// Handle errors using centralized error middleware
		if (userError) {
			logger.error({
				msg: '[userController - getCurrentUser]: Error retrieving current user',
				userId: req.userId,
				error: userError.message,
			})
			next(userError)
			return
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
	public getUserById = async (
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> => {
		const userId = req.params.id

		if (!userId) {
			logger.error('[userController - getUserById]: No user ID provided')
			const error = new ValidationError(
				'User ID is required',
				undefined,
				'userController',
			)
			next(error)
			return
		}

		const [user, userError] = await this.userService.getUserById({ userId })

		// Handle errors using centralized error middleware
		if (userError) {
			logger.error({
				msg: '[userController - getUserById]: Error retrieving user',
				userId,
				error: userError.message,
			})
			next(userError)
			return
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
