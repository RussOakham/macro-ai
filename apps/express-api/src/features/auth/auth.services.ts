import {
	CognitoIdentityProviderClient,
	CognitoIdentityProviderClientConfig,
	ConfirmForgotPasswordCommand,
	ConfirmForgotPasswordCommandOutput,
	ConfirmSignUpCommand,
	ForgotPasswordCommand,
	ForgotPasswordCommandOutput,
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
import {
	EnhancedResult,
	tryCatch,
	tryCatchSync,
} from '../../utils/error-handling/try-catch.ts'
import { AppError } from '../../utils/errors.ts'

import { ICognitoService, TRegisterUserRequest } from './auth.types.ts'

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

	/**
	 * Generate a hash for Cognito API calls
	 * @param username Username to hash
	 * @returns Hash string
	 */
	private generateHash(username: string): string {
		const hmac = crypto.createHmac('sha256', this.secretHash)
		hmac.update(username + this.clientId)
		return hmac.digest('base64')
	}

	private isTokenExpiredError(error: unknown): boolean {
		return (
			error instanceof NotAuthorizedException &&
			error.message === 'Access Token has expired'
		)
	}

	/**
	 * Sign up a new user with Cognito
	 * @param request Registration request containing email, password, and confirmPassword
	 * @returns EnhancedResult with SignUpCommandOutput or error
	 */
	public async signUpUser({
		email,
		password,
		confirmPassword,
	}: TRegisterUserRequest) {
		// Validate passwords match using tryCatchSync
		const { error: validationError } = tryCatchSync(() => {
			if (password !== confirmPassword) {
				throw AppError.validation(
					'Passwords do not match',
					undefined,
					'authService',
				)
			}
			return true
		}, 'authService - validatePasswords')

		if (validationError) {
			return { data: null, error: validationError }
		}

		const userId = crypto.randomUUID()

		// Generate hash using tryCatchSync
		const { data: secretHash, error: hashError } = tryCatchSync(
			() => this.generateHash(userId),
			'authService - generateHash',
		)

		if (hashError) {
			return { data: null, error: hashError }
		}

		const command = new SignUpCommand({
			ClientId: this.clientId,
			Username: userId,
			Password: password,
			UserAttributes: [
				{
					Name: 'email',
					Value: email,
				},
			],
			SecretHash: secretHash,
		})

		return await tryCatch(this.client.send(command), 'authService - signUpUser')
	}

	/**
	 * Confirm user registration with Cognito
	 * @param email User's email
	 * @param code Confirmation code
	 * @returns EnhancedResult with ConfirmSignUpCommandOutput or error
	 */
	public async confirmSignUp(email: string, code: number) {
		// Get user by email
		const getUserCommand = new ListUsersCommand({
			Filter: `email = "${email}"`,
			UserPoolId: this.userPoolId,
		})

		const { data: users, error: getUserError } = await tryCatch(
			this.client.send(getUserCommand),
			'authService - confirmSignUp',
		)

		if (getUserError) {
			return { data: null, error: getUserError }
		}

		// Validate users result using tryCatchSync
		const { data: uniqueUser, error: validationError } = tryCatchSync(() => {
			if (!users.Users || users.Users.length === 0) {
				throw AppError.notFound('User not found', 'authService')
			}

			const uniqueUser = users.Users.find(
				(user) =>
					user.Attributes?.find((attr) => attr.Name === 'email')?.Value ===
					email,
			)

			if (!uniqueUser?.Username) {
				throw AppError.notFound('User not found', 'authService')
			}

			return uniqueUser
		}, 'authService - validateUser')

		if (validationError) {
			return { data: null, error: validationError }
		}

		// Generate hash using tryCatchSync
		const { data: secretHash, error: hashError } = tryCatchSync(
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			() => this.generateHash(uniqueUser.Username!),
			'authService - generateHash',
		)

		if (hashError) {
			return { data: null, error: hashError }
		}

		const command = new ConfirmSignUpCommand({
			ClientId: this.clientId,
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			Username: uniqueUser.Username!,
			ConfirmationCode: code.toString(),
			SecretHash: secretHash,
		})

		return await tryCatch(
			this.client.send(command),
			'authService - confirmSignUp',
		)
	}

	/**
	 * Resend confirmation code to user's email
	 * @param email User's email
	 * @returns EnhancedResult with ResendConfirmationCodeCommandOutput or error
	 */
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
			return { data: null, error }
		}

		// Validate users result using tryCatchSync
		const { data: uniqueUser, error: validationError } = tryCatchSync(() => {
			if (!users.Users || users.Users.length === 0) {
				throw AppError.notFound('User not found', 'authService')
			}

			const uniqueUser = users.Users.find(
				(user) =>
					user.Attributes?.find((attr) => attr.Name === 'email')?.Value ===
					email,
			)

			if (!uniqueUser?.Username) {
				throw AppError.notFound('User not found', 'authService')
			}

			return uniqueUser
		}, 'authService - validateUser')

		if (validationError) {
			return { data: null, error: validationError }
		}

		// Generate hash using tryCatchSync
		const { data: secretHash, error: hashError } = tryCatchSync(
			() => this.generateHash(uniqueUser.Username ?? ''),
			'authService - generateHash',
		)

		if (hashError) {
			return { data: null, error: hashError }
		}

		const command = new ResendConfirmationCodeCommand({
			ClientId: this.clientId,
			Username: uniqueUser.Username,
			SecretHash: secretHash,
		})

		return await tryCatch(
			this.client.send(command),
			'authService - resendConfirmationCode',
		)
	}

	/**
	 * Sign in a user with Cognito
	 * @param email User's email
	 * @param password User's password
	 * @returns EnhancedResult with InitiateAuthCommandOutput & Username or error
	 */
	public async signInUser(
		email: string,
		password: string,
	): Promise<EnhancedResult<InitiateAuthCommandOutput & { Username: string }>> {
		// First, get the user's UUID using their email
		const getUserCommand = new ListUsersCommand({
			Filter: `email = "${email}"`,
			UserPoolId: this.userPoolId,
		})

		const { data: users, error: getUserError } = await tryCatch(
			this.client.send(getUserCommand),
			'authService - signInUser',
		)

		if (getUserError) {
			return { data: null, error: getUserError }
		}

		// Validate users result using tryCatchSync
		const { data: uniqueUser, error: validationError } = tryCatchSync(() => {
			if (!users.Users || users.Users.length === 0) {
				throw AppError.notFound('User not found', 'authService')
			}

			const uniqueUser = users.Users.find(
				(user) =>
					user.Attributes?.find((attr) => attr.Name === 'email')?.Value ===
					email,
			)

			if (!uniqueUser?.Username) {
				throw AppError.notFound('User not found', 'authService')
			}

			return uniqueUser
		}, 'authService - validateUser')

		if (validationError) {
			return { data: null, error: validationError }
		}

		// Generate hash using tryCatchSync
		const { data: secretHash, error: hashError } = tryCatchSync(
			() => this.generateHash(email),
			'authService - generateHash',
		)

		if (hashError) {
			return { data: null, error: hashError }
		}

		const command = new InitiateAuthCommand({
			ClientId: this.clientId,
			AuthFlow: 'USER_PASSWORD_AUTH',
			AuthParameters: {
				USERNAME: email,
				PASSWORD: password,
				SECRET_HASH: secretHash,
			},
		})

		const { data: signInResponse, error: signInError } = await tryCatch(
			this.client.send(command),
			'authService - signInUser',
		)

		if (signInError) {
			return { data: null, error: signInError }
		}

		if (!uniqueUser.Username) {
			return {
				data: null,
				error: AppError.notFound('User not found', 'authService'),
			}
		}

		return {
			data: {
				...signInResponse,
				Username: uniqueUser.Username,
			},
			error: null,
		}
	}

	public async signOutUser(accessToken: string) {
		const signOutCommand = new GlobalSignOutCommand({
			AccessToken: accessToken,
		})

		return await tryCatch(
			this.client.send(signOutCommand),
			'authService - signOutUser',
		)
	}

	/**
	 * Refresh an access token using a refresh token
	 * @param refreshToken The refresh token
	 * @param username The username associated with the token
	 * @returns EnhancedResult with InitiateAuthCommandOutput or error
	 */
	public async refreshToken(
		refreshToken: string,
		username: string,
	): Promise<EnhancedResult<InitiateAuthCommandOutput>> {
		// Generate hash using tryCatchSync
		const { data: secretHash, error: hashError } = tryCatchSync(
			() => this.generateHash(username),
			'authService - refreshToken',
		)

		if (hashError) {
			return { data: null, error: hashError }
		}

		const refreshTokenCommand = new InitiateAuthCommand({
			ClientId: this.clientId,
			AuthFlow: 'REFRESH_TOKEN_AUTH',
			AuthParameters: {
				REFRESH_TOKEN: refreshToken,
				SECRET_HASH: secretHash,
			},
		})

		return await tryCatch(
			this.client.send(refreshTokenCommand),
			'authService - refreshToken',
		)
	}

	public async forgotPassword(
		email: string,
	): Promise<EnhancedResult<ForgotPasswordCommandOutput>> {
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
			return { data: null, error }
		}

		// Validate users result using tryCatchSync
		const { data: uniqueUser, error: validationError } = tryCatchSync(() => {
			if (!users.Users || users.Users.length === 0) {
				throw AppError.notFound('User not found', 'authService')
			}

			const uniqueUser = users.Users.find(
				(user) =>
					user.Attributes?.find((attr) => attr.Name === 'email')?.Value ===
					email,
			)

			if (!uniqueUser?.Username) {
				throw AppError.notFound('User not found', 'authService')
			}

			return uniqueUser
		}, 'authService - validateUser')

		if (validationError) {
			return { data: null, error: validationError }
		}

		// Generate hash using tryCatchSync
		const { data: secretHash, error: hashError } = tryCatchSync(
			() => this.generateHash(uniqueUser.Username ?? ''),
			'authService - generateHash',
		)

		if (hashError) {
			return { data: null, error: hashError }
		}

		const command = new ForgotPasswordCommand({
			ClientId: this.clientId,
			Username: uniqueUser.Username,
			SecretHash: secretHash,
		})

		return await tryCatch(
			this.client.send(command),
			'authService - forgotPassword',
		)
	}

	public async confirmForgotPassword(
		email: string,
		code: string,
		newPassword: string,
		confirmPassword: string,
	): Promise<EnhancedResult<ConfirmForgotPasswordCommandOutput>> {
		// Validate passwords match using tryCatchSync
		const { error: validationError } = tryCatchSync(() => {
			if (newPassword !== confirmPassword) {
				throw AppError.validation(
					'Passwords do not match',
					undefined,
					'authService',
				)
			}
			return true
		}, 'authService - confirmForgotPassword')

		if (validationError) {
			return { data: null, error: validationError }
		}

		// First, get the user's UUID using their email
		const getUserCommand = new ListUsersCommand({
			Filter: `email = "${email}"`,
			UserPoolId: this.userPoolId,
		})

		const { data: users, error: getUserError } = await tryCatch(
			this.client.send(getUserCommand),
			'authService - confirmForgotPassword',
		)

		if (getUserError) {
			return { data: null, error: getUserError }
		}

		// Validate users result using tryCatchSync
		const { data: uniqueUser, error: validationUserError } = tryCatchSync(
			() => {
				if (!users.Users || users.Users.length === 0) {
					throw AppError.notFound('User not found', 'authService')
				}

				const uniqueUser = users.Users.find(
					(user) =>
						user.Attributes?.find((attr) => attr.Name === 'email')?.Value ===
						email,
				)

				if (!uniqueUser?.Username) {
					throw AppError.notFound('User not found', 'authService')
				}

				return uniqueUser
			},
			'authService - validateUser',
		)

		if (validationUserError) {
			return { data: null, error: validationUserError }
		}

		// Generate hash using tryCatchSync
		const { data: secretHash, error: hashError } = tryCatchSync(
			() => this.generateHash(uniqueUser.Username ?? ''),
			'authService - generateHash',
		)

		if (hashError) {
			return { data: null, error: hashError }
		}

		const command = new ConfirmForgotPasswordCommand({
			ClientId: this.clientId,
			Username: uniqueUser.Username,
			ConfirmationCode: code,
			Password: newPassword,
			SecretHash: secretHash,
		})

		return await tryCatch(
			this.client.send(command),
			'authService - confirmForgotPassword',
		)
	}

	public async getAuthUser(accessToken: string) {
		const command = new GetUserCommand({
			AccessToken: accessToken,
		})

		return await tryCatch(
			this.client.send(command),
			'authService - getAuthUser',
		)
	}
}

export { CognitoService }
