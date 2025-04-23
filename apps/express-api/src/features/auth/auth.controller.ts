import { StatusCodes } from 'http-status-codes'

import { config } from '../../../config/default.ts'
import {
	getAccessToken,
	getRefreshToken,
	getSynchronizeToken,
} from '../../utils/cookies.ts'
import { decrypt, encrypt } from '../../utils/crypto.ts'
import { pino } from '../../utils/logger.ts'
import { standardizeError } from '../../utils/standardize-error.ts'

import { CognitoService } from './auth.services.ts'
import {
	IAuthController,
	IAuthResponse,
	TConfirmRegistration,
	TGetUserResponse,
	TLogin,
	TLoginResponse,
	TRegister,
	TResendConfirmationCode,
} from './auth.types.ts'

const { logger } = pino

const nodeEnv = config.nodeEnv
const cookieDomain = config.cookieDomain
const refreshTokenExpiryDays = config.awsCognitoRefreshTokenExpiry

const authController: IAuthController = {
	register: async (req, res) => {
		const cognito = new CognitoService()
		try {
			const { email, password, confirmPassword } = req.body as TRegister

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
			const { username, code } = req.body as TConfirmRegistration

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
			const { username } = req.body as TResendConfirmationCode

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
			const { email, password } = req.body as TLogin

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
			const accessToken = getAccessToken(req, false) // Optional for logout

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
			const refreshToken = getRefreshToken(req)
			const encryptedUsername = getSynchronizeToken(req)

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
			const accessToken = getAccessToken(req)

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

			const userResponse: TGetUserResponse = {
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
				`[authRouter]: Error getting user: ${err.status.toString()} ${err.message}`,
			)

			res
				.status(err.status)
				.json({ message: err.message, details: err.details })
		}
	},
}

export { authController }
