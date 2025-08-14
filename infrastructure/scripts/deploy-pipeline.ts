#!/usr/bin/env node

/**
 * CLI tool for managing blue-green deployments using the deployment pipeline
 *
 * This tool provides commands for:
 * - Triggering blue-green deployments
 * - Monitoring deployment status
 * - Performing health checks
 * - Managing rollbacks
 * - Integration with existing deployment workflows
 */

import { program } from 'commander'
import {
	DeploymentPipelineUtils,
	type DeploymentConfig,
	type DeploymentRequest,
} from '../src/utils/deployment-pipeline-utils.js'

interface EnvironmentConfig {
	region: string
	stateMachineArn: string
	targetGroupArns: string[]
	autoScalingGroupName: string
	launchTemplateId: string
}

/**
 * Load environment configuration from environment variables or config file
 */
function loadEnvironmentConfig(): EnvironmentConfig {
	const region = process.env.AWS_REGION ?? 'us-east-1'
	const stateMachineArn = process.env.DEPLOYMENT_STATE_MACHINE_ARN
	const targetGroupArns = process.env.TARGET_GROUP_ARNS?.split(',') ?? []
	const autoScalingGroupName = process.env.AUTO_SCALING_GROUP_NAME
	const launchTemplateId = process.env.LAUNCH_TEMPLATE_ID

	if (!stateMachineArn) {
		throw new Error(
			'DEPLOYMENT_STATE_MACHINE_ARN environment variable is required',
		)
	}

	if (!autoScalingGroupName) {
		throw new Error('AUTO_SCALING_GROUP_NAME environment variable is required')
	}

	if (!launchTemplateId) {
		throw new Error('LAUNCH_TEMPLATE_ID environment variable is required')
	}

	if (targetGroupArns.length === 0) {
		throw new Error('TARGET_GROUP_ARNS environment variable is required')
	}

	return {
		region,
		stateMachineArn,
		targetGroupArns,
		autoScalingGroupName,
		launchTemplateId,
	}
}

/**
 * Main CLI function
 */
