import { DopplerSDK } from '@dopplerhq/node-sdk'
import type { GetImageResult } from '@pulumi/aws/ecr'
import * as pulumi from '@pulumi/pulumi'

// Application configuration
export const APP_CONFIG = {
	port: 3040,
	healthPath: '/api/health',
}

// Environment settings
export interface EnvironmentSettings {
	NODE_ENV: string
	SERVER_PORT: string
	APP_ENV: string
	CUSTOM_DOMAIN_NAME?: string
}

/**
 * Construct custom domain name based on environment
 */
export function constructCustomDomain(
	environmentName: string,
	baseDomainName: string,
): string {
	if (environmentName === 'staging') {
		return `staging.api.${baseDomainName}`
	}
	if (environmentName === 'production' || environmentName === 'prd') {
		return `api.${baseDomainName}`
	}
	if (environmentName.startsWith('pr-')) {
		const prNumber = environmentName.replace('pr-', '')
		return `pr-${prNumber}.api.${baseDomainName}`
	}
	return `dev.api.${baseDomainName}`
}

/**
 * Get Doppler configuration for environment
 */
export function getDopplerConfig(
	environmentName: string,
	deploymentType: string,
): string {
	// Use configured Doppler config, or fallback to deployment type mapping
	const config = new pulumi.Config()

	const configuredConfig = config.get('doppler:config')
	if (configuredConfig) {
		return configuredConfig
	}

	// Special handling for PR previews - use 'dev' config
	if (deploymentType === 'preview') {
		return 'dev'
	}

	// Fallback to deployment type mapping
	if (deploymentType === 'staging') {
		return 'stg'
	}
	if (deploymentType === 'production') {
		return 'prd'
	}
	return environmentName
}

/**
 * Fetch secrets from Doppler using Node SDK
 */
type DopplerSecretValue = boolean | number | string

export async function fetchDopplerSecrets(
	project: string,
	config: string,
	dopplerToken: string,
): Promise<Record<string, DopplerSecretValue>> {
	let sdk: DopplerSDK | null = null
	let response: any = null

	try {
		sdk = new DopplerSDK({
			accessToken: dopplerToken,
		})

		// Fetch secrets from Doppler
		response = await sdk.secrets.list(project, config)

		if (!response || !response.secrets) {
			throw new Error('No secrets found in Doppler response')
		}

		// Immediately extract only what we need to avoid holding large objects
		const secrets: Record<string, boolean | number | string> = {}
		let secretCount = 0

		// Safely iterate and extract only the computed values
		const secretEntries = Object.entries(response.secrets || {})
		for (const [key, secretObj] of secretEntries) {
			if (
				secretObj &&
				typeof secretObj === 'object' &&
				'computed' in secretObj
			) {
				const computed = (secretObj as any).computed
				if (computed !== undefined && computed !== null) {
					// Only store primitive values
					secrets[key] = computed
					secretCount++
				}
			}
		}

		// Clear response to free memory
		response = null

		console.log(
			`✓ Fetched ${secretCount} secrets from Doppler ${project}/${config}`,
		)
		return secrets
	} catch (error) {
		// Clear any large objects immediately
		response = null
		sdk = null

		// Extract only the error message, not the entire error object
		let errorMsg = 'Unknown error'
		try {
			if (error instanceof Error) {
				errorMsg = error.message
			} else if (typeof error === 'string') {
				errorMsg = error
			} else if (error && typeof error === 'object' && 'message' in error) {
				errorMsg = String((error as any).message)
			}
		} catch {
			errorMsg = 'Error extracting error message'
		}

		// Create a clean error with minimal information
		const cleanError = new Error(
			`Doppler API error (${project}/${config}): ${errorMsg.substring(0, 150)}`,
		)
		console.error(`✗ ${cleanError.message}`)
		throw cleanError
	}
}

/**
 * Get Doppler secrets and merge with environment variables
 */
