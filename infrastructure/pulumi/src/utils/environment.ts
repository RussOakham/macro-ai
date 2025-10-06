import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'
import { COST_OPTIMIZATION, ENVIRONMENT_CONFIGS } from '../config/constants'

/**
 * Get environment-specific configuration
 */
export function getEnvironmentSettings(environmentName: string) {
	const envConfig =
		ENVIRONMENT_CONFIGS[environmentName as keyof typeof ENVIRONMENT_CONFIGS]

	if (!envConfig) {
		// Default to dev settings for unknown environments
		return {
			...ENVIRONMENT_CONFIGS.dev,
			dopplerConfig: environmentName,
		}
	}

	return envConfig
}

/**
 * Get cost-optimized settings based on environment
 */
export function getCostOptimizedSettings(environmentName: string) {
	const isPreview = environmentName.startsWith('pr-')
	const isPermanent = ['dev', 'prd', 'production', 'staging'].includes(
		environmentName,
	)

	return {
		logRetentionDays: isPreview
			? COST_OPTIMIZATION.logRetentionDays.preview
			: COST_OPTIMIZATION.logRetentionDays.permanent,
		enableNatGateways: isPermanent ? true : COST_OPTIMIZATION.enableNatGateways,
		enableDeletionProtection: isPermanent
			? getEnvironmentSettings(environmentName).enableDeletionProtection
			: false,
	}
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
	} else if (environmentName === 'production' || environmentName === 'prd') {
		return `api.${baseDomainName}`
	} else if (environmentName.startsWith('pr-')) {
		const prNumber = environmentName.replace('pr-', '')
		return `pr-${prNumber}.api.${baseDomainName}`
	} else {
		// Dev environment
		return `dev.api.${baseDomainName}`
	}
}

/**
 * Get Doppler configuration for environment
 */
export function getDopplerConfig(
	environmentName: string,
	deploymentType?: string,
): string {
	// Special handling for preview environments
	if (deploymentType === 'preview') {
		return 'dev'
	}

	const envSettings = getEnvironmentSettings(environmentName)
	return envSettings.dopplerConfig
}

/**
 * Resolve ECR image URI
 */
export function resolveImageUri(
	imageUri: string | undefined,
	repositoryName: string,
	imageTag: string,
): pulumi.Output<string> {
	if (imageUri) {
		return pulumi.output(imageUri)
	}

	return aws.ecr.getImageOutput({
		repositoryName,
		imageTag,
	}).imageUri
}
