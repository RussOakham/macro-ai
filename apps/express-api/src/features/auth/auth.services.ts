import {
	CognitoIdentityProviderClient,
	CognitoIdentityProviderClientConfig,
	ConfirmSignUpCommand,
	InitiateAuthCommand,
	ListUsersCommand,
	ResendConfirmationCodeCommand,
	SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import config from 'config'
import { TRegister } from './auth.types.ts'
import crypto from 'crypto'

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

	public async signInUser(email: string, password: string) {
		const client = new CognitoIdentityProviderClient(this.config)

		const command = new InitiateAuthCommand({
			ClientId: this.clientId,
			AuthFlow: 'USER_PASSWORD_AUTH',
			AuthParameters: {
				USERNAME: email,
				PASSWORD: password,
				SECRET_HASH: this.generateHash(email),
			},
		})

		return client.send(command)
	}
}

export { CognitoService }
