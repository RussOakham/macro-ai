export interface CommonTags {
	Project: string
	ManagedBy: string
	Environment: string
	DeploymentType: string
	CostCenter: string
	AutoShutdown?: string
	GitBranch?: string
	PullRequest?: string
}

export function getCommonTags(
	environmentName: string,
	deploymentType: string,
): CommonTags {
	const isPreview = environmentName.startsWith('pr-')
	const prNumber = isPreview ? environmentName.replace('pr-', '') : undefined

	const tags: CommonTags = {
		Project: 'MacroAI',
		ManagedBy: 'Pulumi',
		Environment: environmentName,
		DeploymentType: deploymentType,
		CostCenter: isPreview ? 'Development' : environmentName,
	}

	if (isPreview) {
		tags.AutoShutdown = 'true'
		tags.PullRequest = prNumber
	}

	return tags
}

export function getEnvironmentConfig(environmentName: string) {
	return {
		isPreview: environmentName.startsWith('pr-'),
		isPermanent: ['dev', 'prd', 'production', 'staging'].includes(
			environmentName,
		),
		isProduction: ['prd', 'production'].includes(environmentName),
		isDevelopment: environmentName === 'dev',
		isStaging: environmentName === 'staging',
	}
}
