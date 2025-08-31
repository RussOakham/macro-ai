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

import { tryCatch, tryCatchSync } from '../../utils/error-handling/try-catch.ts'
import { NotFoundError, Result, ValidationError } from '../../utils/errors.ts'
import { logger } from '../../utils/logger.ts'
import { createParameterStoreService } from '../../utils/parameter-store.ts'

import { ICognitoService, TRegisterUserRequest } from './auth.types.ts'

class CognitoService implements ICognitoService {
	private config: CognitoIdentityProviderClientConfig
	private secretHash: string
	private clientId: string
	private userPoolId: string
	private client: CognitoIdentityProviderClient

	constructor() {
		// Initialize with placeholder values - will be loaded from Parameter Store
		this.config = { region: 'us-east-1' }
		this.secretHash = ''
		this.clientId = ''
		this.userPoolId = ''
		this.client = new CognitoIdentityProviderClient(this.config)

		// Load configuration from Parameter Store asynchronously
		// Note: This is intentionally not awaited in constructor
		void this.loadConfigFromParameterStore()
	}

	private async loadConfigFromParameterStore(): Promise<void> {
		try {
			const parameterStore = createParameterStoreService()
			const cognitoConfig = await parameterStore.getCognitoConfig()

			// Update the configuration
			this.config.region = cognitoConfig.region
			this.secretHash = cognitoConfig.userPoolSecretKey
			this.clientId = cognitoConfig.userPoolClientId
			this.userPoolId = cognitoConfig.userPoolId

			// Update the client with the correct region
			this.client = new CognitoIdentityProviderClient(this.config)

			logger.info('Cognito configuration loaded from Parameter Store successfully')
		} catch (error) {
			            logger.error(error as Error, 'Failed to load Cognito configuration from Parameter Store')
			// Don't throw here - let the service fail gracefully if needed
		}
	}

	private async ensureConfigLoaded(): Promise<void> {
		// If configuration is not loaded yet, wait for it
		if (!this.userPoolId || !this.clientId || !this.secretHash) {
			await this.loadConfigFromParameterStore()

			// If still not loaded, throw an error
			if (!this.userPoolId || !this.clientId || !this.secretHash) {
				throw new Error(
					'Failed to load Cognito configuration from Parameter Store',
				)
			}
		}
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
	public signUpUser = async ({
		email,
		password,
		confirmPassword,
	}: TRegisterUserRequest): Promise<Result<SignUpCommandOutput>> => {
		// Ensure configuration is loaded from Parameter Store
		await this.ensureConfigLoaded()

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
	private validateAndExtractUser = (
		users: ListUsersCommandOutput,
		email: string,
		context: string,
	): Result<UserType> => {
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
	public confirmSignUp = async (
		email: string,
		code: number,
	): Promise<Result<ConfirmSignUpCommandOutput>> => {
		// Ensure configuration is loaded from Parameter Store
		await this.ensureConfigLoaded()

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
	public resendConfirmationCode = async (
		email: string,
	): Promise<Result<ResendConfirmationCodeCommandOutput>> => {
		// Ensure configuration is loaded from Parameter Store
		await this.ensureConfigLoaded()

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
	public signInUser = async (
		email: string,
		password: string,
	): Promise<Result<InitiateAuthCommandOutput & { Username: string }>> => {
		// Ensure configuration is loaded from Parameter Store
		await this.ensureConfigLoaded()

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

	public signOutUser = async (
		accessToken: string,
	): Promise<Result<GlobalSignOutCommandOutput>> => {
		// Ensure configuration is loaded from Parameter Store
		await this.ensureConfigLoaded()

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
	public refreshToken = async (
		refreshToken: string,
		username: string,
	): Promise<Result<InitiateAuthCommandOutput>> => {
		// Ensure configuration is loaded from Parameter Store
		await this.ensureConfigLoaded()

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

	public forgotPassword = async (
		email: string,
	): Promise<Result<ForgotPasswordCommandOutput>> => {
		// Ensure configuration is loaded from Parameter Store
		await this.ensureConfigLoaded()

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

	public confirmForgotPassword = async (
		email: string,
		code: string,
		newPassword: string,
		confirmPassword: string,
	): Promise<Result<ConfirmForgotPasswordCommandOutput>> => {
		// Ensure configuration is loaded from Parameter Store
		await this.ensureConfigLoaded()

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

	public getAuthUser = async (
		accessToken: string,
	): Promise<Result<GetUserCommandOutput>> => {
		// Ensure configuration is loaded from Parameter Store
		await this.ensureConfigLoaded()

		const command = new GetUserCommand({
			AccessToken: accessToken,
		})

		return await tryCatch(
			this.client.send(command),
			'authService - getAuthUser',
		)
	}
}

const cognitoService = new CognitoService()

export { CognitoService, cognitoService }
