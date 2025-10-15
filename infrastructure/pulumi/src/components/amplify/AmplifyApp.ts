import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'

import type { DeploymentType } from '../../utils/environment'
import { getStackTags } from '../../utils/environment'

// Re-export Pulumi AWS types for better type safety
export type AmplifyAppInput = aws.amplify.AppArgs
export type AmplifyBranchInput = aws.amplify.BranchArgs
export type AmplifyDomainAssociationInput = aws.amplify.DomainAssociationArgs
export type AmplifyCustomRule = aws.types.input.amplify.AppCustomRule
export type AmplifySubDomain =
	aws.types.input.amplify.DomainAssociationSubDomain

// Type-safe stage mapping
export type AmplifyStage =
	| 'BETA'
	| 'DEVELOPMENT'
	| 'EXPERIMENTAL'
	| 'PRODUCTION'
	| 'PULL_REQUEST'

// Type-safe framework options
export type AmplifyFramework =
	| 'Angular'
	| 'Aurelia'
	| 'Backbone'
	| 'Ember'
	| 'Ionic'
	| 'jQuery'
	| 'Next.js'
	| 'Nuxt'
	| 'Other'
	| 'Polymer'
	| 'Preact'
	| 'React'
	| 'Svelte'
	| 'Vanilla JS'
	| 'Vue'

// Enhanced interface with better typing
export interface AmplifyAppArgs {
	environmentName: string
	deploymentType: DeploymentType
	buildSpec: pulumi.Input<string>
	repository: string
	accessToken: pulumi.Input<string>
	environmentVariables: Record<string, pulumi.Input<string>>
	customDomainName?: string
	hostedZoneId?: string
	tags?: Record<string, string>
	// Additional type-safe options
	framework?: AmplifyFramework
	platform?: 'WEB' | 'WEB_COMPUTE'
	enableAutoBuild?: boolean
	enableBasicAuth?: boolean
	basicAuthCredentials?: pulumi.Input<string>
	customRules?: AmplifyCustomRule[]
	description?: string
}

export class AmplifyApp extends pulumi.ComponentResource {
	public readonly app: aws.amplify.App
	public readonly branch: aws.amplify.Branch
	public readonly domainAssociation?: aws.amplify.DomainAssociation
	public readonly url: pulumi.Output<string>

	constructor(
		name: string,
		args: AmplifyAppArgs,
		opts?: pulumi.ComponentResourceOptions,
	) {
		super('macro-ai:amplify:AmplifyApp', name, {}, opts)

		// Validate required arguments
		AmplifyApp.validateArgs(args)

		const tags = getStackTags(
			args.environmentName,
			args.deploymentType,
			args.tags,
		)

		// Validate and normalize repository URL
		const normalizedRepository = AmplifyApp.normalizeRepositoryUrl(
			args.repository,
		)


		// Create Amplify App with proper typing
		this.app = new aws.amplify.App(
			`${name}-app`,
			{
				name: `macro-ai-${args.environmentName}`,
				repository: normalizedRepository,
				accessToken: args.accessToken,
				buildSpec: args.buildSpec,
				environmentVariables: args.environmentVariables,
				customRules: args.customRules || [
					{
						source: '/<*>',
						target: '/index.html',
						status: '404-200',
					},
				],
				platform: args.platform || 'WEB',
				description:
					args.description || `Macro AI ${args.environmentName} frontend`,
				tags,
			},
			{ parent: this },
		)

		// Create Branch with proper typing
		this.branch = new aws.amplify.Branch(
			`${name}-branch`,
			{
				appId: this.app.id,
				branchName: AmplifyApp.getBranchName(
					args.deploymentType,
					args.environmentName,
				),
				enableAutoBuild: args.enableAutoBuild ?? false, // Manual builds via GitHub Actions
				framework: args.framework || 'React',
				stage: AmplifyApp.getStage(args.deploymentType, args.environmentName),
				enableBasicAuth: args.enableBasicAuth,
				basicAuthCredentials: args.basicAuthCredentials,
			},
			{ parent: this },
		)

		// Custom Domain (optional) with proper typing
		if (args.customDomainName && args.hostedZoneId) {
			this.domainAssociation = new aws.amplify.DomainAssociation(
				`${name}-domain`,
				{
					appId: this.app.id,
					domainName: args.customDomainName,
					subDomains: [
						{
							branchName: this.branch.branchName,
							prefix: AmplifyApp.getSubdomain(args.environmentName),
						},
					],
					waitForVerification: true,
				},
				{ parent: this },
			)
		}

		this.url = this.domainAssociation
			? pulumi.interpolate`https://${this.domainAssociation.domainName}`
			: pulumi.interpolate`https://${this.branch.branchName}.${this.app.defaultDomain}`

		this.registerOutputs({
			appId: this.app.id,
			branchName: this.branch.branchName,
			url: this.url,
		})
	}

