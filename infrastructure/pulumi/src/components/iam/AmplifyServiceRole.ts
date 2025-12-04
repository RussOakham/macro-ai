import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'

import type { DeploymentType } from '../../utils/environment'
import { getStackTags } from '../../utils/environment'

export interface AmplifyServiceRoleArgs {
	environmentName: string
	deploymentType: DeploymentType
	tags?: Record<string, string>
}

/**
 * IAM Service Role for AWS Amplify
 *
 * This role allows Amplify to:
 * - Write build logs to CloudWatch Logs
 * - Access other AWS services during build (if needed)
 */
export class AmplifyServiceRole extends pulumi.ComponentResource {
	public readonly role: aws.iam.Role
	public readonly roleArn: pulumi.Output<string>

	constructor(
		name: string,
		args: AmplifyServiceRoleArgs,
		opts?: pulumi.ComponentResourceOptions,
	) {
		super('macro-ai:iam:AmplifyServiceRole', name, {}, opts)

		const tags = getStackTags(
			args.environmentName,
			args.deploymentType,
			args.tags,
		)

		// Trust policy allowing Amplify service to assume this role
		const trustPolicy = {
			Version: '2012-10-17',
			Statement: [
				{
					Effect: 'Allow',
					Principal: {
						Service: 'amplify.amazonaws.com',
					},
					Action: 'sts:AssumeRole',
				},
			],
		}

		// Create IAM role for Amplify service
		this.role = new aws.iam.Role(
			`${name}-role`,
			{
				name: `amplify-${args.environmentName}-service-role`,
				description: `Service role for AWS Amplify ${args.environmentName} environment`,
				assumeRolePolicy: JSON.stringify(trustPolicy),
				tags,
			},
			{ parent: this },
		)

		// Attach policy for CloudWatch Logs (build logs)
		new aws.iam.RolePolicyAttachment(
			`${name}-cloudwatch-policy`,
			{
				role: this.role.name,
				policyArn: 'arn:aws:iam::aws:policy/CloudWatchLogsFullAccess',
			},
			{ parent: this },
		)

		// Optional: Attach policy for accessing other AWS services during build
		// This allows Amplify to access Parameter Store, Secrets Manager, etc.
		new aws.iam.RolePolicyAttachment(
			`${name}-amplify-backend-policy`,
			{
				role: this.role.name,
				policyArn:
					'arn:aws:iam::aws:policy/service-role/AmplifyBackendDeployFullAccess',
			},
			{ parent: this },
		)

		this.roleArn = this.role.arn

		this.registerOutputs({
			roleArn: this.roleArn,
		})
	}
}
