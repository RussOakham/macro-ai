/**
 * Runtime Parameter Store Integration
 *
 * This utility fetches configuration values from AWS Parameter Store at runtime
 * using the ECS task role instead of requiring environment variables to be
 * injected at build time.
 */

import {
	GetParameterCommand,
	GetParametersByPathCommand,
	SSMClient,
} from '@aws-sdk/client-ssm'

export interface ParameterStoreConfig {
	parameterStorePrefix: string
	region?: string
}

export class ParameterStoreService {
	private ssmClient: SSMClient
	private config: ParameterStoreConfig
	private cache = new Map<string, string>()

	constructor(config: ParameterStoreConfig) {
		this.config = config
		this.ssmClient = new SSMClient({
			region: config.region ?? process.env.AWS_REGION ?? 'us-east-1',
		})
	}

	/**
	 * Get a single parameter value
	 */
	async getParameter(
		parameterName: string,
		withDecryption = true,
	): Promise<string> {
		const cacheKey = `${parameterName}:${String(withDecryption)}`

		if (this.cache.has(cacheKey)) {
			const cachedValue = this.cache.get(cacheKey)
			if (cachedValue) return cachedValue
		}

		try {
			const command = new GetParameterCommand({
				Name: `${this.config.parameterStorePrefix}${parameterName}`,
				WithDecryption: withDecryption,
			})

			const response = await this.ssmClient.send(command)
			const value = response.Parameter?.Value

			if (!value) {
				throw new Error(`Parameter ${parameterName} not found or has no value`)
			}

			// Cache the result
			this.cache.set(cacheKey, value)
			return value
		} catch (error) {
			console.error(`Failed to fetch parameter ${parameterName}:`, error)
			throw error
		}
	}

	/**
	 * Get multiple parameters by path
	 */
	async getParametersByPath(
		path: string,
		withDecryption = true,
	): Promise<Record<string, string>> {
		try {
			const command = new GetParametersByPathCommand({
				Path: `${this.config.parameterStorePrefix}${path}`,
				WithDecryption: withDecryption,
				Recursive: true,
			})

			const response = await this.ssmClient.send(command)
			const parameters: Record<string, string> = {}

			if (response.Parameters) {
				for (const param of response.Parameters) {
					if (param.Name && param.Value) {
						// Extract just the parameter name without the prefix
						const paramName = param.Name.replace(
							this.config.parameterStorePrefix,
							'',
						)
						parameters[paramName] = param.Value

						// Cache individual parameters
						this.cache.set(
							`${paramName}:${String(withDecryption)}`,
							param.Value,
						)
					}
				}
			}

			return parameters
		} catch (error) {
			console.error(`Failed to fetch parameters by path ${path}:`, error)
			throw error
		}
	}

	/**
	 * Get all Cognito-related parameters
	 */
	async getCognitoConfig(): Promise<{
		region: string
		userPoolId: string
		userPoolClientId: string
		userPoolSecretKey: string
		refreshTokenExpiry: number
	}> {
		try {
			const [
				region,
				userPoolId,
				userPoolClientId,
				userPoolSecretKey,
				refreshTokenExpiry,
			] = await Promise.all([
				this.getParameter('aws-cognito-region', false),
				this.getParameter('aws-cognito-user-pool-id'),
				this.getParameter('aws-cognito-user-pool-client-id'),
				this.getParameter('aws-cognito-user-pool-secret-key'),
				this.getParameter('aws-cognito-refresh-token-expiry', false),
			])

			return {
				region,
				userPoolId,
				userPoolClientId,
				userPoolSecretKey,
				refreshTokenExpiry: parseInt(refreshTokenExpiry, 10),
			}
		} catch (error) {
			console.error('Failed to fetch Cognito configuration:', error)
			throw error
		}
	}

	/**
	 * Clear the cache
	 */
	clearCache(): void {
		this.cache.clear()
	}
}

/**
 * Create a Parameter Store service instance
 */
export const createParameterStoreService = (): ParameterStoreService => {
	const parameterStorePrefix = process.env.PARAMETER_STORE_PREFIX

	if (!parameterStorePrefix) {
		throw new Error('PARAMETER_STORE_PREFIX environment variable is required')
	}

	return new ParameterStoreService({
		parameterStorePrefix,
		region: process.env.AWS_REGION,
	})
}
