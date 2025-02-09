import express from 'express'
import { StatusCodes } from 'http-status-codes'

import { pino } from '../../utils/logger.ts'
import { standardizeError } from '../../utils/standardize-error.ts'

import { CognitoService } from './auth.services.ts'
import {
	confirmRegistrationSchema,
	getUserSchema,
	loginSchema,
	registerSchema,
	resendConfirmationCodeSchema,
} from './auth.types.ts'

const { logger } = pino

interface IAuthController {
	register: express.Handler
	login: express.Handler
	confirmRegistration: express.Handler
	resendConfirmationCode: express.Handler
	getUser: express.Handler
}

interface ILoginResponse {
	accessToken: string
	refreshToken: string
	expiresIn: number
}

// TODO: Create Standardized Response Interface for Happy and Unhappy Paths
// TODO: Generate OpenAPI Docs
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

			const { email, password, confirmPassword } = parsedBody.data

			if (password !== confirmPassword) {
				res
					.status(StatusCodes.BAD_REQUEST)
					.json({ message: 'Passwords do not match' })
				return
			}

			const response = await cognito.signUpUser({
				email,
				password,
				confirmPassword,
			})

			if (
				response.$metadata.httpStatusCode !== undefined &&
				response.$metadata.httpStatusCode !== 200
			) {
				res
					.status(response.$metadata.httpStatusCode)
					.json({ message: response.$metadata.httpStatusCode })
				return
			}

			res.status(StatusCodes.CREATED).json({ message: 'Account Created' })
		} catch (error: unknown) {
			const err = standardizeError(error)
			logger.error(`[authRouter]: Error registering user: ${err.message}`)

			res
				.status(err.status)
				.json({ message: err.message, details: err.details })
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
				response.$metadata.httpStatusCode !== 200
			) {
				res
					.status(response.$metadata.httpStatusCode)
					.json({ message: response.$metadata.httpStatusCode })
				return
			}

			res.status(StatusCodes.OK).json({ message: 'Account confirmed' })
		} catch (error: unknown) {
			const err = standardizeError(error)
			logger.error(
				`[authRouter]: Error confirming user registration: ${err.message}`,
			)

			res
				.status(err.status)
				.json({ message: err.message, details: err.details })
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
				response.$metadata.httpStatusCode !== 200
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
				.status(err.status)
				.json({ message: err.message, details: err.details })
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
				response.$metadata.httpStatusCode !== 200
			) {
				res
					.status(response.$metadata.httpStatusCode)
					.json({ message: response.$metadata.httpStatusCode })
				return
			}

			const loginResponse: ILoginResponse = {
				accessToken: response.AuthenticationResult?.AccessToken ?? '',
				refreshToken: response.AuthenticationResult?.RefreshToken ?? '',
				expiresIn: response.AuthenticationResult?.ExpiresIn ?? 0,
			}

			res
				.cookie('accessToken', response.AuthenticationResult?.AccessToken, {
					httpOnly: true,
					secure: process.env.NODE_ENV === 'production',
					domain: process.env.COOKIE_DOMAIN,
					sameSite: 'strict',
					//5 minutes maxAge
					maxAge: 1000 * 60 * 5,
				})
				.cookie('refreshToken', response.AuthenticationResult?.RefreshToken, {
					httpOnly: true,
					secure: process.env.NODE_ENV === 'production',
					domain: process.env.COOKIE_DOMAIN,
					sameSite: 'strict',
					// 30 days maxAge
					maxAge: 1000 * 60 * 60 * 24 * 30,
				})
				.status(StatusCodes.OK)
				.json(loginResponse)
		} catch (error: unknown) {
			const err = standardizeError(error)

			logger.error(
				`[authRouter]: Error logging in user: ${err.status.toString()} ${err.message}`,
			)

			res
				.status(err.status)
				.json({ message: err.message, details: err.details })
		}
	},
	getUser: async (req, res) => {
		const cognito = new CognitoService()

		try {
			const parsedBody = getUserSchema.safeParse(req.body)

			if (!parsedBody.success) {
				const error = standardizeError(parsedBody.error)
				res.status(StatusCodes.BAD_REQUEST).json({ message: error.message })
				return
			}

			const { accessToken } = parsedBody.data

			const response = await cognito.getUser(accessToken)

			if (
				response.$metadata.httpStatusCode !== undefined &&
				response.$metadata.httpStatusCode !== 200
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
				`[authRouter]: Error getting user profile: ${err.status.toString()} ${err.message}`,
			)

			res
				.status(err.status)
				.json({ message: err.message, details: err.details })
		}
	},
}

export { authController }
