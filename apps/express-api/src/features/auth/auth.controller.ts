import express from 'express'
import { getReasonPhrase, StatusCodes } from 'http-status-codes'

import cognitoUserPoolHelper from './auth.services.ts'
import { pino } from '../../utils/logger.ts'

const { logger } = pino

interface IAuthController {
	register: express.Handler
	login: express.Handler
	confirmRegistration: express.Handler
	getProfile: express.Handler
}

const authController: IAuthController = {
	register: async (req, res) => {
		try {
			// TODO: Add type-safe validation
			const { email, password } = req.body as {
				email: string
				password: string
			}
			const response = await cognitoUserPoolHelper.register({
				email,
				password,
			})
			res.status(StatusCodes.CREATED).json({ message: response })
		} catch (error: unknown) {
			logger.error(
				`[authRouter]: Error registering user: ${(error as Error).message}`,
			)

			res
				.status(StatusCodes.INTERNAL_SERVER_ERROR)
				.json({ message: getReasonPhrase(StatusCodes.INTERNAL_SERVER_ERROR) })
		}
	},
	login: (req, res) => {
		res.json(req.body)
	},
	confirmRegistration: (req, res) => {
		res.json(req.body)
	},
	getProfile: (req, res) => {
		res.json({})
	},
}

export { authController }
