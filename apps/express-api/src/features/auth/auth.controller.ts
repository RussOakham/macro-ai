import { StatusCodes } from 'http-status-codes'

import { config } from '../../../config/default.ts'
import { decrypt, encrypt } from '../../utils/crypto.ts'
import { pino } from '../../utils/logger.ts'
import { standardizeError } from '../../utils/standardize-error.ts'

import {
	confirmRegistrationSchema,
	loginSchema,
	registerSchema,
	resendConfirmationCodeSchema,
} from './auth.schemas.ts'
import { CognitoService } from './auth.services.ts'
import { IAuthController, IAuthResponse, TLoginResponse } from './auth.types.ts'

const { logger } = pino

const nodeEnv = config.nodeEnv
const cookieDomain = config.cookieDomain
const refreshTokenExpiryDays = config.awsCognitoRefreshTokenExpiry

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

			const response = await cognito.signUpUser({
				email,
				password,
				confirmPassword,
			})

			if (
				response.$metadata.httpStatusCode !== undefined &&
				response.$metadata.httpStatusCode !== 200
			) {
				logger.error(
					`[authRouter]: Error registering user: ${response.$metadata.httpStatusCode.toString()}`,
				)
				res
					.status(response.$metadata.httpStatusCode)
					.json({ message: response.$metadata.httpStatusCode })
				return
			}

			if (!response.UserSub) {
				throw new Error('User not created - no user ID returned')
			}

			const authResponse: IAuthResponse = {
				message:
					'Registration successful. Please check your email for verification code.',
				user: {
					id: response.UserSub,
					email,
				},
			}

			res.status(StatusCodes.CREATED).json(authResponse)
		} catch (error) {
			const standardError = standardizeError(error)
			logger.error(`[authController]: Register error: ${standardError.message}`)
			res.status(standardError.status).json({ message: standardError.message })
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

			const loginResponse: TLoginResponse = {
				accessToken: response.AuthenticationResult?.AccessToken ?? '',
				refreshToken: response.AuthenticationResult?.RefreshToken ?? '',
				expiresIn: response.AuthenticationResult?.ExpiresIn ?? 0,
			}

			const encryptedUsername = encrypt(response.Username)

			res
				.cookie('macro-ai-accessToken', loginResponse.accessToken, {
					// Short lived cookie, so non-httpOnly for ease of access by client
					httpOnly: false,
					secure: nodeEnv === 'production',
					// Add to config file
					domain: cookieDomain,
					sameSite: 'strict',
					maxAge: loginResponse.expiresIn * 1000,
				})
				.cookie('marco-ai-refreshToken', loginResponse.refreshToken, {
					// Long lived cookie, so httpOnly for improved security
					httpOnly: true,
					secure: nodeEnv === 'production',
					domain: cookieDomain,
					sameSite: 'strict',
					maxAge: 1000 * 60 * 60 * 24 * refreshTokenExpiryDays,
				})
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
				logger.error('[authRouter]: Error logging out user: No access token')
				res
					.status(StatusCodes.UNAUTHORIZED)
					.json({ message: 'Unauthorized - Tokens not found' })
				return
			}

			try {
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
			} catch (error) {
				if (error instanceof Error && error.message === 'TOKEN_EXPIRED') {
					// If token is expired, still clear cookies but return success
					// since the user is effectively logged out
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

					res
						.status(StatusCodes.OK)
						.json({ message: 'Logged out successfully' })
					return
				}
				throw error
			}
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

			const response = await cognito.refreshToken(
				refreshToken,
				decryptedUsername,
			)

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

			// If no new refresh token is provided, use the existing one
			const newRefreshToken =
				response.AuthenticationResult?.RefreshToken ?? refreshToken

			const refreshLoginResponse: TLoginResponse = {
				accessToken: response.AuthenticationResult?.AccessToken ?? '',
				refreshToken: newRefreshToken,
				expiresIn: response.AuthenticationResult?.ExpiresIn ?? 0,
			}

			res
				.cookie('macro-ai-accessToken', refreshLoginResponse.accessToken, {
					// Short lived cookie, so non-httpOnly for ease of access by client
					httpOnly: false,
					secure: nodeEnv === 'production',
					// Add to config file
					domain: cookieDomain,
					sameSite: 'strict',
					maxAge: refreshLoginResponse.expiresIn * 1000,
				})
				.cookie('marco-ai-refreshToken', refreshLoginResponse.refreshToken, {
					// Long lived cookie, so httpOnly for improved security
					httpOnly: true,
					secure: nodeEnv === 'production',
					domain: cookieDomain,
					sameSite: 'strict',
					maxAge: 1000 * 60 * 60 * 24 * refreshTokenExpiryDays,
				})
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

			try {
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
			} catch (error) {
				if (error instanceof Error && error.message === 'TOKEN_EXPIRED') {
					res.status(StatusCodes.UNAUTHORIZED).json({
						message: 'Access token expired',
						code: 'TOKEN_EXPIRED',
					})
					return
				}
				throw error
			}
		} catch (error: unknown) {
			const err = standardizeError(error)
			logger.error(
				`[authRouter]: Error getting user: ${err.status.toString()} ${err.message}`,
			)

			res
				.status(err.status)
				.json({ message: err.message, details: err.details })
		}
	},
}

export { authController }
