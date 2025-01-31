import express from 'express'
import { getReasonPhrase, StatusCodes } from 'http-status-codes'

import { CognitoService } from './auth.services.ts'
import { pino } from '../../utils/logger.ts'
import {
	confirmRegistrationSchema,
	loginSchema,
	registerSchema,
	resendConfirmationCodeSchema,
} from './auth.types.ts'
import { standardizeError } from '../../utils/standardize-error.ts'

const { logger } = pino

interface IAuthController {
	register: express.Handler
	login: express.Handler
	confirmRegistration: express.Handler
	resendConfirmationCode: express.Handler
	getProfile: express.Handler
}

// TODO: Standardize happy path response messaging. Log Cognito raw response???
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

			const { email, password } = parsedBody.data
			const response = await cognito.signUpUser({
				email,
				password,
			})

			console.log(
				'response.$metadata.httpStatusCode',
				response.$metadata.httpStatusCode,
			)

			if (
				response.$metadata.httpStatusCode !== undefined &&
				response.$metadata.httpStatusCode !== StatusCodes.OK
			) {
				res
					.status(response.$metadata.httpStatusCode)
					.json({ message: response.$metadata.httpStatusCode })
				return
			}

			res.status(StatusCodes.CREATED).json({ message: response })
		} catch (error: unknown) {
			const err = standardizeError(error)
			logger.error(`[authRouter]: Error registering user: ${err.message}`)

			res
				.status(StatusCodes.INTERNAL_SERVER_ERROR)
				.json({ message: getReasonPhrase(StatusCodes.INTERNAL_SERVER_ERROR) })
		}
	},
	confirmRegistration: async (req, res) => {
		const cognito = new CognitoService()

		try {
			const parsedBody = confirmRegistrationSchema.safeParse(req.body)

			if (!parsedBody.success) {
				const error = standardizeError(parsedBody.error)
				res.status(StatusCodes.BAD_REQUEST).json({ message: error.message })
				return
			}

			const { username, code } = parsedBody.data

			const response = await cognito.confirmSignUp(username, code)

			if (
				response.$metadata.httpStatusCode !== undefined &&
				response.$metadata.httpStatusCode !== StatusCodes.OK
			) {
				res
					.status(response.$metadata.httpStatusCode)
					.json({ message: response.$metadata.httpStatusCode })
				return
			}

			res.status(StatusCodes.OK).json({ message: response })
		} catch (error: unknown) {
			const err = standardizeError(error)
			logger.error(
				`[authRouter]: Error confirming user registration: ${err.message}`,
			)

			res
				.status(StatusCodes.INTERNAL_SERVER_ERROR)
				.json({ message: getReasonPhrase(StatusCodes.INTERNAL_SERVER_ERROR) })
		}
	},
	resendConfirmationCode: async (req, res) => {
		const cognito = new CognitoService()

		try {
			const parsedBody = resendConfirmationCodeSchema.safeParse(req.body)

			if (!parsedBody.success) {
				const error = standardizeError(parsedBody.error)
				res.status(StatusCodes.BAD_REQUEST).json({ message: error.message })
				return
			}

			const { username } = parsedBody.data

			const response = await cognito.resendConfirmationCode(username)

			if (
				response.$metadata.httpStatusCode !== undefined &&
				response.$metadata.httpStatusCode !== StatusCodes.OK
			) {
				res
					.status(response.$metadata.httpStatusCode)
					.json({ message: response.$metadata.httpStatusCode })
				return
			}

			res.status(StatusCodes.OK).json({ message: response })
		} catch (error: unknown) {
			const err = standardizeError(error)
			logger.error(
				`[authRouter]: Error resending confirmation code: ${err.message}`,
			)

			res
				.status(StatusCodes.INTERNAL_SERVER_ERROR)
				.json({ message: getReasonPhrase(StatusCodes.INTERNAL_SERVER_ERROR) })
		}
	},
	login: async (req, res) => {
		const cognito = new CognitoService()

		try {
			const parsedBody = loginSchema.safeParse(req.body)

			if (!parsedBody.success) {
				const error = standardizeError(parsedBody.error)
				res.status(StatusCodes.BAD_REQUEST).json({ message: error.message })
				return
			}

			const { email, password } = parsedBody.data

			const response = await cognito.signInUser(email, password)

			if (
				response.$metadata.httpStatusCode !== undefined &&
				response.$metadata.httpStatusCode !== StatusCodes.OK
			) {
				res
					.status(response.$metadata.httpStatusCode)
					.json({ message: response.$metadata.httpStatusCode })
				return
			}

			res.status(StatusCodes.OK).json({ message: response })
		} catch (error: unknown) {
			const err = standardizeError(error)
			logger.error(`[authRouter]: Error logging in user: ${err.message}`)

			res
				.status(StatusCodes.INTERNAL_SERVER_ERROR)
				.json({ message: getReasonPhrase(StatusCodes.INTERNAL_SERVER_ERROR) })
		}
	},
	getProfile: (req, res) => {
		res.json({})
	},
}

export { authController }
