#!/usr/bin/env node

/**
 * EC2 Deployment CLI Utility
 *
 * This script provides a command-line interface for deploying applications
 * to EC2 instances in the Macro AI infrastructure. It's designed to be used
 * by CI/CD pipelines and manual deployments.
 *
 * Usage:
 *   pnpm deploy-ec2 deploy --pr 123 --artifact s3://bucket/key --version 1.0.0
 *   pnpm deploy-ec2 status --pr 123
 *   pnpm deploy-ec2 cleanup --pr 123
 */

import { program } from 'commander'
import * as dotenv from 'dotenv'

import {
	type Ec2DeploymentConfig,
	Ec2DeploymentUtilities,
} from '../src/utils/ec2-deployment.js'

// Load environment variables
dotenv.config()

/**
 * Configuration from environment variables
 */
interface EnvironmentConfig {
	readonly region: string
	readonly vpcId: string
	readonly subnetIds: string[]
	readonly securityGroupId: string
	readonly launchTemplateId: string
	readonly targetGroupArn: string
	readonly parameterStorePrefix: string
	readonly artifactBucket: string
	readonly environment: string
}

/**
 * Load configuration from environment variables
 */
function loadEnvironmentConfig(): EnvironmentConfig {
	const requiredEnvVars = [
		'AWS_REGION',
		'VPC_ID',
		'SUBNET_IDS',
		'SECURITY_GROUP_ID',
		'LAUNCH_TEMPLATE_ID',
		'TARGET_GROUP_ARN',
		'PARAMETER_STORE_PREFIX',
		'ARTIFACT_BUCKET',
		'ENVIRONMENT',
	]

	const missingVars = requiredEnvVars.filter((varName) => !process.env[varName])
	if (missingVars.length > 0) {
		console.error(
			'Missing required environment variables:',
			missingVars.join(', '),
		)
		process.exit(1)
	}

	return {
		region: process.env.AWS_REGION!,
		vpcId: process.env.VPC_ID!,
		subnetIds: process.env.SUBNET_IDS!.split(',').map((id) => id.trim()),
		securityGroupId: process.env.SECURITY_GROUP_ID!,
		launchTemplateId: process.env.LAUNCH_TEMPLATE_ID!,
		targetGroupArn: process.env.TARGET_GROUP_ARN!,
		parameterStorePrefix: process.env.PARAMETER_STORE_PREFIX!,
		artifactBucket: process.env.ARTIFACT_BUCKET!,
		environment: process.env.ENVIRONMENT!,
	}
}

/**
 * Deploy command
 */
async function deployCommand(options: {
	pr: string
	artifact: string
	version: string
	branch?: string
	instances?: string
}) {
	try {
		const envConfig = loadEnvironmentConfig()
		const deployment = new Ec2DeploymentUtilities(envConfig.region)

		console.log(`🚀 Starting deployment for PR ${options.pr}`)
		console.log(`📦 Artifact: ${options.artifact}`)
		console.log(`🏷️  Version: ${options.version}`)
		console.log(`🌿 Branch: ${options.branch ?? 'unknown'}`)

		// Parse artifact URL
		const artifactMatch = /^s3:\/\/([^\/]+)\/(.+)$/.exec(options.artifact)
		if (!artifactMatch) {
			throw new Error('Invalid artifact URL. Expected format: s3://bucket/key')
		}

		const [, artifactBucket, artifactKey] = artifactMatch

		const config: Ec2DeploymentConfig = {
			prNumber: parseInt(options.pr, 10),
			branch: options.branch,
			artifactBucket,
			artifactKey,
			version: options.version,
			environment: envConfig.environment,
			parameterStorePrefix: envConfig.parameterStorePrefix,
			vpcId: envConfig.vpcId,
			subnetIds: envConfig.subnetIds,
			securityGroupId: envConfig.securityGroupId,
			launchTemplateId: envConfig.launchTemplateId,
			targetGroupArn: envConfig.targetGroupArn,
			desiredInstances: options.instances ? parseInt(options.instances, 10) : 1,
		}

		const result = await deployment.deployPrEnvironment(config)

		if (result.status === 'SUCCESS') {
			console.log('✅ Deployment completed successfully!')
			console.log(`🔗 Health check URL: ${result.healthCheckUrl}`)
			console.log(`🆔 Deployment ID: ${result.deploymentId}`)
			console.log(`📊 Instances: ${result.instanceIds.join(', ')}`)
		} else {
			console.error('❌ Deployment failed!')
			console.error(`💬 Message: ${result.message}`)
			process.exit(1)
		}
	} catch (error) {
		console.error('❌ Deployment error:', error)
		process.exit(1)
	}
}

/**
 * Status command
 */
