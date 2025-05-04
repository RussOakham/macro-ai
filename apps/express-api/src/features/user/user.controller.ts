import { Request, Response } from 'express'

import { standardizeError } from '../../utils/errors.ts'
import { pino } from '../../utils/logger.ts'

import { getUserById as getUserByIdService } from './user.services.ts'
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

			const user = await getUserByIdService(id)

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
}

export { userController }
