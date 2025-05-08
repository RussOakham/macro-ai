import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'

import { config } from '../../../config/default.ts'
import {
	getAccessToken,
	getRefreshToken,
	getSynchronizeToken,
} from '../../utils/cookies.ts'
import { decrypt, encrypt } from '../../utils/crypto.ts'
import { AppError } from '../../utils/errors.ts'
import { pino } from '../../utils/logger.ts'
import {
	handleError,
	handleServiceError,
	sendSuccess,
	validateData,
} from '../../utils/response-handlers.ts'
import { standardizeError } from '../../utils/standardize-error.ts'
import { createUser, updateUser } from '../user/user.data-access.ts'
import { userService } from '../user/user.services.ts'
import { TInsertUser } from '../user/user.types.ts'

import { CognitoService } from './auth.services.ts'
import {
	IAuthController,
	TAuthResponse,
	TConfirmForgotPasswordRequest,
	TConfirmRegistrationRequest,
	TForgotPasswordRequest,
	TGetAuthUserResponse,
	TLoginRequest,
	TLoginResponse,
	TRegisterUserRequest,
	TRegisterUserResponse,
	TResendConfirmationCodeRequest,
} from './auth.types.ts'
const { logger } = pino

const nodeEnv = config.nodeEnv
const cookieDomain = config.cookieDomain
const refreshTokenExpiryDays = config.awsCognitoRefreshTokenExpiry

const cognito = new CognitoService()

