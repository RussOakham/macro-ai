import * as cdk from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import type { Construct } from 'constructs'

export interface AmplifyPermissionsConstructProps {
	/**
	 * Environment name for the deployment
	 */
	readonly environmentName: string

	/**
	 * Whether to create GitHub Actions role
	 * @default false
	 */
	readonly createGitHubActionsRole?: boolean

	/**
	 * GitHub repository for OIDC trust policy
	 * Format: "owner/repository"
	 */
	readonly gitHubRepository?: string

	/**
	 * Additional Amplify app name patterns to allow
	 * @default ['macro-ai-frontend-pr-*', 'macro-ai-frontend-staging', 'macro-ai-frontend-production']
	 */
	readonly allowedAppNamePatterns?: string[]
}

/**
 * Construct for managing Amplify-related IAM permissions
 *
 * This construct creates IAM policies and optionally roles for:
 * - GitHub Actions workflows to manage Amplify apps
 * - CloudFormation stack discovery for backend integration
 * - S3 access for deployment artifacts
 * - Service-linked role creation for Amplify
 */
export class AmplifyPermissionsConstruct extends cdk.NestedStack {
	public readonly amplifyPolicy: iam.ManagedPolicy
	public readonly cloudFormationDiscoveryPolicy: iam.ManagedPolicy
	public readonly gitHubActionsRole?: iam.Role

	constructor(
		scope: Construct,
		id: string,
		props: AmplifyPermissionsConstructProps,
	) {
		super(scope, id)

		const { environmentName, createGitHubActionsRole, gitHubRepository } = props

		// Create Amplify management policy
		this.amplifyPolicy = this.createAmplifyPolicy(props)

		// Create CloudFormation discovery policy
		this.cloudFormationDiscoveryPolicy =
			this.createCloudFormationDiscoveryPolicy()

		// Optionally create GitHub Actions role
		if (createGitHubActionsRole && gitHubRepository) {
			this.gitHubActionsRole = this.createGitHubActionsRole(
				gitHubRepository,
				environmentName,
			)
		}

		// Output policy ARNs
		new cdk.CfnOutput(this, 'AmplifyPolicyArn', {
			value: this.amplifyPolicy.managedPolicyArn,
			description: 'ARN of the Amplify management policy',
			exportName: `MacroAi${environmentName}AmplifyPolicyArn`,
		})

		new cdk.CfnOutput(this, 'CloudFormationDiscoveryPolicyArn', {
			value: this.cloudFormationDiscoveryPolicy.managedPolicyArn,
			description: 'ARN of the CloudFormation discovery policy',
			exportName: `MacroAi${environmentName}CloudFormationDiscoveryPolicyArn`,
		})

		if (this.gitHubActionsRole) {
			new cdk.CfnOutput(this, 'GitHubActionsRoleArn', {
				value: this.gitHubActionsRole.roleArn,
				description: 'ARN of the GitHub Actions role',
				exportName: `MacroAi${environmentName}GitHubActionsRoleArn`,
			})
		}
	}

