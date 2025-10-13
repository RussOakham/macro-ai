import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'
import type { DeploymentType } from '../../utils/environment'
import { getStackTags } from '../../utils/environment'

export interface AmplifyAppArgs {
	environmentName: string
	deploymentType: string
	buildSpec: pulumi.Input<string> // Path to amplify.yml file
	repository: string
	accessToken: pulumi.Input<string>
	environmentVariables: Record<string, pulumi.Input<string>>
	customDomainName?: string
	hostedZoneId?: string
	tags?: Record<string, string>
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

		const tags = getStackTags(
			args.environmentName,
			args.deploymentType as DeploymentType,
			args.tags,
		)

		// Create Amplify App
		this.app = new aws.amplify.App(
			`${name}-app`,
			{
				name: `macro-ai-${args.environmentName}`,
				repository: args.repository,
				accessToken: args.accessToken,
				buildSpec: args.buildSpec,
				environmentVariables: args.environmentVariables,
				customRules: [
					{
						source: '/<*>',
						target: '/index.html',
						status: '404-200',
					},
				],
				tags,
			},
			{ parent: this },
		)

		// Create Branch
		this.branch = new aws.amplify.Branch(
			`${name}-branch`,
			{
				appId: this.app.id,
				branchName: AmplifyApp.getBranchName(
					args.deploymentType,
					args.environmentName,
				),
				enableAutoBuild: false, // Manual builds via GitHub Actions
				framework: 'React',
				stage: AmplifyApp.getStage(args.deploymentType),
			},
			{ parent: this },
		)

		// Custom Domain (optional)
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

	private static getBranchName(
		deploymentType: string,
		environmentName: string,
	): string {
		if (deploymentType === 'preview') {
			return `pr-${environmentName.replace('pr-', '')}`
		}
		return deploymentType === 'production' ? 'main' : deploymentType
	}

	private static getStage(deploymentType: string): string {
		const stageMap: Record<string, string> = {
			preview: 'DEVELOPMENT',
			staging: 'BETA',
			production: 'PRODUCTION',
		}
		return stageMap[deploymentType] || 'DEVELOPMENT'
	}

	private static getSubdomain(environmentName: string): string {
		return environmentName.startsWith('pr-') ? environmentName : ''
	}
}
