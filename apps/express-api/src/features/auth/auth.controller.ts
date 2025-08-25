import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'

import {
	getAccessToken,
	getRefreshToken,
	getSynchronizeToken,
} from '../../utils/cookies.ts'
import { decrypt, encrypt } from '../../utils/crypto.ts'
import { tryCatchSync } from '../../utils/error-handling/try-catch.ts'
import {
	ConflictError,
	ErrorType,
	InternalError,
	ValidationError,
} from '../../utils/errors.ts'
import { pino } from '../../utils/logger.ts'
import {
	handleServiceError,
	validateData,
} from '../../utils/response-handlers.ts'
import { userRepository } from '../user/user.data-access.ts'
import { userService } from '../user/user.services.ts'
import { TInsertUser } from '../user/user.types.ts'

import { cognitoService } from './auth.services.ts'
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

import { assertConfig } from '../../config/simple-config.js'

// Load configuration once at module level (no logging)
const config = assertConfig(false)
const nodeEnv = config.nodeEnv
const cookieDomain = config.cookieDomain
const refreshTokenExpiryDays = config.awsCognitoRefreshTokenExpiry

/**
 * AuthController class that implements the IAuthController interface
 * Handles all authentication related requests
 */
class AuthController implements IAuthController {
	private readonly cognito: typeof cognitoService
	private readonly userService: typeof userService
	private readonly userRepository: typeof userRepository

	constructor(
		cognitoSvc: typeof cognitoService = cognitoService,
		userSvc: typeof userService = userService,
		userRepo: typeof userRepository = userRepository,
	) {
		this.cognito = cognitoSvc
		this.userService = userSvc
		this.userRepository = userRepo
	}