	/**
	 * Create a custom rule for API proxy
	 */
	static createApiProxyRule(apiUrl: string): AmplifyCustomRule {
		return {
			source: '/api/<*>',
			target: `${apiUrl}/api/<*>`,
			status: '200',
		}
	}

	/**
	 * Create a custom rule for SPA routing
	 */
	static createSpaRule(): AmplifyCustomRule {
		return {
			source: '/<*>',
			target: '/index.html',
			status: '404-200',
		}
	}

	/**
	 * Get branch name based on deployment type and environment
	 */
	private static getBranchName(
		deploymentType: DeploymentType,
		environmentName: string,
	): string {
		if (deploymentType === 'preview') {
			return `pr-${environmentName.replace('pr-', '')}`
		}

		// For permanent deployments, determine branch based on environment name
		if (
			environmentName === 'production' ||
			environmentName === 'prd' ||
			environmentName === 'prod'
		) {
			return 'main'
		}
		if (environmentName === 'staging' || environmentName === 'stg') {
			return 'staging'
		}

		return 'dev'
	}

	/**
	 * Get Amplify stage based on deployment type and environment name
	 */
	private static getStage(
		deploymentType: DeploymentType,
		environmentName?: string,
	): AmplifyStage {
		if (deploymentType === 'preview') {
			return 'DEVELOPMENT'
		}

		// For permanent deployments, determine stage based on environment name
		if (
			environmentName === 'production' ||
			environmentName === 'prd' ||
			environmentName === 'prod'
		) {
			return 'PRODUCTION'
		}
		if (environmentName === 'staging' || environmentName === 'stg') {
			return 'BETA'
		}

		return 'DEVELOPMENT'
	}

	/**
	 * Get subdomain prefix based on environment name
	 */
	private static getSubdomain(environmentName: string): string {
		return environmentName.startsWith('pr-') ? environmentName : ''
	}

	/**
	 * Normalize repository URL to ensure proper format for AWS Amplify
	 */
	private static normalizeRepositoryUrl(repository: string): string {
		if (!repository?.trim()) {
			throw new Error('Repository URL is required and cannot be empty')
		}

		let normalized = repository.trim()

		// If it's already a full URL, return as-is
		if (normalized.startsWith('https://github.com/')) {
			return normalized
		}

		// If it's in owner/repo format, convert to full URL
		if (normalized.includes('/') && !normalized.includes('://')) {
			normalized = `https://github.com/${normalized}`
		}

		// Validate the final format
		if (!normalized.startsWith('https://github.com/')) {
			throw new Error(
				`Invalid repository URL format: ${repository}. Expected format: 'https://github.com/owner/repo' or 'owner/repo'`,
			)
		}

		return normalized
	}

	/**
	 * Validate required arguments and throw descriptive errors
	 */
	private static validateArgs(args: AmplifyAppArgs): void {
		if (!args.environmentName?.trim()) {
			throw new Error('environmentName is required and cannot be empty')
		}
		if (!args.repository?.trim()) {
			throw new Error('repository is required and cannot be empty')
		}
		if (!args.accessToken) {
			throw new Error('accessToken is required')
		}
		if (!args.buildSpec) {
			throw new Error('buildSpec is required')
		}
		if (args.customDomainName && !args.hostedZoneId) {
			throw new Error(
				'hostedZoneId is required when customDomainName is provided',
			)
		}

		// Additional validation with better error messages
		try {
			AmplifyApp.normalizeRepositoryUrl(args.repository)
		} catch (error) {
			throw new Error(
				`Repository validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			)
		}
	}
}
