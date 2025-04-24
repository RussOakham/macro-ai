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
import { AppError } from '../../utils/errors.ts'

import { TRegister } from './auth.types.ts'
class CognitoService {
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

	public async signUpUser({ email, password, confirmPassword }: TRegister) {
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

		return this.client.send(command)
	}

	public async confirmSignUp(email: string, code: number) {
		const getUserCommand = new ListUsersCommand({
			Filter: `email = "${email}"`,
			UserPoolId: this.userPoolId,
		})

		const users = await this.client.send(getUserCommand)

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

		return this.client.send(command)
	}

	public async resendConfirmationCode(email: string) {
		const command = new ResendConfirmationCodeCommand({
			ClientId: this.clientId,
			Username: email,
			SecretHash: this.generateHash(email),
		})

		return this.client.send(command)
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

		const users = await this.client.send(getUserCommand)

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

		const signInResponse = await this.client.send(command)

		return {
			...signInResponse,
			Username: uniqueUser.Username,
		}
	}

	public async signOutUser(accessToken: string) {
		try {
			const signOutCommand = new GlobalSignOutCommand({
				AccessToken: accessToken,
			})

			return await this.client.send(signOutCommand)
		} catch (error) {
			if (this.isTokenExpiredError(error)) {
				throw AppError.unauthorized('Token expired', 'authService')
			}
			throw AppError.from(error, 'authService')
		}
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

		return this.client.send(refreshTokenCommand)
	}

	public async forgotPassword(email: string) {
		// First, get the user's UUID using their email
		const getUserCommand = new ListUsersCommand({
			Filter: `email = "${email}"`,
			UserPoolId: this.userPoolId,
		})
		const users = await this.client.send(getUserCommand)

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

		return this.client.send(command)
	}

	public async confirmForgotPassword(
		email: string,
		code: string,
		newPassword: string,
	) {
		// First, get the user's UUID using their email
		const getUserCommand = new ListUsersCommand({
			Filter: `email = "${email}"`,
			UserPoolId: this.userPoolId,
		})

		const users = await this.client.send(getUserCommand)

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

		return this.client.send(command)
	}

	public async getUser(accessToken: string) {
		try {
			const command = new GetUserCommand({
				AccessToken: accessToken,
			})

			return await this.client.send(command)
		} catch (error) {
			if (this.isTokenExpiredError(error)) {
				throw AppError.unauthorized('Token expired', 'authService')
			}
			throw AppError.from(error, 'authService')
		}
	}
}

export { CognitoService }
