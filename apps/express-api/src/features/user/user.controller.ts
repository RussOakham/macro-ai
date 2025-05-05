import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'

import { getAccessToken } from '../../utils/cookies.ts'
import { pino } from '../../utils/logger.ts'
import { standardizeError } from '../../utils/standardize-error.ts'

import { userService } from './user.services.ts'
import { IUserController } from './user.types.ts'

const { logger } = pino

const userController: IUserController = {
	getUserById: async (req: Request, res: Response) => {
		try {
			const { id } = req.params

			if (!id) {
				res.status(400).json({
					message: 'User ID is required',
				})
				return
			}

			const user = await userService.getUserById(id)

			if (!user) {
				res.status(404).json({
					message: 'User not found',
				})
				return
			}

			res.status(200).json(user)
			return
		} catch (error: unknown) {
			const standardError = standardizeError(error)
			logger.error(
				`[userController]: Get user by id error: ${standardError.message}`,
			)
			res.status(500).json({ message: 'Internal server error' })
			return
		}
	},

	/**
	 * Get the current user using their access token
	 */
	getCurrentUser: async (req: Request, res: Response) => {
		try {
			const accessToken = getAccessToken(req)
			const user = await userService.getUserByAccessToken(accessToken)

			if (!user) {
				res.status(StatusCodes.NOT_FOUND).json({
					message: 'User not found',
				})
				return
			}

			res.status(StatusCodes.OK).json(user)
			return
		} catch (error: unknown) {
			const standardError = standardizeError(error)
			logger.error(
				`[userController]: Get current user error: ${standardError.message}`,
			)
			res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
				message: 'Internal server error',
			})
			return
		}
	},
}

export { userController }