	private createAmplifyPolicy(
		props: AmplifyPermissionsConstructProps,
	): iam.ManagedPolicy {
		const allowedAppPatterns = props.allowedAppNamePatterns ?? [
			'macro-ai-frontend-pr-*',
			'macro-ai-frontend-staging',
			'macro-ai-frontend-production',
			'macro-ai-frontend-development',
		]

		return new iam.ManagedPolicy(this, 'AmplifyManagementPolicy', {
			description:
				'Policy for managing AWS Amplify applications in Macro AI project',
			statements: [
				// Amplify app management with name restrictions
				new iam.PolicyStatement({
					sid: 'AmplifyAppManagement',
					effect: iam.Effect.ALLOW,
					actions: [
						'amplify:CreateApp',
						'amplify:DeleteApp',
						'amplify:GetApp',
						'amplify:ListApps',
						'amplify:UpdateApp',
						'amplify:TagResource',
						'amplify:UntagResource',
						'amplify:ListTagsForResource',
					],
					resources: ['*'],
					conditions: {
						StringLike: {
							'amplify:appName': allowedAppPatterns,
						},
					},
				}),

				// Amplify branch management
				new iam.PolicyStatement({
					sid: 'AmplifyBranchManagement',
					effect: iam.Effect.ALLOW,
					actions: [
						'amplify:CreateBranch',
						'amplify:DeleteBranch',
						'amplify:GetBranch',
						'amplify:ListBranches',
						'amplify:UpdateBranch',
					],
					resources: ['arn:aws:amplify:*:*:apps/*/branches/*'],
				}),

				// Amplify deployment management
				new iam.PolicyStatement({
					sid: 'AmplifyDeploymentManagement',
					effect: iam.Effect.ALLOW,
					actions: [
						'amplify:StartDeployment',
						'amplify:StartJob',
						'amplify:StopJob',
						'amplify:GetJob',
						'amplify:ListJobs',
					],
					resources: [
						'arn:aws:amplify:*:*:apps/*',
						'arn:aws:amplify:*:*:apps/*/branches/*',
						'arn:aws:amplify:*:*:apps/*/branches/*/jobs/*',
					],
				}),

				// S3 access for Amplify deployment artifacts
				new iam.PolicyStatement({
					sid: 'S3AmplifyDeploymentBuckets',
					effect: iam.Effect.ALLOW,
					actions: [
						's3:GetObject',
						's3:PutObject',
						's3:DeleteObject',
						's3:ListBucket',
					],
					resources: ['arn:aws:s3:::amplify-*', 'arn:aws:s3:::amplify-*/*'],
				}),

				// CloudWatch Logs for Amplify
				new iam.PolicyStatement({
					sid: 'AmplifyLogsAccess',
					effect: iam.Effect.ALLOW,
					actions: [
						'logs:CreateLogGroup',
						'logs:CreateLogStream',
						'logs:PutLogEvents',
						'logs:DescribeLogGroups',
						'logs:DescribeLogStreams',
					],
					resources: [
						'arn:aws:logs:*:*:log-group:/aws/amplify/*',
						'arn:aws:logs:*:*:log-group:/aws/amplify/*:*',
					],
				}),

				// Service-linked role creation for Amplify
				new iam.PolicyStatement({
					sid: 'AmplifyServiceLinkedRole',
					effect: iam.Effect.ALLOW,
					actions: ['iam:CreateServiceLinkedRole'],
					resources: [
						'arn:aws:iam::*:role/aws-service-role/amplify.amazonaws.com/AWSServiceRoleForAmplifyBackend',
					],
					conditions: {
						StringEquals: {
							'iam:AWSServiceName': 'amplify.amazonaws.com',
						},
					},
				}),

				// IAM PassRole for Amplify service roles
				new iam.PolicyStatement({
					sid: 'AmplifyPassRole',
					effect: iam.Effect.ALLOW,
					actions: ['iam:PassRole'],
					resources: ['arn:aws:iam::*:role/amplifyconsole-*'],
					conditions: {
						StringEquals: {
							'iam:PassedToService': 'amplify.amazonaws.com',
						},
					},
				}),
			],
		})
	}

