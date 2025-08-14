/**
 * Deployment pipeline utilities for managing blue-green deployments
 *
 * This module provides helper functions for:
 * - Triggering deployments via Step Functions
 * - Monitoring deployment status
 * - Managing rollbacks
 * - Health check validation
 * - Integration with existing EC2 deployment utilities
 */

import {
	CloudWatchClient,
	GetMetricStatisticsCommand,
	type GetMetricStatisticsCommandInput,
} from '@aws-sdk/client-cloudwatch'
import {
	ELBv2Client,
	DescribeTargetHealthCommand,
	type DescribeTargetHealthCommandInput,
} from '@aws-sdk/client-elastic-load-balancing-v2'
import {
	SFNClient,
	StartExecutionCommand,
	DescribeExecutionCommand,
	type StartExecutionCommandInput,
	type DescribeExecutionCommandInput,
} from '@aws-sdk/client-sfn'

export interface DeploymentConfig {
	/**
	 * Step Functions state machine ARN
	 */
	stateMachineArn: string

	/**
	 * Target group ARNs for health validation
	 */
	targetGroupArns: string[]

	/**
	 * Auto Scaling Group name
	 */
	autoScalingGroupName: string

	/**
	 * AWS region
	 */
	region: string

	/**
	 * Deployment timeout in minutes
	 */
	timeoutMinutes?: number

	/**
	 * Health check thresholds
	 */
	healthThresholds?: {
		minHealthyPercentage: number
		maxErrorCount: number
		maxResponseTime: number
	}
}

export interface DeploymentRequest {
	/**
	 * Artifact location (S3 URL)
	 */
	artifactLocation: string

	/**
	 * Application version
	 */
	version: string

	/**
	 * Deployment strategy
	 */
	strategy: 'BLUE_GREEN' | 'ROLLING_UPDATE' | 'CANARY'

	/**
	 * Launch template configuration
	 */
	launchTemplate: {
		id: string
		version: string
	}

	/**
	 * Previous launch template for rollback
	 */
	previousLaunchTemplate?: {
		id: string
		version: string
	}
}

export interface DeploymentStatus {
	/**
	 * Execution ARN
	 */
	executionArn: string

	/**
	 * Current status
	 */
	status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'ABORTED'

	/**
	 * Start time
	 */
	startDate: Date

	/**
	 * Stop time (if completed)
	 */
	stopDate?: Date

	/**
	 * Execution input
	 */
	input: any

	/**
	 * Execution output (if completed)
	 */
	output?: any

	/**
	 * Error details (if failed)
	 */
	error?: string
}

export interface HealthCheckResult {
	/**
	 * Overall health status
	 */
	isHealthy: boolean

	/**
	 * Individual target group results
	 */
	targetGroups: Array<{
		arn: string
		healthyTargets: number
		totalTargets: number
		healthyPercentage: number
		errorCount: number
		avgResponseTime: number
	}>

	/**
	 * Check timestamp
	 */
	timestamp: Date
}

/**
 * Deployment pipeline utilities class
 */
export class DeploymentPipelineUtils {
	private readonly sfnClient: SFNClient
	private readonly cloudwatchClient: CloudWatchClient
	private readonly elbv2Client: ELBv2Client

	constructor(region: string) {
		this.sfnClient = new SFNClient({ region })
		this.cloudwatchClient = new CloudWatchClient({ region })
		this.elbv2Client = new ELBv2Client({ region })
	}

	/**
	 * Trigger a blue-green deployment
	 */
	async triggerDeployment(
		config: DeploymentConfig,
		request: DeploymentRequest,
	): Promise<{ executionArn: string; deploymentId: string }> {
		const deploymentId = `deployment-${Date.now()}`

		const input = {
			deploymentId,
			strategy: request.strategy,
			artifactLocation: request.artifactLocation,
			version: request.version,
			timestamp: new Date().toISOString(),
			targetGroupArns: config.targetGroupArns,
			autoScalingGroupName: config.autoScalingGroupName,
			newLaunchTemplateId: request.launchTemplate.id,
			newLaunchTemplateVersion: request.launchTemplate.version,
			previousLaunchTemplateId: request.previousLaunchTemplate?.id,
			previousLaunchTemplateVersion: request.previousLaunchTemplate?.version,
			config: {
				healthThresholds: config.healthThresholds ?? {
					minHealthyPercentage: 80,
					maxErrorCount: 10,
					maxResponseTime: 2000,
				},
				enableAutoRollback: true,
				timeoutMinutes: config.timeoutMinutes ?? 15,
			},
		}

		const params: StartExecutionCommandInput = {
			stateMachineArn: config.stateMachineArn,
			name: deploymentId,
			input: JSON.stringify(input),
		}

		const result = await this.sfnClient.send(new StartExecutionCommand(params))

		return {
			executionArn: result.executionArn!,
			deploymentId,
		}
	}

	/**
	 * Get deployment status
	 */
	async getDeploymentStatus(executionArn: string): Promise<DeploymentStatus> {
		const params: DescribeExecutionCommandInput = {
			executionArn,
		}

		const result = await this.sfnClient.send(
			new DescribeExecutionCommand(params),
		)

		return {
			executionArn,
			status: result.status as DeploymentStatus['status'],
			startDate: result.startDate!,
			stopDate: result.stopDate,
			input: JSON.parse(result.input!),
			output: result.output ? JSON.parse(result.output) : undefined,
			error: result.error,
		}
	}

