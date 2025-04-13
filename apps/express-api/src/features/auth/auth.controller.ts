import config from 'config'
import express from 'express'
import { StatusCodes } from 'http-status-codes'

import { decrypt, encrypt } from '../../utils/crypto.ts'
import { pino } from '../../utils/logger.ts'
import { standardizeError } from '../../utils/standardize-error.ts'

import { CognitoService } from './auth.services.ts'
import {
	confirmRegistrationSchema,
	loginSchema,
	registerSchema,
	resendConfirmationCodeSchema,
} from './auth.types.ts'

const { logger } = pino

interface IAuthController {
	register: express.Handler
	login: express.Handler
	logout: express.Handler
	refreshToken: express.Handler
	confirmRegistration: express.Handler
	resendConfirmationCode: express.Handler
	getUser: express.Handler
}

interface ILoginResponse {
	accessToken: string
	refreshToken: string
	expiresIn: number
}

const cookieDomain = config.get<string>('cookieDomain')
const nodeEnv = config.get<string>('nodeEnv')
const accessTokenExpiryMins = config.get<number>('awsCognitoAccessTokenExpiry')
const refreshTokenExpiryDays = config.get<number>(
	'awsCognitoRefreshTokenExpiry',
)

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
				logger.error(
					`[authRouter]: Error logging in user: ${response.$metadata.httpStatusCode.toString()}`,
				)
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

			const encryptedUsername = encrypt(response.Username)

			res
				.cookie(
					'macro-ai-accessToken',
					response.AuthenticationResult?.AccessToken,
					{
						// Short lived cookie, so non-httpOnly for ease of access by client
						httpOnly: false,
						secure: nodeEnv === 'production',
						// Add to config file
						domain: cookieDomain,
						sameSite: 'strict',
						maxAge: 1000 * 60 * accessTokenExpiryMins,
					},
				)
				.cookie(
					'marco-ai-refreshToken',
					response.AuthenticationResult?.RefreshToken,
					{
						// Long lived cookie, so httpOnly for improved security
						httpOnly: true,
						secure: nodeEnv === 'production',
						domain: cookieDomain,
						sameSite: 'strict',
						maxAge: 1000 * 60 * 60 * 24 * refreshTokenExpiryDays,
					},
				)
				.cookie('macro-ai-synchronize', encryptedUsername, {
					// Long lived cookie, so httpOnly for improved security
					// Encrypted username stored in cookie to enable refresh token journey
					httpOnly: true,
					secure: nodeEnv === 'production',
					domain: cookieDomain,
					sameSite: 'strict',
					maxAge: 1000 * 60 * 60 * 24 * refreshTokenExpiryDays,
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
	logout: async (req, res) => {
		const cognito = new CognitoService()
		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			const accessToken = req.cookies?.['macro-ai-accessToken'] as
				| string
				| undefined

			if (!accessToken) {
				logger.error(
					`[authRouter]: Error logging out user: ${accessToken ? 'No access token' : ''}`,
				)
				res
					.status(StatusCodes.UNAUTHORIZED)
					.json({ message: 'Unauthorized - Tokens not found' })
				return
			}

			await cognito.signOutUser(accessToken)

			// Clear Cookies
			res.clearCookie('macro-ai-accessToken', {
				domain: cookieDomain,
				sameSite: 'strict',
			})
			res.clearCookie('marco-ai-refreshToken', {
				domain: cookieDomain,
				sameSite: 'strict',
			})
			res.clearCookie('macro-ai-synchronize', {
				domain: cookieDomain,
				sameSite: 'strict',
			})

			res.status(StatusCodes.OK).json({ message: 'Logged out successfully' })
		} catch (error: unknown) {
			const err = standardizeError(error)
			logger.error(
				`[authRouter]: Error logging out user: ${err.status.toString()} ${err.message}`,
			)

			res
				.status(err.status)
				.json({ message: err.message, details: err.details })
		}
	},
	refreshToken: async (req, res) => {
		const cognito = new CognitoService()

		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			const refreshToken = req.cookies?.['marco-ai-refreshToken'] as
				| string
				| undefined

			if (!refreshToken) {
				res
					.status(StatusCodes.UNAUTHORIZED)
					.json({ message: 'Refresh token not found' })
				return
			}

			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			const encryptedUsername = req.cookies?.['macro-ai-synchronize'] as
				| string
				| undefined

			if (!encryptedUsername) {
				throw new Error('User data not found')
			}

			const decryptedUsername = decrypt(encryptedUsername)
			logger.info(`[authRouter]: Refreshing token for user: ${decryptedUsername}`)

			const response = await cognito.refreshToken(refreshToken, decryptedUsername)

			if (
				response.$metadata.httpStatusCode !== undefined &&
				response.$metadata.httpStatusCode !== 200
			) {
				logger.error(
					`[authRouter]: Error refreshing token: ${response.$metadata.httpStatusCode.toString()}`,
				)
				res
					.status(response.$metadata.httpStatusCode)
					.json({ message: response.$metadata.httpStatusCode })
				return
			}

			const refreshLoginResponse: ILoginResponse = {
				accessToken: response.AuthenticationResult?.AccessToken ?? '',
				refreshToken: response.AuthenticationResult?.RefreshToken ?? '',
				expiresIn: response.AuthenticationResult?.ExpiresIn ?? 0,
			}

			res
				.cookie(
					'macro-ai-accessToken',
					response.AuthenticationResult?.AccessToken,
					{
						// Short lived cookie, so non-httpOnly for ease of access by client
						httpOnly: false,
						secure: nodeEnv === 'production',
						// Add to config file
						domain: cookieDomain,
						sameSite: 'strict',
						maxAge: 1000 * 60 * accessTokenExpiryMins,
					},
				)
				.cookie(
					'marco-ai-refreshToken',
					response.AuthenticationResult?.RefreshToken,
					{
						// Long lived cookie, so httpOnly for improved security
						httpOnly: true,
						secure: nodeEnv === 'production',
						domain: cookieDomain,
						sameSite: 'strict',
						maxAge: 1000 * 60 * 60 * 24 * refreshTokenExpiryDays,
					},
				)
				.status(StatusCodes.OK)
				.json(refreshLoginResponse)
		} catch (error: unknown) {
			const err = standardizeError(error)
			logger.error(
				`[authRouter]: Error refreshing token: ${err.status.toString()} ${err.message}`,
			)

			res
				.status(err.status)
				.json({ message: err.message, details: err.details })
		}
	},
	getUser: async (req, res) => {
		const cognito = new CognitoService()

		try {
			// Get access token from cookie request header - Bearer <token>
			const authHeader = req.headers.authorization

			if (!authHeader) {
				res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' })
				return
			}

			const accessToken = authHeader.split(' ')[1]

			if (!accessToken) {
				res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' })
				return
			}

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

			interface IUserResponse {
				id: string
				email: string
				emailVerified: boolean
			}

			const userResponse: IUserResponse = {
				id: response.Username ?? '',
				email:
					response.UserAttributes?.find((attr) => attr.Name === 'email')
						?.Value ?? '',
				emailVerified:
					response.UserAttributes?.find(
						(attr) => attr.Name === 'email_verified',
					)?.Value === 'true',
			}

			res.status(StatusCodes.OK).json(userResponse)
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