export function getDopplerSecrets(
	dopplerToken: pulumi.Output<string> | undefined,
	project: string,
	config: string,
	additionalEnvVars: Partial<EnvironmentSettings> = {},
): pulumi.Output<Record<string, string>> {
	return pulumi.secret(
		pulumi.output(dopplerToken).apply(async (token) => {
			// Fall back to environment variable if Pulumi config is not available
			const fallbackToken =
				process.env.DOPPLER_TOKEN || process.env.DOPPLER_TOKEN_STAGING
			// Treat empty string as no token
			const finalToken = (token && token.trim()) || fallbackToken

			if (!finalToken || finalToken.trim() === '') {
				console.warn(
					'⚠ No Doppler token found, using only additional env vars',
				)
				// Return only additional env vars if no token
				const envVars: Record<string, string> = {}
				Object.entries(additionalEnvVars).forEach(([key, value]) => {
					// eslint-disable-next-line sonarjs/different-types-comparison
					if (value !== undefined) {
						envVars[key] = String(value)
					}
				})
				return envVars
			}

			try {
				const secrets = await fetchDopplerSecrets(project, config, finalToken)
				const envVars: Record<string, string> = {}

				// Process secrets from the Node SDK response
				if (secrets) {
					Object.entries(secrets).forEach(([key, value]) => {
						envVars[key] = String(value)
					})
				}

				// Add additional environment variables (overrides Doppler)
				Object.entries(additionalEnvVars).forEach(([key, value]) => {
					// eslint-disable-next-line sonarjs/different-types-comparison
					if (value !== undefined) {
						envVars[key] = String(value)
					}
				})

				return envVars
			} catch (error) {
				// Provide minimal error details to avoid serialization issues
				const errorMessage =
					error instanceof Error ? error.message : 'Unknown Doppler error'
				const simpleError = new Error(
					`Doppler secrets fetch failed for ${project}/${config}: ${errorMessage.substring(0, 150)}`,
				)
				console.error(`✗ ${simpleError.message}`)
				throw simpleError
			}
		}),
	)
}

/**
 * Resolve image URI from config or ECR
 */
export function resolveImageUri(
	imageUri: string | undefined,
	ecrRepositoryName: string,
	imageTag: string,
): pulumi.Output<string> {
	if (imageUri) {
		return pulumi.output(imageUri)
	}

	// Import ECR module dynamically to avoid bundling issues
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const { getImageOutput } = require('@pulumi/aws/ecr')
	const ecrImage = getImageOutput({
		repositoryName: ecrRepositoryName,
		imageTag,
	})

	return ecrImage.apply((image: GetImageResult) => {
		if (!image.imageDigest || !image.imageUri) {
			throw new Error(
				`Image with tag '${imageTag}' not found in ECR repository '${ecrRepositoryName}'`,
			)
		}
		return image.imageUri
	})
}

/**
 * Get cost optimization settings based on environment
 */
export function getCostOptimizedSettings(environmentName: string) {
	const isPreview = environmentName.startsWith('pr-')
	const isProduction =
		environmentName === 'production' || environmentName === 'prd'

	let logRetentionDays: number
	if (isPreview) {
		logRetentionDays = 7
	} else if (isProduction) {
		logRetentionDays = 30
	} else {
		logRetentionDays = 14
	}

	return {
		enableDeletionProtection: isProduction,
		enableNatGateways: false, // Cost optimization - no NATs for preview environments
		logRetentionDays,
		ecsCpu: isPreview ? '256' : '512',
		ecsMemory: isPreview ? '512' : '1024',
	}
}

/**
 * Get environment settings for the current deployment
 */
export function getEnvironmentSettings(
	environmentName: string,
	customDomainName?: string,
): EnvironmentSettings {
	return {
		NODE_ENV: 'production',
		SERVER_PORT: String(APP_CONFIG.port),
		APP_ENV: environmentName,
		CUSTOM_DOMAIN_NAME: customDomainName ?? '',
	}
}