async function statusCommand(options: { pr: string }) {
	try {
		const envConfig = loadEnvironmentConfig()
		const deployment = new Ec2DeploymentUtilities(envConfig.region)

		console.log(`📊 Checking status for PR ${options.pr}`)

		const status = await deployment.getDeploymentStatus(
			parseInt(options.pr, 10),
		)

		if (!status) {
			console.log('ℹ️  No deployment found for this PR')
			return
		}

		console.log(`🆔 Deployment ID: ${status.deploymentId}`)
		console.log(`📈 Status: ${status.status}`)
		console.log(
			`🏥 Healthy instances: ${status.healthyInstances}/${status.totalInstances}`,
		)
		console.log(`⏰ Start time: ${status.startTime.toISOString()}`)

		if (status.endTime) {
			console.log(`🏁 End time: ${status.endTime.toISOString()}`)
		}

		if (status.errorMessage) {
			console.log(`❌ Error: ${status.errorMessage}`)
		}

		console.log('\n📋 Instances:')
		status.instances.forEach((instance, index) => {
			console.log(`  ${index + 1}. ${instance.instanceId}`)
			console.log(`     State: ${instance.state}`)
			console.log(`     Private IP: ${instance.privateIpAddress}`)
			if (instance.publicIpAddress) {
				console.log(`     Public IP: ${instance.publicIpAddress}`)
			}
			console.log(`     Launch time: ${instance.launchTime.toISOString()}`)
		})
	} catch (error) {
		console.error('❌ Status check error:', error)
		process.exit(1)
	}
}

/**
 * Cleanup command
 */
async function cleanupCommand(options: { pr: string; force?: boolean }) {
	try {
		const envConfig = loadEnvironmentConfig()
		const deployment = new Ec2DeploymentUtilities(envConfig.region)

		if (!options.force) {
			console.log(`⚠️  This will terminate all instances for PR ${options.pr}`)
			console.log('Use --force to confirm this action')
			return
		}

		console.log(`🧹 Cleaning up PR ${options.pr} environment`)

		await deployment.cleanupPrEnvironment(parseInt(options.pr, 10))

		console.log('✅ Cleanup completed successfully!')
	} catch (error) {
		console.error('❌ Cleanup error:', error)
		process.exit(1)
	}
}

/**
 * List command
 */
async function listCommand() {
	try {
		loadEnvironmentConfig()

		console.log('📋 Listing all PR environments...')

		// This would require additional implementation to list all PRs
		// For now, we'll show a placeholder
		console.log('ℹ️  List functionality coming soon')
		console.log('💡 Use the status command with a specific PR number for now')
	} catch (error) {
		console.error('❌ List error:', error)
		process.exit(1)
	}
}

/**
 * Main CLI setup
 */
function main() {
	program
		.name('deploy-ec2')
		.description('EC2 deployment utility for Macro AI infrastructure')
		.version('1.0.0')

	// Deploy command
	program
		.command('deploy')
		.description('Deploy application to EC2 instances for a PR')
		.requiredOption('--pr <number>', 'PR number')
		.requiredOption('--artifact <url>', 'S3 artifact URL (s3://bucket/key)')
		.requiredOption('--version <version>', 'Deployment version')
		.option('--branch <name>', 'Git branch name')
		.option('--instances <count>', 'Number of instances to deploy', '1')
		.action(deployCommand)

	// Status command
	program
		.command('status')
		.description('Check deployment status for a PR')
		.requiredOption('--pr <number>', 'PR number')
		.action(statusCommand)

	// Cleanup command
	program
		.command('cleanup')
		.description('Clean up PR environment')
		.requiredOption('--pr <number>', 'PR number')
		.option('--force', 'Force cleanup without confirmation')
		.action(cleanupCommand)

	// List command
	program
		.command('list')
		.description('List all PR environments')
		.action(listCommand)

	// Health check command
	program
		.command('health')
		.description('Check health of deployment infrastructure')
		.action(async () => {
			try {
				const envConfig = loadEnvironmentConfig()
				console.log('🏥 Checking infrastructure health...')
				console.log(`✅ Region: ${envConfig.region}`)
				console.log(`✅ VPC: ${envConfig.vpcId}`)
				console.log(`✅ Subnets: ${envConfig.subnetIds.join(', ')}`)
				console.log(`✅ Launch Template: ${envConfig.launchTemplateId}`)
				console.log(`✅ Target Group: ${envConfig.targetGroupArn}`)
				console.log('🎉 Infrastructure configuration looks good!')
			} catch (error) {
				console.error('❌ Health check failed:', error)
				process.exit(1)
			}
		})

	program.parse()
}

// Run the CLI
if (import.meta.url === `file://${process.argv[1]}`) {
	main()
}

export { main }