	private createCloudFormationDiscoveryPolicy(): iam.ManagedPolicy {
		return new iam.ManagedPolicy(this, 'CloudFormationDiscoveryPolicy', {
			description:
				'Policy for discovering CloudFormation stacks for backend integration',
			statements: [
				// CloudFormation stack discovery for backend integration
				new iam.PolicyStatement({
					sid: 'CloudFormationStackDiscovery',
					effect: iam.Effect.ALLOW,
					actions: [
						'cloudformation:DescribeStacks',
						'cloudformation:DescribeStackResources',
						'cloudformation:DescribeStackEvents',
						'cloudformation:GetTemplate',
						'cloudformation:ListStacks',
						'cloudformation:ListStackResources',
					],
					resources: [
						'arn:aws:cloudformation:*:*:stack/MacroAi*Stack/*',
						'arn:aws:cloudformation:*:*:stack/macro-ai-*/*',
					],
				}),

				// General stack listing for discovery
				new iam.PolicyStatement({
					sid: 'CloudFormationStackListing',
					effect: iam.Effect.ALLOW,
					actions: ['cloudformation:ListStacks'],
					resources: ['*'],
					conditions: {
						StringLike: {
							'cloudformation:StackName': ['MacroAi*Stack', 'macro-ai-*'],
						},
					},
				}),

				// STS for identity verification
				new iam.PolicyStatement({
					sid: 'STSAccess',
					effect: iam.Effect.ALLOW,
					actions: ['sts:GetCallerIdentity'],
					resources: ['*'],
				}),
			],
		})
	}

	private createGitHubActionsRole(
		gitHubRepository: string,
		environmentName: string,
	): iam.Role {
		// Create OIDC provider reference (assumes it already exists)
		const oidcProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
			this,
			'GitHubOIDCProvider',
			`arn:aws:iam::${cdk.Stack.of(this).account}:oidc-provider/token.actions.githubusercontent.com`,
		)

		// Create the role with OIDC trust policy
		const role = new iam.Role(this, 'GitHubActionsRole', {
			roleName: `MacroAi${environmentName}GitHubActionsRole`,
			description: `GitHub Actions role for Macro AI ${environmentName} environment`,
			assumedBy: new iam.WebIdentityPrincipal(
				oidcProvider.openIdConnectProviderArn,
				{
					StringEquals: {
						'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
					},
					StringLike: {
						'token.actions.githubusercontent.com:sub': `repo:${gitHubRepository}:*`,
					},
				},
			),
			maxSessionDuration: cdk.Duration.hours(1),
		})

		// Attach the Amplify and CloudFormation policies
		role.addManagedPolicy(this.amplifyPolicy)
		role.addManagedPolicy(this.cloudFormationDiscoveryPolicy)

		// Add tags for resource management
		cdk.Tags.of(role).add('Project', 'MacroAI')
		cdk.Tags.of(role).add('Environment', environmentName)
		cdk.Tags.of(role).add('Purpose', 'GitHubActions')
		cdk.Tags.of(role).add('Service', 'Amplify')

		return role
	}

	/**
	 * Grant additional permissions to an existing role
	 */
	public grantAmplifyPermissions(role: iam.IRole): void {
		role.addManagedPolicy(this.amplifyPolicy)
		role.addManagedPolicy(this.cloudFormationDiscoveryPolicy)
	}

	/**
	 * Create a policy for specific Amplify app patterns
	 */
	public createCustomAmplifyPolicy(
		id: string,
		appNamePatterns: string[],
		description?: string,
	): iam.ManagedPolicy {
		return new iam.ManagedPolicy(this, id, {
			description:
				description ?? 'Custom Amplify policy with specific app name patterns',
			statements: [
				new iam.PolicyStatement({
					effect: iam.Effect.ALLOW,
					actions: [
						'amplify:CreateApp',
						'amplify:DeleteApp',
						'amplify:GetApp',
						'amplify:ListApps',
						'amplify:UpdateApp',
						'amplify:CreateBranch',
						'amplify:DeleteBranch',
						'amplify:GetBranch',
						'amplify:ListBranches',
						'amplify:UpdateBranch',
						'amplify:StartDeployment',
						'amplify:StartJob',
						'amplify:StopJob',
						'amplify:GetJob',
						'amplify:ListJobs',
					],
					resources: ['*'],
					conditions: {
						StringLike: {
							'amplify:appName': appNamePatterns,
						},
					},
				}),
			],
		})
	}
}
