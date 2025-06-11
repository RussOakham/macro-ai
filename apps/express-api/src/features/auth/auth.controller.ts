import { Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'

import { config } from '../../../config/default.ts'
import {
	getAccessToken,
	getRefreshToken,
	getSynchronizeToken,
} from '../../utils/cookies.ts'
import { decrypt, encrypt } from '../../utils/crypto.ts'
import { tryCatchSync } from '../../utils/error-handling/try-catch.ts'
import { AppError, standardizeError } from '../../utils/errors.ts'
import { pino } from '../../utils/logger.ts'
import {
	handleError,
	handleServiceError,
	validateData,
} from '../../utils/response-handlers.ts'
import { userRepository } from '../user/user.data-access.ts'
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

/**
 * AuthController class that implements the IAuthController interface
 * Handles all authentication related requests
 */
class AuthController implements IAuthController {
	private readonly cognito: CognitoService
	private readonly userService: typeof userService
	private readonly userRepository: typeof userRepository

	constructor(
		cognitoService: CognitoService = new CognitoService(),
		userSvc: typeof userService = userService,
		userRepo: typeof userRepository = userRepository,
	) {
		this.cognito = cognitoService
		this.userService = userSvc
		this.userRepository = userRepo
	}

	public register = async (req: Request, res: Response): Promise<void> => {
		const { email, password, confirmPassword } =
			req.body as TRegisterUserRequest

		// Check if user already exists
		const { data: getUserResponse, error: getUserError } =
			await this.userService.getUserByEmail({ email })

		if (getUserError) {
			handleError(res, getUserError, 'authController')
			return
		}

		if (getUserResponse) {
			const error = AppError.conflict(
				'User already exists',
				'authController - register',
			)
			handleError(res, standardizeError(error), 'authController')
			return
		}

		// Register user with Cognito
		const { data: signUpResponse, error: signUpError } =
			await this.cognito.signUpUser({ email, password, confirmPassword })

		if (signUpError) {
			handleError(res, signUpError, 'authController')
			return
		}

		// Check for Cognito service errors
		const serviceResult = handleServiceError(
			signUpResponse,
			'Error registering user',
			'authController',
		)

		if (!serviceResult.success) {
			res
				.status(serviceResult.error.status)
				.json({ message: serviceResult.error.message })
			return
		}

		// Check for service errors
		if (!signUpResponse.UserSub) {
			const error = AppError.validation(
				'User not created - no user ID returned',
				'authController - register',
			)
			handleError(res, standardizeError(error), 'authController')
			return
		}

		// Create user in database with Zod validation
		const userData: TInsertUser = {
			id: signUpResponse.UserSub,
			email,
		}

		const { data: user, error: userError } =
			await this.userRepository.createUser({ userData })

		if (userError) {
			handleError(res, userError, 'authController')
			return
		}

		logger.info(`[authController]: User created: ${user.id}`)

		const authResponse: TRegisterUserResponse = {
			message:
				'Registration successful. Please check your email for verification code.',
			user: {
				id: signUpResponse.UserSub,
				email,
			},
		}

		res.status(StatusCodes.CREATED).json(authResponse)
	}

	public confirmRegistration = async (
		req: Request,
		res: Response,
	): Promise<void> => {
		const { email, code } = req.body as TConfirmRegistrationRequest

		// Confirm user registration with Cognito
		const { data: confirmSignUpResponse, error: confirmSignUpError } =
			await this.cognito.confirmSignUp(email, code)

		if (confirmSignUpError) {
			handleError(res, confirmSignUpError, 'authController')
			return
		}

		// Check for service errors
		const serviceResult = handleServiceError(
			confirmSignUpResponse,
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
		const { data: user, error: userError } =
			await this.userService.getUserByEmail({ email })

		if (userError) {
			handleError(res, userError, 'authController')
			return
		}

		if (!user) {
			const error = AppError.notFound('User not found', 'authController')
			handleError(res, standardizeError(error), 'authController')
			return
		}

		// Update user email verification status in database
		const { data: updatedUser, error: updatedUserError } =
			await this.userRepository.updateUser(user.id, {
				emailVerified: true,
			})

		if (updatedUserError) {
			handleError(res, updatedUserError, 'authController')
			return
		}

		if (!updatedUser) {
			const error = AppError.internal(
				'Failed to update user email verification',
				'authController',
			)
			handleError(res, standardizeError(error), 'authController')
			return
		}

		const authResponse: TAuthResponse = {
			message: 'Email confirmed successfully',
		}

		res.status(StatusCodes.OK).json(authResponse)
	}

	public resendConfirmationCode = async (
		req: Request,
		res: Response,
	): Promise<void> => {
		const { email } = req.body as TResendConfirmationCodeRequest

		// Resend confirmation code with Cognito
		const {
			data: resendConfirmationCodeResponse,
			error: resendConfirmationCodeError,
		} = await this.cognito.resendConfirmationCode(email)

		if (resendConfirmationCodeError) {
			handleError(res, resendConfirmationCodeError, 'authController')
			return
		}

		// Check for service errors
		const serviceResult = handleServiceError(
			resendConfirmationCodeResponse,
			'Error resending confirmation code',
			'authController',
		)
		if (!serviceResult.success) {
			res
				.status(serviceResult.error.status)
				.json({ message: serviceResult.error.message })
			return
		}

		const authResponse: TAuthResponse = {
			message: 'Confirmation code resent successfully',
		}

		res.status(StatusCodes.OK).json(authResponse)
	}

	public login = async (req: Request, res: Response): Promise<void> => {
		const { email, password } = req.body as TLoginRequest

		// Login user with Cognito
		const { data: signInResponse, error: signInError } =
			await this.cognito.signInUser(email, password)

		if (signInError) {
			handleError(res, signInError, 'authController')
			return
		}

		// Check for service errors
		const serviceResult = handleServiceError(
			signInResponse,
			'Error logging in user',
			'authController',
		)
		if (!serviceResult.success) {
			res
				.status(serviceResult.error.status)
				.json({ message: serviceResult.error.message })
			return
		}

		// Use the encrypt function with the new return type
		const { data: encryptedUsername, error: encryptError } = encrypt(
			signInResponse.Username,
		)

		if (encryptError) {
			handleError(res, encryptError, 'authController')
			return
		}

		// Register or login user in database
		const { data: user, error: userError } =
			await this.userService.registerOrLoginUserById({
				id: signInResponse.Username,
				email,
			})

		if (userError) {
			handleError(res, userError, 'authController')
			return
		}

		logger.info(`[authController]: User logged in: ${user.id}`)

		const loginResponse: TLoginResponse = {
			message: 'Login successful',
			tokens: {
				accessToken: signInResponse.AuthenticationResult?.AccessToken ?? '',
				refreshToken: signInResponse.AuthenticationResult?.RefreshToken ?? '',
				expiresIn: signInResponse.AuthenticationResult?.ExpiresIn ?? 0,
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
			.cookie('macro-ai-refreshToken', loginResponse.tokens.refreshToken, {
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
	}

	public logout = async (req: Request, res: Response): Promise<void> => {
		// Extract access token from cookies
		const { data: accessToken, error: accessTokenError } = tryCatchSync(
			() => getAccessToken(req),
			'authController - logout',
		)

		if (accessTokenError) {
			handleError(res, accessTokenError, 'authController')
			return
		}

		// Logout user with Cognito
		const { data: signOutResponse, error: signOutError } =
			await this.cognito.signOutUser(accessToken)

		if (signOutError) {
			handleError(res, signOutError, 'authController')
			return
		}

		// Check for service errors
		const serviceResult = handleServiceError(
			signOutResponse,
			'Error logging out user',
			'authController',
		)
		if (!serviceResult.success) {
			res
				.status(serviceResult.error.status)
				.json({ message: serviceResult.error.message })
			return
		}

		const authResponse: TAuthResponse = {
			message: 'Logout successful',
		}

		res
			.clearCookie('macro-ai-accessToken', {
				domain: cookieDomain,
				sameSite: 'strict',
			})
			.clearCookie('macro-ai-refreshToken', {
				domain: cookieDomain,
				sameSite: 'strict',
			})
			.clearCookie('macro-ai-synchronize', {
				domain: cookieDomain,
				sameSite: 'strict',
			})
			.status(StatusCodes.OK)
			.json(authResponse)
	}

	public refreshToken = async (req: Request, res: Response): Promise<void> => {
		const refreshToken = getRefreshToken(req)
		const encryptedUsername = getSynchronizeToken(req)

		// Use the decrypt function with the new return type
		const { data: decryptedUsername, error: decryptError } =
			decrypt(encryptedUsername)

		if (decryptError) {
			handleError(res, decryptError, 'authController')
			return
		}

		// Refresh token with Cognito
		const { data: refreshTokenResponse, error: refreshTokenError } =
			await this.cognito.refreshToken(refreshToken, decryptedUsername)

		if (refreshTokenError) {
			handleError(res, refreshTokenError, 'authController')
			return
		}

		// Check for service errors
		const serviceResult = handleServiceError(
			refreshTokenResponse,
			'Error refreshing token',
			'authController',
		)
		if (!serviceResult.success) {
			res
				.status(serviceResult.error.status)
				.json({ message: serviceResult.error.message })
			return
		}

		const newRefreshToken =
			refreshTokenResponse.AuthenticationResult?.RefreshToken ?? refreshToken

		const refreshLoginResponse: TLoginResponse = {
			message: 'Token refreshed successfully',
			tokens: {
				accessToken:
					refreshTokenResponse.AuthenticationResult?.AccessToken ?? '',
				refreshToken: newRefreshToken,
				expiresIn: refreshTokenResponse.AuthenticationResult?.ExpiresIn ?? 0,
			},
		}

		res
			.cookie('macro-ai-accessToken', refreshLoginResponse.tokens.accessToken, {
				httpOnly: false,
				secure: nodeEnv === 'production',
				domain: cookieDomain,
				sameSite: 'strict',
				maxAge: refreshLoginResponse.tokens.expiresIn * 1000,
			})
			.cookie(
				'macro-ai-refreshToken',
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
	}

	public forgotPassword = async (
		req: Request,
		res: Response,
	): Promise<void> => {
		const { email } = req.body as TForgotPasswordRequest

		// Initiate forgot password with Cognito
		const { data: forgotPasswordResponse, error: forgotPasswordError } =
			await this.cognito.forgotPassword(email)

		if (forgotPasswordError) {
			handleError(res, forgotPasswordError, 'authController')
			return
		}

		// Check for service errors
		const serviceResult = handleServiceError(
			forgotPasswordResponse,
			'Error initiating forgot password',
			'authController',
		)
		if (!serviceResult.success) {
			res
				.status(serviceResult.error.status)
				.json({ message: serviceResult.error.message })
			return
		}

		const authResponse: TAuthResponse = {
			message: 'Password reset initiated successfully',
		}

		res.status(StatusCodes.OK).json(authResponse)
	}

	public confirmForgotPassword = async (
		req: Request,
		res: Response,
	): Promise<void> => {
		const { email, code, newPassword, confirmPassword } =
			req.body as TConfirmForgotPasswordRequest

		// Confirm forgot password with Cognito
		const {
			data: confirmForgotPasswordResponse,
			error: confirmForgotPasswordError,
		} = await this.cognito.confirmForgotPassword(
			email,
			code,
			newPassword,
			confirmPassword,
		)

		if (confirmForgotPasswordError) {
			handleError(res, confirmForgotPasswordError, 'authController')
			return
		}

		// Check for service errors
		const serviceResult = handleServiceError(
			confirmForgotPasswordResponse,
			'Error confirming forgot password',
			'authController',
		)
		if (!serviceResult.success) {
			res
				.status(serviceResult.error.status)
				.json({ message: serviceResult.error.message })
			return
		}

		const authResponse: TAuthResponse = {
			message: 'Password reset successfully',
		}

		res.status(StatusCodes.OK).json(authResponse)
	}

	public getAuthUser = async (req: Request, res: Response): Promise<void> => {
		const accessToken = getAccessToken(req)

		// Get user from Cognito
		const { data: getAuthUserResponse, error: responseError } =
			await this.cognito.getAuthUser(accessToken)

		if (responseError) {
			handleError(res, responseError, 'authController')
			return
		}

		// Check for service errors
		const serviceResult = handleServiceError(
			getAuthUserResponse,
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
			!!getAuthUserResponse.Username,
			'User not found',
			'authController',
			StatusCodes.NOT_FOUND,
		)
		if (!usernameValidation.valid) {
			res
				.status(usernameValidation.error.status)
				.json({ message: usernameValidation.error.message })
			return
		}

		// Validate response.Username is not undefined for type inference
		if (!getAuthUserResponse.Username) {
			logger.error('[authController]: User not found')
			res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found' })
			return
		}

		// Extract email from user attributes
		const email = getAuthUserResponse.UserAttributes?.find(
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
			'authController',
			StatusCodes.PARTIAL_CONTENT,
		)
		if (!emailValidation.valid) {
			res
				.status(emailValidation.error.status)
				.json({ message: emailValidation.error.message })
			return
		}

		// Build complete user response
		const userResponse: TGetAuthUserResponse = {
			id: getAuthUserResponse.Username,
			email: email,
			emailVerified:
				getAuthUserResponse.UserAttributes?.find(
					(attr) => attr.Name === 'email_verified',
				)?.Value === 'true',
		}

		res.status(StatusCodes.OK).json(userResponse)
	}
}

// Create an instance of the AuthController
const authController = new AuthController()

export { authController }
