import {
	CognitoIdentityProviderClient,
	CognitoIdentityProviderClientConfig,
	ConfirmForgotPasswordCommand,
	ConfirmSignUpCommand,
	ForgotPasswordCommand,
	GetUserCommand,
	GlobalSignOutCommand,
	InitiateAuthCommand,
	InitiateAuthCommandOutput,
	ListUsersCommand,
	NotAuthorizedException,
	ResendConfirmationCodeCommand,
	SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import crypto from 'crypto'

import { config } from '../../../config/default.ts'
import { tryCatch } from '../../utils/error-handling/try-catch.ts'
import { AppError } from '../../utils/errors.ts'
import { pino } from '../../utils/logger.ts'

import { ICognitoService, TRegisterUserRequest } from './auth.types.ts'

const { logger } = pino

class CognitoService implements ICognitoService {
	private readonly config: CognitoIdentityProviderClientConfig = {
		region: config.awsCognitoRegion,
		credentials: {
			accessKeyId: config.awsCognitoAccessKey,
			secretAccessKey: config.awsCognitoSecretKey,
		},
	}
	private readonly secretHash = config.awsCognitoUserPoolSecretKey
	private readonly clientId = config.awsCognitoUserPoolClientId
	private readonly userPoolId = config.awsCognitoUserPoolId
	private readonly client: CognitoIdentityProviderClient

	constructor() {
		this.client = new CognitoIdentityProviderClient(this.config)
	}

	private generateHash(username: string): string {
		return crypto
			.createHmac('SHA256', this.secretHash)
			.update(username + this.clientId)
			.digest('base64')
	}

	private isTokenExpiredError(error: unknown): boolean {
		return (
			error instanceof NotAuthorizedException &&
			error.message === 'Access Token has expired'
		)
	}

	public async signUpUser({
		email,
		password,
		confirmPassword,
	}: TRegisterUserRequest) {
		if (password !== confirmPassword) {
			throw AppError.validation(
				'Passwords do not match',
				undefined,
				'authService',
			)
		}

		const usedId = crypto.randomUUID()

		const command = new SignUpCommand({
			ClientId: this.clientId,
			Username: usedId,
			Password: password,
			UserAttributes: [
				{
					Name: 'email',
					Value: email,
				},
			],
			SecretHash: this.generateHash(usedId),
		})

		const { data: signUpResult, error } = await tryCatch(
			this.client.send(command),
			'authService - signUpUser',
		)

		if (error) {
			logger.error({
				msg: '[authService - signUpUser]: Error signing up user',
				error,
			})
			throw AppError.from(error, 'authService')
		}

		return signUpResult
	}

	public async confirmSignUp(email: string, code: number) {
		const getUserCommand = new ListUsersCommand({
			Filter: `email = "${email}"`,
			UserPoolId: this.userPoolId,
		})

		const { data: users, error } = await tryCatch(
			this.client.send(getUserCommand),
			'authService - confirmSignUp',
		)

		if (error) {
			logger.error({
				msg: '[authService - confirmSignUp]: Error confirming sign up',
				error,
			})
			throw AppError.from(error, 'authService')
		}

		if (!users.Users || users.Users.length === 0) {
			throw AppError.notFound('User not found', 'authService')
		}

		const uniqueUser = users.Users.find(
			(user) =>
				user.Attributes?.find((attr) => attr.Name === 'email')?.Value === email,
		)

		if (!uniqueUser?.Username) {
			throw AppError.notFound('User not found', 'authService')
		}

		const command = new ConfirmSignUpCommand({
			ClientId: this.clientId,
			Username: uniqueUser.Username,
			ConfirmationCode: code.toString(),
			SecretHash: this.generateHash(uniqueUser.Username),
		})

		const { data: confirmSignUpResult, error: confirmSignUpError } =
			await tryCatch(this.client.send(command), 'authService - confirmSignUp')

		if (confirmSignUpError) {
			logger.error({
				msg: '[authService - confirmSignUp]: Error confirming sign up',
				error: confirmSignUpError,
			})
			throw AppError.from(confirmSignUpError, 'authService')
		}

		return confirmSignUpResult
	}

	public async resendConfirmationCode(email: string) {
		const getUserCommand = new ListUsersCommand({
			Filter: `email = "${email}"`,
			UserPoolId: this.userPoolId,
		})

		const { data: users, error } = await tryCatch(
			this.client.send(getUserCommand),
			'authService - resendConfirmationCode',
		)

		if (error) {
			logger.error({
				msg: '[authService - resendConfirmationCode]: Error resending confirmation code',
				error,
			})
			throw AppError.from(error, 'authService')
		}

		if (!users.Users || users.Users.length === 0) {
			throw AppError.notFound('User not found', 'authService')
		}

		const uniqueUser = users.Users.find(
			(user) =>
				user.Attributes?.find((attr) => attr.Name === 'email')?.Value === email,
		)

		if (!uniqueUser?.Username) {
			throw AppError.notFound('User not found', 'authService')
		}

		const command = new ResendConfirmationCodeCommand({
			ClientId: this.clientId,
			Username: uniqueUser.Username,
			SecretHash: this.generateHash(uniqueUser.Username),
		})

		const {
			data: resendConfirmationCodeResult,
			error: resendConfirmationCodeError,
		} = await tryCatch(
			this.client.send(command),
			'authService - resendConfirmationCode',
		)

		if (resendConfirmationCodeError) {
			logger.error({
				msg: '[authService - resendConfirmationCode]: Error resending confirmation code',
				error: resendConfirmationCodeError,
			})
			throw AppError.from(resendConfirmationCodeError, 'authService')
		}

		return resendConfirmationCodeResult
	}

	public async signInUser(
		email: string,
		password: string,
	): Promise<InitiateAuthCommandOutput & { Username: string }> {
		// First, get the user's UUID using their email
		const getUserCommand = new ListUsersCommand({
			Filter: `email = "${email}"`,
			UserPoolId: this.userPoolId,
		})

		const { data: users, error } = await tryCatch(
			this.client.send(getUserCommand),
			'authService - signInUser',
		)

		if (error) {
			logger.error({
				msg: '[authService - signInUser]: Error signing in user',
				error,
			})
			throw AppError.from(error, 'authService')
		}

		if (!users.Users || users.Users.length === 0) {
			throw AppError.notFound('User not found', 'authService')
		}

		const uniqueUser = users.Users.find(
			(user) =>
				user.Attributes?.find((attr) => attr.Name === 'email')?.Value === email,
		)

		if (!uniqueUser?.Username) {
			throw AppError.notFound('User not found', 'authService')
		}

		const command = new InitiateAuthCommand({
			ClientId: this.clientId,
			AuthFlow: 'USER_PASSWORD_AUTH',
			AuthParameters: {
				USERNAME: email,
				PASSWORD: password,
				SECRET_HASH: this.generateHash(email),
			},
		})

		const { data: signInResponse, error: signInError } = await tryCatch(
			this.client.send(command),
			'authService - signInUser',
		)

		if (signInError) {
			logger.error({
				msg: '[authService - signInUser]: Error signing in user',
				error: signInError,
			})
			throw AppError.from(signInError, 'authService')
		}

		return {
			...signInResponse,
			Username: uniqueUser.Username,
		}
	}

	public async signOutUser(accessToken: string) {
		const signOutCommand = new GlobalSignOutCommand({
			AccessToken: accessToken,
		})

		const { data: signOutResponse, error: signOutError } = await tryCatch(
			this.client.send(signOutCommand),
			'authService - signOutUser',
		)

		if (signOutError) {
			if (this.isTokenExpiredError(signOutError)) {
				throw AppError.unauthorized('Token expired', 'authService')
			}

			logger.error({
				msg: '[authService - signOutUser]: Error signing out user',
				error: signOutError,
			})
			throw AppError.from(signOutError, 'authService')
		}

		return signOutResponse
	}

	public async refreshToken(refreshToken: string, username: string) {
		const refreshTokenCommand = new InitiateAuthCommand({
			ClientId: this.clientId,
			AuthFlow: 'REFRESH_TOKEN_AUTH',
			AuthParameters: {
				REFRESH_TOKEN: refreshToken,
				SECRET_HASH: this.generateHash(username),
			},
		})

		const { data: refreshTokenResponse, error: refreshTokenError } =
			await tryCatch(
				this.client.send(refreshTokenCommand),
				'authService - refreshToken',
			)

		if (refreshTokenError) {
			logger.error({
				msg: '[authService - refreshToken]: Error refreshing token',
				error: refreshTokenError,
			})
			throw AppError.from(refreshTokenError, 'authService')
		}

		return refreshTokenResponse
	}

	public async forgotPassword(email: string) {
		// First, get the user's UUID using their email
		const getUserCommand = new ListUsersCommand({
			Filter: `email = "${email}"`,
			UserPoolId: this.userPoolId,
		})

		const { data: users, error } = await tryCatch(
			this.client.send(getUserCommand),
			'authService - forgotPassword',
		)

		if (error) {
			logger.error({
				msg: '[authService - forgotPassword]: Error retrieving user',
				error,
			})
			throw AppError.from(error, 'authService')
		}

		if (!users.Users || users.Users.length === 0) {
			throw AppError.notFound('User not found', 'authService')
		}

		const uniqueUser = users.Users.find(
			(user) =>
				user.Attributes?.find((attr) => attr.Name === 'email')?.Value === email,
		)

		if (!uniqueUser?.Username) {
			throw AppError.notFound('User not found', 'authService')
		}

		const command = new ForgotPasswordCommand({
			ClientId: this.clientId,
			Username: uniqueUser.Username,
			SecretHash: this.generateHash(uniqueUser.Username),
		})

		const { data: forgotPasswordResponse, error: forgotPasswordError } =
			await tryCatch(this.client.send(command), 'authService - forgotPassword')

		if (forgotPasswordError) {
			logger.error({
				msg: '[authService - forgotPassword]: Error initiating forgot password',
				error: forgotPasswordError,
			})
			throw AppError.from(forgotPasswordError, 'authService')
		}

		return forgotPasswordResponse
	}

	public async confirmForgotPassword(
		email: string,
		code: string,
		newPassword: string,
		confirmPassword: string,
	) {
		if (newPassword !== confirmPassword) {
			throw AppError.validation(
				'Passwords do not match',
				undefined,
				'authService',
			)
		}

		// First, get the user's UUID using their email
		const getUserCommand = new ListUsersCommand({
			Filter: `email = "${email}"`,
			UserPoolId: this.userPoolId,
		})

		const { data: users, error } = await tryCatch(
			this.client.send(getUserCommand),
			'authService - confirmForgotPassword',
		)

		if (error) {
			logger.error({
				msg: '[authService - confirmForgotPassword]: Error retrieving user',
				error,
			})
			throw AppError.from(error, 'authService')
		}

		if (!users.Users || users.Users.length === 0) {
			throw AppError.notFound('User not found', 'authService')
		}

		const uniqueUser = users.Users.find(
			(user) =>
				user.Attributes?.find((attr) => attr.Name === 'email')?.Value === email,
		)

		if (!uniqueUser?.Username) {
			throw AppError.notFound('User not found', 'authService')
		}

		const command = new ConfirmForgotPasswordCommand({
			ClientId: this.clientId,
			Username: uniqueUser.Username,
			ConfirmationCode: code,
			Password: newPassword,
			SecretHash: this.generateHash(uniqueUser.Username),
		})

		const {
			data: confirmForgotPasswordResponse,
			error: confirmForgotPasswordError,
		} = await tryCatch(
			this.client.send(command),
			'authService - confirmForgotPassword',
		)

		if (confirmForgotPasswordError) {
			logger.error({
				msg: '[authService - confirmForgotPassword]: Error confirming forgot password',
				error: confirmForgotPasswordError,
			})
			throw AppError.from(confirmForgotPasswordError, 'authService')
		}

		return confirmForgotPasswordResponse
	}

	public async getAuthUser(accessToken: string) {
		const command = new GetUserCommand({
			AccessToken: accessToken,
		})

		const { data: getAuthUserResponse, error: getAuthUserError } =
			await tryCatch(this.client.send(command), 'authService - getAuthUser')

		if (getAuthUserError) {
			logger.error({
				msg: '[authService - getAuthUser]: Error retrieving user',
				error: getAuthUserError,
			})
			throw AppError.from(getAuthUserError, 'authService')
		}

		return getAuthUserResponse
	}
}

export { CognitoService }