	/**
	 * Wait for deployment completion
	 */
	async waitForDeployment(
		executionArn: string,
		options: {
			maxWaitTimeMinutes?: number
			checkIntervalSeconds?: number
			onStatusUpdate?: (status: DeploymentStatus) => void
		} = {},
	): Promise<DeploymentStatus> {
		const maxWaitTime = (options.maxWaitTimeMinutes ?? 30) * 60 * 1000
		const checkInterval = (options.checkIntervalSeconds ?? 30) * 1000
		const startTime = Date.now()

		while (Date.now() - startTime < maxWaitTime) {
			const status = await this.getDeploymentStatus(executionArn)

			if (options.onStatusUpdate) {
				options.onStatusUpdate(status)
			}

			if (
				['SUCCEEDED', 'FAILED', 'TIMED_OUT', 'ABORTED'].includes(status.status)
			) {
				return status
			}

			await new Promise((resolve) => setTimeout(resolve, checkInterval))
		}

		throw new Error(
			`Deployment timed out after ${options.maxWaitTimeMinutes} minutes`,
		)
	}

	/**
	 * Perform comprehensive health check
	 */
	async performHealthCheck(
		targetGroupArns: string[],
		thresholds: {
			minHealthyPercentage: number
			maxErrorCount: number
			maxResponseTime: number
		},
	): Promise<HealthCheckResult> {
		const results = []

		for (const targetGroupArn of targetGroupArns) {
			// Check target health
			const healthParams: DescribeTargetHealthCommandInput = {
				TargetGroupArn: targetGroupArn,
			}

			const healthResult = await this.elbv2Client.send(
				new DescribeTargetHealthCommand(healthParams),
			)

			const healthyTargets =
				healthResult.TargetHealthDescriptions?.filter(
					(target) => target.TargetHealth?.State === 'healthy',
				) ?? []

			const totalTargets = healthResult.TargetHealthDescriptions?.length ?? 0
			const healthyPercentage =
				totalTargets > 0 ? (healthyTargets.length / totalTargets) * 100 : 0

			// Check error rate from CloudWatch
			const endTime = new Date()
			const startTime = new Date(endTime.getTime() - 5 * 60 * 1000) // 5 minutes ago

			const errorParams: GetMetricStatisticsCommandInput = {
				Namespace: 'AWS/ApplicationELB',
				MetricName: 'HTTPCode_Target_5XX_Count',
				Dimensions: [
					{
						Name: 'TargetGroup',
						Value: targetGroupArn.split('/').slice(-2).join('/'),
					},
				],
				StartTime: startTime,
				EndTime: endTime,
				Period: 300,
				Statistics: ['Sum'],
			}

			const errorResult = await this.cloudwatchClient.send(
				new GetMetricStatisticsCommand(errorParams),
			)

			const errorCount =
				errorResult.Datapoints?.reduce((sum, dp) => sum + (dp.Sum ?? 0), 0) ?? 0

			// Check response time
			const responseTimeParams: GetMetricStatisticsCommandInput = {
				Namespace: 'AWS/ApplicationELB',
				MetricName: 'TargetResponseTime',
				Dimensions: [
					{
						Name: 'TargetGroup',
						Value: targetGroupArn.split('/').slice(-2).join('/'),
					},
				],
				StartTime: startTime,
				EndTime: endTime,
				Period: 300,
				Statistics: ['Average'],
			}

			const responseTimeResult = await this.cloudwatchClient.send(
				new GetMetricStatisticsCommand(responseTimeParams),
			)

			const avgResponseTime =
				responseTimeResult.Datapoints?.reduce(
					(sum, dp) => sum + (dp.Average ?? 0),
					0,
				) / (responseTimeResult.Datapoints?.length ?? 1) ?? 0

			results.push({
				arn: targetGroupArn,
				healthyTargets: healthyTargets.length,
				totalTargets,
				healthyPercentage,
				errorCount,
				avgResponseTime: avgResponseTime * 1000, // Convert to milliseconds
			})
		}

		const isHealthy = results.every(
			(result) =>
				result.healthyPercentage >= thresholds.minHealthyPercentage &&
				result.errorCount <= thresholds.maxErrorCount &&
				result.avgResponseTime <= thresholds.maxResponseTime,
		)

		return {
			isHealthy,
			targetGroups: results,
			timestamp: new Date(),
		}
	}

	/**
	 * Generate deployment summary report
	 */
	generateDeploymentSummary(
		status: DeploymentStatus,
		healthCheck?: HealthCheckResult,
	): string {
		const duration = status.stopDate
			? Math.round(
					(status.stopDate.getTime() - status.startDate.getTime()) / 1000,
				)
			: 'In Progress'

		let summary = `
Deployment Summary:
==================

Execution ARN: ${status.executionArn}
Status: ${status.status}
Start Time: ${status.startDate.toISOString()}
${status.stopDate ? `Stop Time: ${status.stopDate.toISOString()}` : ''}
Duration: ${duration}${typeof duration === 'number' ? ' seconds' : ''}

Deployment Configuration:
- Version: ${status.input.version}
- Strategy: ${status.input.strategy}
- Artifact: ${status.input.artifactLocation}
`

		if (healthCheck) {
			summary += `
Health Check Results:
- Overall Status: ${healthCheck.isHealthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}
- Check Time: ${healthCheck.timestamp.toISOString()}

Target Group Details:
${healthCheck.targetGroups
	.map(
		(tg) => `
- ARN: ${tg.arn}
  Healthy Targets: ${tg.healthyTargets}/${tg.totalTargets} (${tg.healthyPercentage.toFixed(1)}%)
  Error Count: ${tg.errorCount}
  Avg Response Time: ${tg.avgResponseTime.toFixed(0)}ms`,
	)
	.join('')}
`
		}

		if (status.error) {
			summary += `
Error Details:
${status.error}
`
		}

		return summary
	}
}