async function main(): Promise<void> {
	program
		.name('deploy-pipeline')
		.description('CLI tool for managing blue-green deployments')
		.version('1.0.0')

	// Deploy command
	program
		.command('deploy')
		.description('Trigger a blue-green deployment')
		.requiredOption('--artifact <url>', 'S3 URL of the deployment artifact')
		.requiredOption('--version <version>', 'Application version to deploy')
		.option('--strategy <strategy>', 'Deployment strategy', 'BLUE_GREEN')
		.option(
			'--template-version <version>',
			'Launch template version',
			'$Latest',
		)
		.option('--wait', 'Wait for deployment to complete', false)
		.option('--timeout <minutes>', 'Deployment timeout in minutes', '30')
		.action(async (options) => {
			try {
				const envConfig = loadEnvironmentConfig()
				const utils = new DeploymentPipelineUtils(envConfig.region)

				const deploymentConfig: DeploymentConfig = {
					stateMachineArn: envConfig.stateMachineArn,
					targetGroupArns: envConfig.targetGroupArns,
					autoScalingGroupName: envConfig.autoScalingGroupName,
					region: envConfig.region,
					timeoutMinutes: parseInt(options.timeout),
					healthThresholds: {
						minHealthyPercentage: 80,
						maxErrorCount: 10,
						maxResponseTime: 2000,
					},
				}

				const deploymentRequest: DeploymentRequest = {
					artifactLocation: options.artifact,
					version: options.version,
					strategy: options.strategy,
					launchTemplate: {
						id: envConfig.launchTemplateId,
						version: options.templateVersion,
					},
				}

				console.log('🚀 Starting deployment...')
				console.log(`Version: ${options.version}`)
				console.log(`Strategy: ${options.strategy}`)
				console.log(`Artifact: ${options.artifact}`)

				const result = await utils.triggerDeployment(
					deploymentConfig,
					deploymentRequest,
				)

				console.log(`✅ Deployment started successfully!`)
				console.log(`Execution ARN: ${result.executionArn}`)
				console.log(`Deployment ID: ${result.deploymentId}`)

				if (options.wait) {
					console.log('\n⏳ Waiting for deployment to complete...')

					const finalStatus = await utils.waitForDeployment(
						result.executionArn,
						{
							maxWaitTimeMinutes: parseInt(options.timeout),
							onStatusUpdate: (status) => {
								console.log(
									`Status: ${status.status} (${new Date().toISOString()})`,
								)
							},
						},
					)

					if (finalStatus.status === 'SUCCEEDED') {
						console.log('\n🎉 Deployment completed successfully!')
					} else {
						console.error(
							`\n❌ Deployment failed with status: ${finalStatus.status}`,
						)
						if (finalStatus.error) {
							console.error(`Error: ${finalStatus.error}`)
						}
						process.exit(1)
					}
				}
			} catch (error) {
				console.error('❌ Deployment failed:', error)
				process.exit(1)
			}
		})

	// Status command
	program
		.command('status')
		.description('Check deployment status')
		.requiredOption('--execution-arn <arn>', 'Step Functions execution ARN')
		.option('--detailed', 'Show detailed status information', false)
		.action(async (options) => {
			try {
				const envConfig = loadEnvironmentConfig()
				const utils = new DeploymentPipelineUtils(envConfig.region)

				const status = await utils.getDeploymentStatus(options.executionArn)

				console.log(`Status: ${status.status}`)
				console.log(`Start Time: ${status.startDate.toISOString()}`)

				if (status.stopDate) {
					console.log(`Stop Time: ${status.stopDate.toISOString()}`)
					const duration = Math.round(
						(status.stopDate.getTime() - status.startDate.getTime()) / 1000,
					)
					console.log(`Duration: ${duration} seconds`)
				}

				if (options.detailed) {
					console.log('\nDetailed Information:')
					console.log('Input:', JSON.stringify(status.input, null, 2))

					if (status.output) {
						console.log('Output:', JSON.stringify(status.output, null, 2))
					}

					if (status.error) {
						console.log('Error:', status.error)
					}
				}
			} catch (error) {
				console.error('❌ Failed to get status:', error)
				process.exit(1)
			}
		})

	// Health check command
	program
		.command('health')
		.description('Perform health check on target groups')
		.option('--min-healthy <percentage>', 'Minimum healthy percentage', '80')
		.option('--max-errors <count>', 'Maximum error count', '10')
		.option('--max-response-time <ms>', 'Maximum response time in ms', '2000')
		.action(async (options) => {
			try {
				const envConfig = loadEnvironmentConfig()
				const utils = new DeploymentPipelineUtils(envConfig.region)

				console.log('🏥 Performing health check...')

				const healthCheck = await utils.performHealthCheck(
					envConfig.targetGroupArns,
					{
						minHealthyPercentage: parseInt(options.minHealthy),
						maxErrorCount: parseInt(options.maxErrors),
						maxResponseTime: parseInt(options.maxResponseTime),
					},
				)

				console.log(
					`\nOverall Health: ${healthCheck.isHealthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}`,
				)
				console.log(`Check Time: ${healthCheck.timestamp.toISOString()}`)

				console.log('\nTarget Group Details:')
				healthCheck.targetGroups.forEach((tg) => {
					console.log(`\n📊 ${tg.arn}`)
					console.log(
						`   Healthy Targets: ${tg.healthyTargets}/${tg.totalTargets} (${tg.healthyPercentage.toFixed(1)}%)`,
					)
					console.log(`   Error Count: ${tg.errorCount}`)
					console.log(
						`   Avg Response Time: ${tg.avgResponseTime.toFixed(0)}ms`,
					)
				})

				if (!healthCheck.isHealthy) {
					process.exit(1)
				}
			} catch (error) {
				console.error('❌ Health check failed:', error)
				process.exit(1)
			}
		})

	// List deployments command
	program
		.command('list')
		.description('List recent deployments')
		.option('--limit <count>', 'Number of deployments to show', '10')
		.action(async (options) => {
			console.log('📋 Recent deployments:')
			console.log('(This feature requires additional AWS API integration)')
			console.log(`Showing last ${options.limit} deployments...`)
			// TODO: Implement deployment history listing
		})

	// Rollback command
	program
		.command('rollback')
		.description('Trigger rollback to previous version')
		.requiredOption(
			'--execution-arn <arn>',
			'Execution ARN of deployment to rollback',
		)
		.option('--wait', 'Wait for rollback to complete', false)
		.action(async (options) => {
			console.log('🔄 Triggering rollback...')
			console.log(`Execution ARN: ${options.executionArn}`)
			console.log('(This feature requires additional implementation)')
			// TODO: Implement rollback functionality
		})

	// Environment info command
	program
		.command('info')
		.description('Show environment configuration')
		.action(async () => {
			try {
				const envConfig = loadEnvironmentConfig()

				console.log('🔧 Environment Configuration:')
				console.log(`Region: ${envConfig.region}`)
				console.log(`State Machine ARN: ${envConfig.stateMachineArn}`)
				console.log(`Auto Scaling Group: ${envConfig.autoScalingGroupName}`)
				console.log(`Launch Template ID: ${envConfig.launchTemplateId}`)
				console.log(`Target Groups: ${envConfig.targetGroupArns.length}`)
				envConfig.targetGroupArns.forEach((arn, index) => {
					console.log(`  ${index + 1}. ${arn}`)
				})
			} catch (error) {
				console.error('❌ Failed to load configuration:', error)
				process.exit(1)
			}
		})

	program.parse()
}

// Run the CLI
if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((error) => {
		console.error('Unexpected error:', error)
		process.exit(1)
	})
}

export { main }