	public register = async (
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> => {
		const { email, password, confirmPassword } =
			req.body as TRegisterUserRequest

		// Check if user already exists
		const [getUserResponse, getUserError] =
			await this.userService.getUserByEmail({ email })

		if (getUserResponse) {
			const error = new ConflictError(
				'User already exists',
				'authController - register',
			)
			next(error)
			return
		}

		// if there is an error and it's not NotFoundError, propagate it
		if (getUserError.type !== ErrorType.NotFoundError) {
			next(getUserError)
			return
		}

		// Register user with Cognito
		const [signUpResponse, signUpError] = await this.cognito.signUpUser({
			email,
			password,
			confirmPassword,
		})

		if (signUpError) {
			next(signUpError)
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
			const error = new ValidationError(
				'User not created - no user ID returned',
				undefined,
				'authController - register',
			)
			next(error)
			return
		}

		// Create user in database with Zod validation
		const userData: TInsertUser = {
			id: signUpResponse.UserSub,
			email,
		}

		const [user, userError] = await this.userRepository.createUser({ userData })

		if (userError) {
			next(userError)
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
		next: NextFunction,
	): Promise<void> => {
		const { email, code } = req.body as TConfirmRegistrationRequest

		// Confirm user registration with Cognito
		const [confirmSignUpResponse, confirmSignUpError] =
			await this.cognito.confirmSignUp(email, code)

		if (confirmSignUpError) {
			next(confirmSignUpError)
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
		const [user, userError] = await this.userService.getUserByEmail({ email })

		if (userError) {
			next(userError)
			return
		}

		// Update user email verification status in database
		const [updatedUser, updatedUserError] =
			await this.userRepository.updateUser(user.id, {
				emailVerified: true,
			})

		if (updatedUserError) {
			next(updatedUserError)
			return
		}

		if (!updatedUser) {
			const error = new InternalError(
				'Failed to update user email verification',
				'authController',
			)
			next(error)
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
		next: NextFunction,
	): Promise<void> => {
		const { email } = req.body as TResendConfirmationCodeRequest

		// Resend confirmation code with Cognito
		const [resendConfirmationCodeResponse, resendConfirmationCodeError] =
			await this.cognito.resendConfirmationCode(email)

		if (resendConfirmationCodeError) {
			next(resendConfirmationCodeError)
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

	public login = async (
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> => {
		const { email, password } = req.body as TLoginRequest

		// Login user with Cognito
		const [signInResponse, signInError] = await this.cognito.signInUser(
			email,
			password,
		)

		if (signInError) {
			next(signInError)
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

		// Validate that authentication tokens are present
		if (
			!signInResponse.AuthenticationResult?.AccessToken ||
			!signInResponse.AuthenticationResult.RefreshToken ||
			!signInResponse.AuthenticationResult.ExpiresIn
		) {
			const error = new InternalError(
				'Authentication tokens missing from response',
				'authController - login',
			)
			logger.error({
				msg: '[authController - login]: Missing authentication tokens',
				error: error.message,
			})
			next(error)
			return
		}

		// Use the encrypt function with the new return type
		const [encryptedUsername, encryptError] = encrypt(signInResponse.Username)

		if (encryptError) {
			next(encryptError)
			return
		}

		// Register or login user in database
		const [user, userError] = await this.userService.registerOrLoginUserById({
			id: signInResponse.Username,
			email,
		})

		if (userError) {
			next(userError)
			return
		}

		logger.info(`[authController]: User logged in: ${user.id}`)

		const loginResponse: TLoginResponse = {
			message: 'Login successful',
			tokens: {
				accessToken: signInResponse.AuthenticationResult.AccessToken,
				refreshToken: signInResponse.AuthenticationResult.RefreshToken,
				expiresIn: signInResponse.AuthenticationResult.ExpiresIn,
			},
		}

		res
			.cookie('macro-ai-accessToken', loginResponse.tokens.accessToken, {
				httpOnly: true,
				secure: nodeEnv === 'production',
				domain: cookieDomain !== 'localhost' ? cookieDomain : undefined,
				sameSite: 'strict',
				maxAge: (loginResponse.tokens.expiresIn + 300) * 1000, // JWT expiration + 5 minute buffer for refresh
			})
			.cookie('macro-ai-refreshToken', loginResponse.tokens.refreshToken, {
				httpOnly: true,
				secure: nodeEnv === 'production',
				domain: cookieDomain !== 'localhost' ? cookieDomain : undefined,
				sameSite: 'strict',
				maxAge: 1000 * 60 * 60 * 24 * refreshTokenExpiryDays,
			})
			.cookie('macro-ai-synchronize', encryptedUsername, {
				httpOnly: true,
				secure: nodeEnv === 'production',
				domain: cookieDomain !== 'localhost' ? cookieDomain : undefined,
				sameSite: 'strict',
				maxAge: 1000 * 60 * 60 * 24 * refreshTokenExpiryDays,
			})
			.status(StatusCodes.OK)
			.json(loginResponse)
	}

	public logout = async (
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> => {
		// Extract access token from cookies
		const [accessToken, accessTokenError] = tryCatchSync(
			() => getAccessToken(req),
			'authController - logout',
		)

		if (accessTokenError) {
			next(accessTokenError)
			return
		}

		// Logout user with Cognito
		const [signOutResponse, signOutError] =
			await this.cognito.signOutUser(accessToken)

		if (signOutError) {
			next(signOutError)
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
				domain: cookieDomain !== 'localhost' ? cookieDomain : undefined,
				sameSite: 'strict',
			})
			.clearCookie('macro-ai-refreshToken', {
				domain: cookieDomain !== 'localhost' ? cookieDomain : undefined,
				sameSite: 'strict',
			})
			.clearCookie('macro-ai-synchronize', {
				domain: cookieDomain !== 'localhost' ? cookieDomain : undefined,
				sameSite: 'strict',
			})
			.status(StatusCodes.OK)
			.json(authResponse)
	}

	public refreshToken = async (
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> => {
		// Extract refresh token from cookies with error handling
		const [refreshToken, getRefreshTokenError] = tryCatchSync(
			() => getRefreshToken(req),
			'authController - refreshToken',
		)

		if (getRefreshTokenError) {
			logger.error({
				msg: '[authController - refreshToken]: Error retrieving refresh token',
				error: getRefreshTokenError,
			})
			next(getRefreshTokenError)
			return
		}

		// Extract synchronize token from cookies with error handling
		const [encryptedUsername, synchronizeTokenError] = tryCatchSync(
			() => getSynchronizeToken(req),
			'authController - refreshToken',
		)

		if (synchronizeTokenError) {
			logger.error({
				msg: '[authController - refreshToken]: Error retrieving synchronize token',
				error: synchronizeTokenError,
			})
			res.status(StatusCodes.UNAUTHORIZED).json({
				message: 'Synchronize token not found or invalid',
			})
			return
		}

		// Use the decrypt function with the new return type
		const [decryptedUsername, decryptError] = decrypt(encryptedUsername)

		if (decryptError) {
			next(decryptError)
			return
		}

		// Refresh token with Cognito
		const [refreshTokenResponse, refreshTokenResponseError] =
			await this.cognito.refreshToken(refreshToken, decryptedUsername)

		if (refreshTokenResponseError) {
			next(refreshTokenResponseError)
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

		// Validate that required authentication tokens are present
		if (
			!refreshTokenResponse.AuthenticationResult?.AccessToken ||
			typeof refreshTokenResponse.AuthenticationResult.ExpiresIn !== 'number'
		) {
			const error = new InternalError(
				'Authentication tokens missing from response',
				'authController - refreshToken',
			)
			logger.error({
				msg: '[authController - refreshToken]: Missing authentication tokens',
				error: error.message,
			})
			next(error)
			return
		}

		// The refresh token might not be returned if it hasn't expired yet
		const newRefreshToken =
			refreshTokenResponse.AuthenticationResult.RefreshToken ?? refreshToken

		const refreshLoginResponse: TLoginResponse = {
			message: 'Token refreshed successfully',
			tokens: {
				accessToken: refreshTokenResponse.AuthenticationResult.AccessToken,
				refreshToken: newRefreshToken,
				expiresIn: refreshTokenResponse.AuthenticationResult.ExpiresIn,
			},
		}

		res
			.cookie('macro-ai-accessToken', refreshLoginResponse.tokens.accessToken, {
				httpOnly: false,
				secure: nodeEnv === 'production',
				domain: cookieDomain !== 'localhost' ? cookieDomain : undefined,
				sameSite: 'strict',
				maxAge: (refreshLoginResponse.tokens.expiresIn + 300) * 1000, // JWT expiration + 5 minute buffer for refresh
			})
			.cookie(
				'macro-ai-refreshToken',
				refreshLoginResponse.tokens.refreshToken,
				{
					httpOnly: true,
					secure: nodeEnv === 'production',
					domain: cookieDomain !== 'localhost' ? cookieDomain : undefined,
					sameSite: 'strict',
					maxAge: 1000 * 60 * 60 * 24 * refreshTokenExpiryDays,
				},
			)
			.cookie('macro-ai-synchronize', encryptedUsername, {
				httpOnly: true,
				secure: nodeEnv === 'production',
				domain: cookieDomain !== 'localhost' ? cookieDomain : undefined,
				sameSite: 'strict',
				maxAge: 1000 * 60 * 60 * 24 * refreshTokenExpiryDays,
			})
			.status(StatusCodes.OK)
			.json(refreshLoginResponse)
	}

	public forgotPassword = async (
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> => {
		const { email } = req.body as TForgotPasswordRequest

		// Initiate forgot password with Cognito
		const [forgotPasswordResponse, forgotPasswordError] =
			await this.cognito.forgotPassword(email)

		if (forgotPasswordError) {
			next(forgotPasswordError)
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
		next: NextFunction,
	): Promise<void> => {
		const { email, code, newPassword, confirmPassword } =
			req.body as TConfirmForgotPasswordRequest

		// Confirm forgot password with Cognito
		const [confirmForgotPasswordResponse, confirmForgotPasswordError] =
			await this.cognito.confirmForgotPassword(
				email,
				code,
				newPassword,
				confirmPassword,
			)

		if (confirmForgotPasswordError) {
			next(confirmForgotPasswordError)
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

	public getAuthUser = async (
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> => {
		// Extract access token from cookies with error handling
		const [accessToken, accessTokenError] = tryCatchSync(
			() => getAccessToken(req),
			'authController - getAuthUser',
		)

		if (accessTokenError) {
			logger.error({
				msg: '[authController - getAuthUser]: Error retrieving access token',
				error: accessTokenError,
			})
			res.status(StatusCodes.UNAUTHORIZED).json({
				message: 'Authentication required',
			})
			return
		}

		// Get user from Cognito
		const [getAuthUserResponse, responseError] =
			await this.cognito.getAuthUser(accessToken)

		if (responseError) {
			next(responseError)
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