const authController: IAuthController = {
	register: async (req: Request, res: Response) => {
		try {
			const { email, password, confirmPassword } =
				req.body as TRegisterUserRequest

			// TODO: Check if user already exists in database

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
					`[authController]: Error registering user: ${response.$metadata.httpStatusCode.toString()}`,
				)
				const error = AppError.validation(
					`Registration failed: ${response.$metadata.httpStatusCode.toString()}`,
				)
				handleError(res, standardizeError(error), 'authController')
				return
			}

			if (!response.UserSub) {
				const error = AppError.validation(
					'User not created - no user ID returned',
					{
						response: response.$metadata,
					},
				)
				handleError(res, standardizeError(error), 'authController')
				return
			}

			// Create user in database with Zod validation
			const userData: TInsertUser = {
				id: response.UserSub,
				email,
			}

			const user = await createUser({ userData })

			logger.info(`[authController]: User created: ${user.id}`)

			const authResponse: TRegisterUserResponse = {
				message:
					'Registration successful. Please check your email for verification code.',
				user: {
					id: response.UserSub,
					email,
				},
			}

			sendSuccess(res, authResponse, StatusCodes.CREATED)
		} catch (error) {
			const standardError = standardizeError(error)
			logger.error(`[authController]: Register error: ${standardError.message}`)
			handleError(res, standardError, 'authController')
		}
	},

	confirmRegistration: async (req: Request, res: Response): Promise<void> => {
		try {
			const { email, code } = req.body as TConfirmRegistrationRequest

			const response = await cognito.confirmSignUp(email, code)

			// Check for service errors
			const serviceResult = handleServiceError(
				response,
				'Error confirming user registration',
				'authController',
			)
			if (!serviceResult.success) {
				res
					.status(serviceResult.error.status)
					.json({ message: serviceResult.error.message })
				return
			}

			// get user from database
			const user = await userService.getUserByEmail({ email })

			const dbUser = await updateUser(user.id, { emailVerified: true })
			if (!dbUser) {
				throw AppError.internal(
					'Failed to update user email verification',
					'authController',
				)
			}

			logger.info(`[authController]: User confirmed: ${email}`)

			// Return success response
			const authResponse: TAuthResponse = {
				message: 'Account confirmed successfully',
			}

			sendSuccess(res, authResponse, StatusCodes.OK)
		} catch (error: unknown) {
			const err = standardizeError(error)
			logger.error(
				`[authController]: Error confirming user registration: ${err.message}`,
			)

			handleError(res, err, 'authController')
		}
	},

	resendConfirmationCode: async (req: Request, res: Response) => {
		try {
			const { email } = req.body as TResendConfirmationCodeRequest

			const response = await cognito.resendConfirmationCode(email)

			if (
				response.$metadata.httpStatusCode !== undefined &&
				response.$metadata.httpStatusCode !== 200
			) {
				const error = AppError.validation(
					`Resend confirmation failed: ${response.$metadata.httpStatusCode.toString()}`,
				)
				handleError(res, standardizeError(error), 'authController')
				return
			}

			const authResponse: TAuthResponse = {
				message: 'Confirmation code resent successfully',
			}

			res.status(StatusCodes.OK).json(authResponse)
		} catch (error: unknown) {
			const err = standardizeError(error)
			logger.error(
				`[authController]: Error resending confirmation code: ${err.message}`,
			)
			handleError(res, err, 'authController')
		}
	},

	login: async (req: Request, res: Response) => {
		try {
			const { email, password } = req.body as TLoginRequest

			const response = await cognito.signInUser(email, password)

			if (
				response.$metadata.httpStatusCode !== undefined &&
				response.$metadata.httpStatusCode !== 200
			) {
				logger.error(
					`[authController]: Error logging in user: ${response.$metadata.httpStatusCode.toString()}`,
				)
				const error = AppError.validation(
					`Login failed: ${response.$metadata.httpStatusCode.toString()}`,
				)
				handleError(res, standardizeError(error), 'authController')
				return
			}

			const encryptedUsername = encrypt(response.Username)

			await userService.registerOrLoginUserById({
				id: response.Username,
				email,
			})

			const loginResponse: TLoginResponse = {
				message: 'Login successful',
				tokens: {
					accessToken: response.AuthenticationResult?.AccessToken ?? '',
					refreshToken: response.AuthenticationResult?.RefreshToken ?? '',
					expiresIn: response.AuthenticationResult?.ExpiresIn ?? 0,
				},
			}

			res
				.cookie('macro-ai-accessToken', loginResponse.tokens.accessToken, {
					httpOnly: false,
					secure: nodeEnv === 'production',
					domain: cookieDomain,
					sameSite: 'strict',
					maxAge: loginResponse.tokens.expiresIn * 1000,
				})
				.cookie('marco-ai-refreshToken', loginResponse.tokens.refreshToken, {
					httpOnly: true,
					secure: nodeEnv === 'production',
					domain: cookieDomain,
					sameSite: 'strict',
					maxAge: 1000 * 60 * 60 * 24 * refreshTokenExpiryDays,
				})
				.cookie('macro-ai-synchronize', encryptedUsername, {
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
				`[authController]: Error logging in user: ${err.status.toString()} ${err.message}`,
			)
			handleError(res, err, 'authController')
		}
	},

	logout: async (req: Request, res: Response) => {
		try {
			const accessToken = getAccessToken(req, false) // Optional for logout

			try {
				const response = await cognito.signOutUser(accessToken)

				if (
					response.$metadata.httpStatusCode !== undefined &&
					response.$metadata.httpStatusCode !== 200
				) {
					const error = AppError.validation(
						`Logout failed: ${response.$metadata.httpStatusCode.toString()}`,
					)
					handleError(res, standardizeError(error), 'authController')
					return
				}

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

				const authResponse: TAuthResponse = {
					message: 'Logout successful',
				}

				res.status(StatusCodes.OK).json(authResponse)
			} catch (error) {
				if (error instanceof Error && error.message === 'TOKEN_EXPIRED') {
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

					const authResponse: TAuthResponse = {
						message: 'Logout successful',
					}

					res.status(StatusCodes.OK).json(authResponse)
					return
				}
				throw error
			}
		} catch (error: unknown) {
			const err = standardizeError(error)
			logger.error(
				`[authController]: Error logging out user: ${err.status.toString()} ${err.message}`,
			)
			handleError(res, err, 'authController')
		}
	},

	refreshToken: async (req: Request, res: Response) => {
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
					`[authController]: Error refreshing token: ${response.$metadata.httpStatusCode.toString()}`,
				)
				const error = AppError.validation(
					`Refresh token failed: ${response.$metadata.httpStatusCode.toString()}`,
				)
				handleError(res, standardizeError(error), 'authController')
				return
			}

			const newRefreshToken =
				response.AuthenticationResult?.RefreshToken ?? refreshToken

			const refreshLoginResponse: TLoginResponse = {
				message: 'Token refreshed successfully',
				tokens: {
					accessToken: response.AuthenticationResult?.AccessToken ?? '',
					refreshToken: newRefreshToken,
					expiresIn: response.AuthenticationResult?.ExpiresIn ?? 0,
				},
			}

			res
				.cookie(
					'macro-ai-accessToken',
					refreshLoginResponse.tokens.accessToken,
					{
						httpOnly: false,
						secure: nodeEnv === 'production',
						domain: cookieDomain,
						sameSite: 'strict',
						maxAge: refreshLoginResponse.tokens.expiresIn * 1000,
					},
				)
				.cookie(
					'marco-ai-refreshToken',
					refreshLoginResponse.tokens.refreshToken,
					{
						httpOnly: true,
						secure: nodeEnv === 'production',
						domain: cookieDomain,
						sameSite: 'strict',
						maxAge: 1000 * 60 * 60 * 24 * refreshTokenExpiryDays,
					},
				)
				.cookie('macro-ai-synchronize', encryptedUsername, {
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
				`[authController]: Error refreshing token: ${err.status.toString()} ${err.message}`,
			)
			handleError(res, err, 'authController')
		}
	},

	forgotPassword: async (req: Request, res: Response) => {
		try {
			const { email } = req.body as TForgotPasswordRequest

			const response = await cognito.forgotPassword(email)

			if (
				response.$metadata.httpStatusCode !== undefined &&
				response.$metadata.httpStatusCode !== 200
			) {
				logger.error(
					`[authController]: Error initiating forgot password: ${response.$metadata.httpStatusCode.toString()}`,
				)
				const error = AppError.validation(
					`Forgot password failed: ${response.$metadata.httpStatusCode.toString()}`,
				)
				handleError(res, standardizeError(error), 'authController')
				return
			}

			const authResponse: TAuthResponse = {
				message: 'Password reset initiated successfully',
			}

			res.status(StatusCodes.OK).json(authResponse)
		} catch (error: unknown) {
			const err = standardizeError(error)
			logger.error(
				`[authController]: Error initiating forgot password: ${err.status.toString()} ${err.message}`,
			)
			handleError(res, err, 'authController')
		}
	},

	confirmForgotPassword: async (req: Request, res: Response) => {
		try {
			const { email, code, newPassword, confirmPassword } =
				req.body as TConfirmForgotPasswordRequest

			const response = await cognito.confirmForgotPassword(
				email,
				code,
				newPassword,
				confirmPassword,
			)

			if (
				response.$metadata.httpStatusCode !== undefined &&
				response.$metadata.httpStatusCode !== 200
			) {
				logger.error(
					`[authController]: Error confirming forgot password: ${response.$metadata.httpStatusCode.toString()}`,
				)
				const error = AppError.validation(
					`Confirm forgot password failed: ${response.$metadata.httpStatusCode.toString()}`,
				)
				handleError(res, standardizeError(error), 'authController')
				return
			}

			const authResponse: TAuthResponse = {
				message: 'Password reset successfully',
			}

			res.status(StatusCodes.OK).json(authResponse)
		} catch (error: unknown) {
			const err = standardizeError(error)
			logger.error(
				`[authController]: Error confirming forgot password: ${err.status.toString()} ${err.message}`,
			)
			handleError(res, err, 'authController')
		}
	},

	getAuthUser: async (req: Request, res: Response) => {
		try {
			const accessToken = getAccessToken(req)
			const response = await cognito.getAuthUser(accessToken)

			// Check for service errors
			const serviceResult = handleServiceError(
				response,
				'Failed to retrieve user information',
				'authController',
			)
			if (!serviceResult.success) {
				res
					.status(serviceResult.error.status)
					.json({ message: serviceResult.error.message })
				return
			}

			// Validate user data exists
			const usernameValidation = validateData(
				!!response.Username,
				'User not found',
				StatusCodes.NOT_FOUND,
				'authController',
			)
			if (!usernameValidation.valid) {
				res
					.status(usernameValidation.error.status)
					.json({ message: usernameValidation.error.message })
				return
			}

			// Validate response.Username is not undefined for type inference
			if (!response.Username) {
				logger.error('[authController]: User not found')
				res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found' })
				return
			}

			// Extract email from user attributes
			const email = response.UserAttributes?.find(
				(attr) => attr.Name === 'email',
			)?.Value

			// Validate email is no undefined for type inference
			if (!email) {
				logger.error('[authController]: User profile incomplete')
				res
					.status(StatusCodes.PARTIAL_CONTENT)
					.json({ message: 'User profile incomplete' })
				return
			}

			// Check for complete profile
			const emailValidation = validateData(
				!!email,
				'User profile incomplete',
				StatusCodes.PARTIAL_CONTENT,
				'authController',
			)
			if (!emailValidation.valid) {
				res
					.status(emailValidation.error.status)
					.json({ message: emailValidation.error.message })
				return
			}

			// Build complete user response
			const userResponse: TGetAuthUserResponse = {
				id: response.Username,
				email: email,
				emailVerified:
					response.UserAttributes?.find(
						(attr) => attr.Name === 'email_verified',
					)?.Value === 'true',
			}

			res.status(StatusCodes.OK).json(userResponse)
			return
		} catch (error: unknown) {
			const err = standardizeError(error)
			logger.error(
				`[authController]: Error retrieving user: ${err.status.toString()} ${err.message}`,
			)
			res.status(err.status).json({ message: err.message })
			return
		}
	},
} as const

export { authController }
