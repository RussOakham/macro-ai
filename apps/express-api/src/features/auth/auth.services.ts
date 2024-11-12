import {
	CognitoUserAttribute,
	CognitoUserPool,
	// ICognitoUserPoolData,
} from 'amazon-cognito-identity-js'
import config from 'config'

import { pino } from '../../utils/logger.ts'

const { logger } = pino

export interface IUserToken {
	accessToken: string
	refreshToken: string
}

// https://aws.plainenglish.io/how-to-create-authentication-apis-with-aws-cognito-648bf3225b5d

class CognitoUserPoolHelper {
	public userPool: CognitoUserPool

	constructor() {
		const awsCognitoUserPoolId = config.get<string>('awsCognitoUserPoolId')
		const awsCognitoUserPoolClientId = config.get<string>(
			'awsCognitoUserPoolClientId',
		)

		if (!awsCognitoUserPoolId || !awsCognitoUserPoolClientId) {
			throw new Error('AWS Cognito configuration is missing')
		}

		this.userPool = new CognitoUserPool({
			UserPoolId: awsCognitoUserPoolId,
			ClientId: awsCognitoUserPoolClientId,
		})
	}

	public register({
		email,
		password,
	}: {
		email: string
		password: string
	}): Promise<string> {
		return new Promise((resolve, reject) => {
			const attributeList: CognitoUserAttribute[] = [
				new CognitoUserAttribute({
					Name: 'email',
					Value: email,
				}),
			]

			this.userPool.signUp(
				email,
				password,
				attributeList,
				[],
				(err, result) => {
					if (err) {
						logger.error(
							`[CognitoUserPoolHelper]: Error registering user: ${err}`,
						)
						reject(err)
					}

					logger.info(
						`[CognitoUserPoolHelper]: User registered successfully: ${result?.user.getUsername() ?? ''}`,
					)
					resolve(result?.user.getUsername() ?? '')
				},
			)
		})
	}
}

export default new CognitoUserPoolHelper()

// Make auth register router and auth controller

// Add zod verification middleware

// Add error types
