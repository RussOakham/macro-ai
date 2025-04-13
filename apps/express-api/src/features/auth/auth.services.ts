import {
	CognitoIdentityProviderClient,
	CognitoIdentityProviderClientConfig,
	ConfirmSignUpCommand,
	GetUserCommand,
	GlobalSignOutCommand,
	InitiateAuthCommand,
	InitiateAuthCommandOutput,
	ListUsersCommand,
	NotAuthorizedException,
	ResendConfirmationCodeCommand,
	SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import config from 'config'
import crypto from 'crypto'

import { TRegister } from './auth.types.ts'

class CognitoService {
	private readonly config: CognitoIdentityProviderClientConfig = {
		region: config.get<string>('awsCognitoRegion'),
		credentials: {
			accessKeyId: config.get<string>('awsCognitoAccessKey'),
			secretAccessKey: config.get<string>('awsCognitoSecretKey'),
		},
	}
	private readonly secretHash = config.get<string>(
		'awsCognitoUserPoolSecretKey',
	)
	private readonly clientId = config.get<string>('awsCognitoUserPoolClientId')
	private readonly userPoolId = config.get<string>('awsCognitoUserPoolId')

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
			throw new Error('[authService]: SignUpUser - Passwords do not match')
		}

		const client = new CognitoIdentityProviderClient(this.config)

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

		return client.send(command)
	}

	public async confirmSignUp(email: string, code: number) {
		const client = new CognitoIdentityProviderClient(this.config)

		const getUserCommand = new ListUsersCommand({
			Filter: `email = "${email}"`,
			UserPoolId: this.userPoolId,
		})

		const users = await client.send(getUserCommand)

		if (!users.Users || users.Users.length === 0) {
			throw new Error('User not found')
		}

		const uniqueUser = users.Users.find(
			(user) =>
				user.Attributes?.find((attr) => attr.Name === 'email')?.Value === email,
		)

		if (!uniqueUser?.Username) {
			throw new Error('User not found')
		}

		const command = new ConfirmSignUpCommand({
			ClientId: this.clientId,
			Username: uniqueUser.Username,
			ConfirmationCode: code.toString(),
			SecretHash: this.generateHash(uniqueUser.Username),
		})

		return client.send(command)
	}

	public async resendConfirmationCode(email: string) {
		const client = new CognitoIdentityProviderClient(this.config)

		const command = new ResendConfirmationCodeCommand({
			ClientId: this.clientId,
			Username: email,
			SecretHash: this.generateHash(email),
		})

		return client.send(command)
	}

	public async signInUser(
		email: string,
		password: string,
	): Promise<InitiateAuthCommandOutput & { Username: string }> {
		const client = new CognitoIdentityProviderClient(this.config)

		// First, get the user's UUID using their email
		const getUserCommand = new ListUsersCommand({
			Filter: `email = "${email}"`,
			UserPoolId: this.userPoolId,
		})

		const users = await client.send(getUserCommand)

		if (!users.Users || users.Users.length === 0) {
			throw new Error('User not found')
		}

		const uniqueUser = users.Users.find(
			(user) =>
				user.Attributes?.find((attr) => attr.Name === 'email')?.Value === email,
		)

		if (!uniqueUser?.Username) {
			throw new Error('User not found')
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

		const signInResponse = await client.send(command)

		return {
			...signInResponse,
			Username: uniqueUser.Username,
		}
	}

	public async signOutUser(accessToken: string) {
		const client = new CognitoIdentityProviderClient(this.config)

		try {
			const signOutCommand = new GlobalSignOutCommand({
				AccessToken: accessToken,
			})

			return await client.send(signOutCommand)
		} catch (error) {
			if (this.isTokenExpiredError(error)) {
				throw new Error('TOKEN_EXPIRED')
			}
			throw error
		}
	}

	public async refreshToken(refreshToken: string, username: string) {
		const client = new CognitoIdentityProviderClient(this.config)

		const refreshTokenCommand = new InitiateAuthCommand({
			ClientId: this.clientId,
			AuthFlow: 'REFRESH_TOKEN_AUTH',
			AuthParameters: {
				REFRESH_TOKEN: refreshToken,
				SECRET_HASH: this.generateHash(username),
			},
		})

		return client.send(refreshTokenCommand)
	}

	public async getUser(accessToken: string) {
		const client = new CognitoIdentityProviderClient(this.config)

		try {
			const command = new GetUserCommand({
				AccessToken: accessToken,
			})

			return await client.send(command)
		} catch (error) {
			if (this.isTokenExpiredError(error)) {
				throw new Error('TOKEN_EXPIRED')
			}
			throw error
		}
	}
}

export { CognitoService }
