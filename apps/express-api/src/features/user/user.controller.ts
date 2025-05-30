import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'

import { pino } from '../../utils/logger.ts'
import { standardizeError } from '../../utils/standardize-error.ts'

import { userService } from './user.services.ts'

const { logger } = pino

export const userController = {
	/**
	 * Get the current authenticated user's profile
	 * Requires the verifyAuth middleware to be applied
	 */
	getCurrentUser: async (req: Request, res: Response) => {
		try {
			// The userId is added by the verifyAuth middleware
			if (!req.userId) {
				logger.error('[userController - getCurrentUser]: No user ID in request')
				res.status(StatusCodes.UNAUTHORIZED).json({
					message: 'Authentication required',
				})
				return
			}

			const user = await userService.getUserById(req.userId)

			res.status(StatusCodes.OK).json(user)
		} catch (error: unknown) {
			const err = standardizeError(error)

			logger.error({
				msg: '[userController - getCurrentUser]: Error retrieving current user',
				userId: req.userId,
				error: err.message,
			})

			res.status(err.status).json({ message: err.message })
		}
	},
}
