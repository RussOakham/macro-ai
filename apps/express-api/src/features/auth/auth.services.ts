import {
	CognitoIdentityProviderClient,
	SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import config from 'config'
import { z } from 'zod'
import { TRegister } from './auth.types.ts'
import crypto from 'crypto'

const userAttributes = z.object({
	email: z.string().email(),
})

class CognitoService {
	private config = {
		region: config.get<string>('awsCognitoRegion'),
	}
	private secretHash = config.get<string>('awsCognitoUserPoolSecretKey')
	private clientId = config.get<string>('awsCognitoUserPoolClientId')

	private generateHash(username: string): string {
		return crypto
			.createHmac('SHA256', this.secretHash)
			.update(username + this.clientId)
			.digest('base64')
	}

	public async signUpUser({ email, password, username }: TRegister) {
		const client = new CognitoIdentityProviderClient(this.config)

		const command = new SignUpCommand({
			ClientId: this.clientId,
			Username: username,
			Password: password,
			UserAttributes: [
				{
					Name: 'email',
					Value: email,
				},
			],
			SecretHash: this.generateHash(username),
		})

		return client.send(command)
	}
}

export { CognitoService }
