#!/usr/bin/env node

/**
 * Enhanced Deployment Status CLI Tool
 *
 * Provides comprehensive deployment status tracking and reporting capabilities:
 * - Real-time deployment status monitoring
 * - Deployment history queries
 * - Active deployment tracking
 * - Deployment metrics and analytics
 * - Enhanced error reporting and diagnostics
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import {
	CloudWatchClient,
	GetMetricStatisticsCommand,
} from '@aws-sdk/client-cloudwatch'
import { program } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import Table from 'cli-table3'

interface DeploymentStatusConfig {
	region: string
	environment: string
	applicationName: string
	statusQueryFunctionName: string
}

interface DeploymentEvent {
	deploymentId: string
	timestamp: string
	status: string
	stage: string
	environment: string
	version: string
	triggeredBy: string
	metadata?: Record<string, string>
	metrics?: {
		duration?: number
		healthScore?: number
		errorCount?: number
		instanceCount?: number
		successRate?: number
	}
	error?: {
		message: string
		code: string
	}
}

interface DeploymentSummary {
	deploymentId: string
	environment: string
	version: string
	status: string
	startTime: string
	endTime?: string
	duration?: number
	triggeredBy: string
	successRate: number
	healthScore: number
	stageHistory: Array<{
		stage: string
		events: Array<{
			status: string
			timestamp: string
			duration?: number
		}>
	}>
}

class DeploymentStatusCLI {
	private lambda: LambdaClient
	private cloudwatch: CloudWatchClient
	private config: DeploymentStatusConfig

	constructor(config: DeploymentStatusConfig) {
		this.config = config
		this.lambda = new LambdaClient({ region: config.region })
		this.cloudwatch = new CloudWatchClient({ region: config.region })
	}

	/**
	 * Get deployment status
	 */
	async getDeploymentStatus(deploymentId: string): Promise<void> {
		const spinner = ora('Fetching deployment status...').start()

		try {
			const result = await this.invokeLambda('getStatus', { deploymentId })

			if (result.statusCode === 404) {
				spinner.fail(chalk.red(`Deployment ${deploymentId} not found`))
				return
			}

			if (result.statusCode !== 200) {
				spinner.fail(
					chalk.red(
						`Failed to get deployment status: ${result.body.error || 'Unknown error'}`,
					),
				)
				return
			}

			spinner.succeed(chalk.green('Deployment status retrieved'))

			const deployment = result.body as DeploymentSummary
			this.displayDeploymentStatus(deployment)
		} catch (error) {
			spinner.fail(
				chalk.red(
					`Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
				),
			)
		}
	}

	/**
	 * Get deployment history
	 */
	async getDeploymentHistory(limit: number = 20): Promise<void> {
		const spinner = ora('Fetching deployment history...').start()

		try {
			const result = await this.invokeLambda('getHistory', {
				environment: this.config.environment,
				limit,
			})

			if (result.statusCode !== 200) {
				spinner.fail(
					chalk.red(
						`Failed to get deployment history: ${result.body.error || 'Unknown error'}`,
					),
				)
				return
			}

			spinner.succeed(chalk.green('Deployment history retrieved'))

			const history = result.body
			this.displayDeploymentHistory(history.deployments, history.environment)
		} catch (error) {
			spinner.fail(
				chalk.red(
					`Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
				),
			)
		}
	}

	/**
	 * Get active deployments
	 */
	async getActiveDeployments(): Promise<void> {
		const spinner = ora('Fetching active deployments...').start()

		try {
			const result = await this.invokeLambda('getActiveDeployments', {
				environment: this.config.environment,
			})

			if (result.statusCode !== 200) {
				spinner.fail(
					chalk.red(
						`Failed to get active deployments: ${result.body.error || 'Unknown error'}`,
					),
				)
				return
			}

			spinner.succeed(chalk.green('Active deployments retrieved'))

			const activeDeployments = result.body
			this.displayActiveDeployments(
				activeDeployments.activeDeployments,
				activeDeployments.environment,
			)
		} catch (error) {
			spinner.fail(
				chalk.red(
					`Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
				),
			)
		}
	}

	/**
	 * Watch deployment status in real-time
	 */
	async watchDeployment(
		deploymentId: string,
		interval: number = 30,
	): Promise<void> {
		console.log(
			chalk.blue(
				`Watching deployment ${deploymentId} (refresh every ${interval}s)`,
			),
		)
		console.log(chalk.gray('Press Ctrl+C to stop watching\n'))

		const watch = async () => {
			try {
				const result = await this.invokeLambda('getStatus', { deploymentId })

				if (result.statusCode === 200) {
					const deployment = result.body as DeploymentSummary

					// Clear screen and show updated status
					console.clear()
					console.log(
						chalk.blue(
							`Watching deployment ${deploymentId} (refresh every ${interval}s)`,
						),
					)
					console.log(chalk.gray('Press Ctrl+C to stop watching\n'))

					this.displayDeploymentStatus(deployment)

					// Stop watching if deployment is complete
					if (
						['COMPLETED', 'FAILED', 'ROLLED_BACK', 'CANCELLED'].includes(
							deployment.status,
						)
					) {
						console.log(chalk.yellow('\nDeployment finished. Stopping watch.'))
						return
					}
				} else {
					console.log(
						chalk.red(
							`Failed to get deployment status: ${result.body.error || 'Unknown error'}`,
						),
					)
				}
			} catch (error) {
				console.log(
					chalk.red(
						`Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
					),
				)
			}

			// Schedule next update
			setTimeout(watch, interval * 1000)
		}

		await watch()
	}

	/**
	 * Get deployment metrics
	 */
	async getDeploymentMetrics(hours: number = 24): Promise<void> {
		const spinner = ora('Fetching deployment metrics...').start()

		try {
			const endTime = new Date()
			const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000)

			// Get deployment success rate
			const successRateMetrics = await this.cloudwatch.send(
				new GetMetricStatisticsCommand({
					Namespace: 'MacroAI/Deployment',
					MetricName: 'DeploymentEvent',
					Dimensions: [
						{ Name: 'Environment', Value: this.config.environment },
						{ Name: 'Application', Value: this.config.applicationName },
					],
					StartTime: startTime,
					EndTime: endTime,
					Period: 3600, // 1 hour
					Statistics: ['Sum'],
				}),
			)

			// Get deployment duration metrics
			const durationMetrics = await this.cloudwatch.send(
				new GetMetricStatisticsCommand({
					Namespace: 'MacroAI/Deployment',
					MetricName: 'DeploymentDuration',
					Dimensions: [
						{ Name: 'Environment', Value: this.config.environment },
						{ Name: 'Application', Value: this.config.applicationName },
					],
					StartTime: startTime,
					EndTime: endTime,
					Period: 3600, // 1 hour
					Statistics: ['Average', 'Maximum'],
				}),
			)

			spinner.succeed(chalk.green('Deployment metrics retrieved'))

			this.displayDeploymentMetrics({
				successRate: successRateMetrics.Datapoints || [],
				duration: durationMetrics.Datapoints || [],
				timeRange: hours,
			})
		} catch (error) {
			spinner.fail(
				chalk.red(
					`Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
				),
			)
		}
	}

	/**
	 * Invoke Lambda function
	 */
	private async invokeLambda(operation: string, payload: any): Promise<any> {
		const command = new InvokeCommand({
			FunctionName: this.config.statusQueryFunctionName,
			Payload: JSON.stringify({ operation, ...payload }),
		})

		const response = await this.lambda.send(command)
		const result = JSON.parse(new TextDecoder().decode(response.Payload))

		if (response.FunctionError) {
			throw new Error(
				`Lambda function error: ${result.errorMessage || 'Unknown error'}`,
			)
		}

		return result
	}

	/**
	 * Display deployment status
	 */
	private displayDeploymentStatus(deployment: DeploymentSummary): void {
		console.log(chalk.bold.blue('\n📊 Deployment Status\n'))

		// Basic info table
		const infoTable = new Table({
			head: ['Property', 'Value'],
			colWidths: [20, 50],
		})

		infoTable.push(
			['Deployment ID', deployment.deploymentId],
			['Environment', deployment.environment],
			['Version', deployment.version],
			['Status', this.colorizeStatus(deployment.status)],
			['Triggered By', deployment.triggeredBy],
			['Start Time', new Date(deployment.startTime).toLocaleString()],
			[
				'Duration',
				deployment.duration
					? `${Math.round(deployment.duration / 60)} minutes`
					: 'N/A',
			],
			['Success Rate', `${deployment.successRate}%`],
			['Health Score', `${deployment.healthScore}%`],
		)

		console.log(infoTable.toString())

		// Stage history
		if (deployment.stageHistory && deployment.stageHistory.length > 0) {
			console.log(chalk.bold.blue('\n📋 Stage History\n'))

			const stageTable = new Table({
				head: ['Stage', 'Status', 'Timestamp', 'Duration'],
				colWidths: [20, 15, 25, 15],
			})

			deployment.stageHistory.forEach((stage) => {
				const latestEvent = stage.events[0]
				if (latestEvent) {
					stageTable.push([
						stage.stage,
						this.colorizeStatus(latestEvent.status),
						new Date(latestEvent.timestamp).toLocaleString(),
						latestEvent.duration
							? `${Math.round(latestEvent.duration / 60)}m`
							: 'N/A',
					])
				}
			})

			console.log(stageTable.toString())
		}
	}

	/**
	 * Display deployment history
	 */
	private displayDeploymentHistory(
		deployments: any[],
		environment: string,
	): void {
		console.log(chalk.bold.blue(`\n📚 Deployment History (${environment})\n`))

		if (deployments.length === 0) {
			console.log(chalk.yellow('No deployments found'))
			return
		}

		const historyTable = new Table({
			head: [
				'Deployment ID',
				'Version',
				'Status',
				'Timestamp',
				'Duration',
				'Health Score',
			],
			colWidths: [25, 15, 15, 20, 12, 12],
		})

		deployments.forEach((deployment) => {
			historyTable.push([
				deployment.deploymentId.substring(0, 20) + '...',
				deployment.version,
				this.colorizeStatus(deployment.status),
				new Date(deployment.timestamp).toLocaleDateString(),
				deployment.duration
					? `${Math.round(deployment.duration / 60)}m`
					: 'N/A',
				deployment.healthScore ? `${deployment.healthScore}%` : 'N/A',
			])
		})

		console.log(historyTable.toString())
	}

	/**
	 * Display active deployments
	 */
	private displayActiveDeployments(
		deployments: any[],
		environment: string,
	): void {
		console.log(chalk.bold.blue(`\n🚀 Active Deployments (${environment})\n`))

		if (deployments.length === 0) {
			console.log(chalk.green('No active deployments'))
			return
		}

		const activeTable = new Table({
			head: ['Deployment ID', 'Version', 'Stage', 'Started', 'Duration'],
			colWidths: [25, 15, 20, 20, 12],
		})

		deployments.forEach((deployment) => {
			const startTime = new Date(deployment.timestamp)
			const duration = Math.round(
				(Date.now() - startTime.getTime()) / 1000 / 60,
			)

			activeTable.push([
				deployment.deploymentId.substring(0, 20) + '...',
				deployment.version,
				deployment.stage,
				startTime.toLocaleString(),
				`${duration}m`,
			])
		})

		console.log(activeTable.toString())
	}

	/**
	 * Display deployment metrics
	 */
	private displayDeploymentMetrics(metrics: any): void {
		console.log(
			chalk.bold.blue(
				`\n📈 Deployment Metrics (Last ${metrics.timeRange} hours)\n`,
			),
		)

		// Calculate summary statistics
		const totalDeployments = metrics.successRate.reduce(
			(sum: number, dp: any) => sum + (dp.Sum || 0),
			0,
		)
		const avgDuration =
			metrics.duration.length > 0
				? metrics.duration.reduce(
						(sum: number, dp: any) => sum + (dp.Average || 0),
						0,
					) / metrics.duration.length
				: 0
		const maxDuration =
			metrics.duration.length > 0
				? Math.max(...metrics.duration.map((dp: any) => dp.Maximum || 0))
				: 0

		const metricsTable = new Table({
			head: ['Metric', 'Value'],
			colWidths: [25, 20],
		})

		metricsTable.push(
			['Total Deployments', totalDeployments.toString()],
			[
				'Average Duration',
				avgDuration > 0 ? `${Math.round(avgDuration / 60)} minutes` : 'N/A',
			],
			[
				'Max Duration',
				maxDuration > 0 ? `${Math.round(maxDuration / 60)} minutes` : 'N/A',
			],
			[
				'Deployments/Hour',
				totalDeployments > 0
					? (totalDeployments / metrics.timeRange).toFixed(2)
					: '0',
			],
		)

		console.log(metricsTable.toString())
	}

	/**
	 * Colorize status text
	 */
	private colorizeStatus(status: string): string {
		switch (status) {
			case 'COMPLETED':
				return chalk.green(status)
			case 'FAILED':
				return chalk.red(status)
			case 'IN_PROGRESS':
				return chalk.yellow(status)
			case 'VALIDATING':
				return chalk.blue(status)
			case 'ROLLED_BACK':
				return chalk.magenta(status)
			case 'CANCELLED':
				return chalk.gray(status)
			default:
				return status
		}
	}
}

// CLI Program Configuration
program
	.name('deployment-status')
	.description('Enhanced deployment status tracking and monitoring CLI')
	.version('1.0.0')

program
	.command('status')
	.description('Get deployment status')
	.argument('<deployment-id>', 'Deployment ID to check')
	.option('-r, --region <region>', 'AWS region', 'us-east-1')
	.option('-e, --environment <env>', 'Environment name', 'development')
	.option('-a, --application <app>', 'Application name', 'macro-ai')
	.action(async (deploymentId, options) => {
		const config: DeploymentStatusConfig = {
			region: options.region,
			environment: options.environment,
			applicationName: options.application,
			statusQueryFunctionName: `${options.application}-${options.environment}-deployment-status-query`,
		}

		const cli = new DeploymentStatusCLI(config)
		await cli.getDeploymentStatus(deploymentId)
	})

program
	.command('history')
	.description('Get deployment history')
	.option('-r, --region <region>', 'AWS region', 'us-east-1')
	.option('-e, --environment <env>', 'Environment name', 'development')
	.option('-a, --application <app>', 'Application name', 'macro-ai')
	.option('-l, --limit <limit>', 'Number of deployments to show', '20')
	.action(async (options) => {
		const config: DeploymentStatusConfig = {
			region: options.region,
			environment: options.environment,
			applicationName: options.application,
			statusQueryFunctionName: `${options.application}-${options.environment}-deployment-status-query`,
		}

		const cli = new DeploymentStatusCLI(config)
		await cli.getDeploymentHistory(parseInt(options.limit))
	})

program
	.command('active')
	.description('Get active deployments')
	.option('-r, --region <region>', 'AWS region', 'us-east-1')
	.option('-e, --environment <env>', 'Environment name', 'development')
	.option('-a, --application <app>', 'Application name', 'macro-ai')
	.action(async (options) => {
		const config: DeploymentStatusConfig = {
			region: options.region,
			environment: options.environment,
			applicationName: options.application,
			statusQueryFunctionName: `${options.application}-${options.environment}-deployment-status-query`,
		}

		const cli = new DeploymentStatusCLI(config)
		await cli.getActiveDeployments()
	})

program
	.command('watch')
	.description('Watch deployment status in real-time')
	.argument('<deployment-id>', 'Deployment ID to watch')
	.option('-r, --region <region>', 'AWS region', 'us-east-1')
	.option('-e, --environment <env>', 'Environment name', 'development')
	.option('-a, --application <app>', 'Application name', 'macro-ai')
	.option('-i, --interval <seconds>', 'Refresh interval in seconds', '30')
	.action(async (deploymentId, options) => {
		const config: DeploymentStatusConfig = {
			region: options.region,
			environment: options.environment,
			applicationName: options.application,
			statusQueryFunctionName: `${options.application}-${options.environment}-deployment-status-query`,
		}

		const cli = new DeploymentStatusCLI(config)
		await cli.watchDeployment(deploymentId, parseInt(options.interval))
	})

program
	.command('metrics')
	.description('Get deployment metrics')
	.option('-r, --region <region>', 'AWS region', 'us-east-1')
	.option('-e, --environment <env>', 'Environment name', 'development')
	.option('-a, --application <app>', 'Application name', 'macro-ai')
	.option('-h, --hours <hours>', 'Time range in hours', '24')
	.action(async (options) => {
		const config: DeploymentStatusConfig = {
			region: options.region,
			environment: options.environment,
			applicationName: options.application,
			statusQueryFunctionName: `${options.application}-${options.environment}-deployment-status-query`,
		}

		const cli = new DeploymentStatusCLI(config)
		await cli.getDeploymentMetrics(parseInt(options.hours))
	})

// Parse command line arguments
program.parse()

export { DeploymentStatusCLI, DeploymentStatusConfig }
