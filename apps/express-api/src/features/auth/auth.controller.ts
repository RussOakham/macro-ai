import express from 'express'
import { getReasonPhrase, StatusCodes } from 'http-status-codes'

import { CognitoService } from './auth.services.ts'
import { pino } from '../../utils/logger.ts'
import { registerSchema } from './auth.types.ts'
import { standardizeError } from '../../utils/standardize-error.ts'

const { logger } = pino

interface IAuthController {
	register: express.Handler
	login: express.Handler
	confirmRegistration: express.Handler
	getProfile: express.Handler
}

const authController: IAuthController = {
	register: async (req, res) => {
		const cognito = new CognitoService()
		try {
			const parsedBody = registerSchema.safeParse(req.body)

			if (!parsedBody.success) {
				const error = standardizeError(parsedBody.error)
				res.status(StatusCodes.BAD_REQUEST).json({ message: error.message })
				return
			}

			const { email, password, username } = parsedBody.data
			const response = await cognito.signUpUser({
				email,
				password,
				username,
			})
			res.status(StatusCodes.CREATED).json({ message: response })
		} catch (error: unknown) {
			const err = standardizeError(error)
			logger.error(`[authRouter]: Error registering user: ${err.message}`)

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
