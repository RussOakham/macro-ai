import {
	CognitoIdentityProviderClient,
	CognitoIdentityProviderClientConfig,
	ConfirmForgotPasswordCommand,
	ConfirmForgotPasswordCommandOutput,
	ConfirmSignUpCommand,
	ConfirmSignUpCommandOutput,
	ForgotPasswordCommand,
	ForgotPasswordCommandOutput,
	GetUserCommand,
	GetUserCommandOutput,
	GlobalSignOutCommand,
	GlobalSignOutCommandOutput,
	InitiateAuthCommand,
	InitiateAuthCommandOutput,
	ListUsersCommand,
	ListUsersCommandOutput,
	ResendConfirmationCodeCommand,
	ResendConfirmationCodeCommandOutput,
	SignUpCommand,
	SignUpCommandOutput,
	UserType,
} from '@aws-sdk/client-cognito-identity-provider'
import crypto from 'crypto'

import { config } from '../../../config/default.ts'
import { tryCatch, tryCatchSync } from '../../utils/error-handling/try-catch.ts'
import { NotFoundError, Result, ValidationError } from '../../utils/errors.ts'

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

	/**
	 * Sign up a new user with Cognito
	 * @param request Registration request containing email, password, and confirmPassword
	 * @returns Result tuple with SignUpCommandOutput or error
	 */
	public async signUpUser({
		email,
		password,
		confirmPassword,
	}: TRegisterUserRequest): Promise<Result<SignUpCommandOutput>> {
		// Validate passwords match using tryCatchSync
		const [, validationError] = tryCatchSync(() => {
			if (password !== confirmPassword) {
				throw new ValidationError(
					'Passwords do not match',
					undefined,
					'authService',
				)
			}
			return true
		}, 'authService - validatePasswords')

		if (validationError) {
			return [null, validationError]
		}

		const userId = crypto.randomUUID()

		// Generate hash using tryCatchSync
		const [secretHash, hashError] = tryCatchSync(
			() => this.generateHash(userId),
			'authService - generateHash',
		)

		if (hashError) {
			return [null, hashError]
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
	 * Validates and extracts a unique user by email from Cognito users list
	 * @param users The list of users from Cognito
	 * @param email The email to match
	 * @param context The context string for error reporting
	 * @returns Result tuple with the unique user or error
	 */
	private validateAndExtractUser(
		users: ListUsersCommandOutput,
		email: string,
		context: string,
	): Result<UserType> {
		return tryCatchSync(() => {
			if (!users.Users || users.Users.length === 0) {
				throw new NotFoundError('User not found', 'authService')
			}

			const uniqueUser = users.Users.find(
				(user) =>
					user.Attributes?.find((attr) => attr.Name === 'email')?.Value ===
					email,
			)

			if (!uniqueUser?.Username) {
				throw new NotFoundError('User not found', 'authService')
			}

			return uniqueUser
		}, `authService - ${context}`)
	}

	/**
	 * Confirm user registration with Cognito
	 * @param email User's email
	 * @param code Confirmation code
	 * @returns Result tuple with ConfirmSignUpCommandOutput or error
	 */
	public async confirmSignUp(
		email: string,
		code: number,
	): Promise<Result<ConfirmSignUpCommandOutput>> {
		// Get user by email
		const getUserCommand = new ListUsersCommand({
			Filter: `email = "${email}"`,
			UserPoolId: this.userPoolId,
		})

		const [users, getUserError] = await tryCatch(
			this.client.send(getUserCommand),
			'authService - confirmSignUp',
		)

		if (getUserError) {
			return [null, getUserError]
		}

		// Validate users result using the helper method
		const [uniqueUser, validationError] = this.validateAndExtractUser(
			users,
			email,
			'validateUser',
		)

		if (validationError) {
			return [null, validationError]
		}

		// Generate hash using tryCatchSync
		const [secretHash, hashError] = tryCatchSync(
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			() => this.generateHash(uniqueUser.Username!),
			'authService - generateHash',
		)

		if (hashError) {
			return [null, hashError]
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
	 * @returns Result tuple with ResendConfirmationCodeCommandOutput or error
	 */
	public async resendConfirmationCode(
		email: string,
	): Promise<Result<ResendConfirmationCodeCommandOutput>> {
		const getUserCommand = new ListUsersCommand({
			Filter: `email = "${email}"`,
			UserPoolId: this.userPoolId,
		})

		const [users, error] = await tryCatch(
			this.client.send(getUserCommand),
			'authService - resendConfirmationCode',
		)

		if (error) {
			return [null, error]
		}

		// Validate users result using the helper method
		const [uniqueUser, validationError] = this.validateAndExtractUser(
			users,
			email,
			'validateUser',
		)

		if (validationError) {
			return [null, validationError]
		}

		// Generate hash using tryCatchSync
		const [secretHash, hashError] = tryCatchSync(
			() => this.generateHash(uniqueUser.Username ?? ''),
			'authService - generateHash',
		)

		if (hashError) {
			return [null, hashError]
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
	 * @returns Result tuple with InitiateAuthCommandOutput & Username or error
	 */
	public async signInUser(
		email: string,
		password: string,
	): Promise<Result<InitiateAuthCommandOutput & { Username: string }>> {
		// First, get the user's UUID using their email
		const getUserCommand = new ListUsersCommand({
			Filter: `email = "${email}"`,
			UserPoolId: this.userPoolId,
		})

		const [users, getUserError] = await tryCatch(
			this.client.send(getUserCommand),
			'authService - signInUser',
		)

		if (getUserError) {
			return [null, getUserError]
		}

		// Validate users result using the helper method
		const [uniqueUser, validationError] = this.validateAndExtractUser(
			users,
			email,
			'validateUser',
		)

		if (validationError) {
			return [null, validationError]
		}

		// Generate hash using tryCatchSync
		const [secretHash, hashError] = tryCatchSync(
			() => this.generateHash(email),
			'authService - generateHash',
		)

		if (hashError) {
			return [null, hashError]
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

		const [signInResponse, signInError] = await tryCatch(
			this.client.send(command),
			'authService - signInUser',
		)

		if (signInError) {
			return [null, signInError]
		}

		if (!uniqueUser.Username) {
			return [null, new NotFoundError('User not found', 'authService')]
		}

		return [
			{
				...signInResponse,
				Username: uniqueUser.Username,
			},
			null,
		]
	}

	public async signOutUser(
		accessToken: string,
	): Promise<Result<GlobalSignOutCommandOutput>> {
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
	 * @returns Result tuple with InitiateAuthCommandOutput or error
	 */
	public async refreshToken(
		refreshToken: string,
		username: string,
	): Promise<Result<InitiateAuthCommandOutput>> {
		// Generate hash using tryCatchSync
		const [secretHash, hashError] = tryCatchSync(
			() => this.generateHash(username),
			'authService - refreshToken',
		)

		if (hashError) {
			return [null, hashError]
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
	): Promise<Result<ForgotPasswordCommandOutput>> {
		// First, get the user's UUID using their email
		const getUserCommand = new ListUsersCommand({
			Filter: `email = "${email}"`,
			UserPoolId: this.userPoolId,
		})

		const [users, error] = await tryCatch(
			this.client.send(getUserCommand),
			'authService - forgotPassword',
		)

		if (error) {
			return [null, error]
		}

		// Validate users result using the helper method
		const [uniqueUser, validationError] = this.validateAndExtractUser(
			users,
			email,
			'validateUser',
		)

		if (validationError) {
			return [null, validationError]
		}

		// Generate hash using tryCatchSync
		const [secretHash, hashError] = tryCatchSync(
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			() => this.generateHash(uniqueUser.Username!),
			'authService - generateHash',
		)

		if (hashError) {
			return [null, hashError]
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
	): Promise<Result<ConfirmForgotPasswordCommandOutput>> {
		// Validate passwords match using tryCatchSync
		const [, validationError] = tryCatchSync(() => {
			if (newPassword !== confirmPassword) {
				throw new ValidationError(
					'Passwords do not match',
					undefined,
					'authService',
				)
			}
			return true
		}, 'authService - confirmForgotPassword')

		if (validationError) {
			return [null, validationError]
		}

		// First, get the user's UUID using their email
		const getUserCommand = new ListUsersCommand({
			Filter: `email = "${email}"`,
			UserPoolId: this.userPoolId,
		})

		const [users, getUserError] = await tryCatch(
			this.client.send(getUserCommand),
			'authService - confirmForgotPassword',
		)

		if (getUserError) {
			return [null, getUserError]
		}

		// Validate users result using the helper method
		const [uniqueUser, validationUserError] = this.validateAndExtractUser(
			users,
			email,
			'validateUser',
		)

		if (validationUserError) {
			return [null, validationUserError]
		}

		// Generate hash using tryCatchSync
		const [secretHash, hashError] = tryCatchSync(
			() => this.generateHash(uniqueUser.Username ?? ''),
			'authService - generateHash',
		)

		if (hashError) {
			return [null, hashError]
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

	public async getAuthUser(
		accessToken: string,
	): Promise<Result<GetUserCommandOutput>> {
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
