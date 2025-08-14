#!/usr/bin/env node

import { Command } from 'commander'
import {
	CloudWatchClient,
	GetMetricStatisticsCommand,
	DescribeAlarmsCommand,
} from '@aws-sdk/client-cloudwatch'
import {
	DynamoDBClient,
	QueryCommand,
	ScanCommand,
	GetItemCommand,
} from '@aws-sdk/client-dynamodb'
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import {
	AutoScalingClient,
	DescribeAutoScalingGroupsCommand,
} from '@aws-sdk/client-auto-scaling'
import chalk from 'chalk'
import Table from 'cli-table3'

/**
 * Performance Optimization CLI Tool
 *
 * Provides command-line interface for monitoring performance metrics,
 * analyzing optimization opportunities, and managing performance configurations.
 */

const program = new Command()
const cloudwatch = new CloudWatchClient()
const dynamodb = new DynamoDBClient()
const lambda = new LambdaClient()
const autoscaling = new AutoScalingClient()

// Configuration
const DEFAULT_ENVIRONMENT = 'production'
const DEFAULT_APPLICATION = 'macro-ai'

program
	.name('performance-optimization')
	.description('CLI tool for performance optimization and analysis')
	.version('1.0.0')

/**
 * Performance metrics command
 */
program
	.command('metrics')
	.description('View performance metrics and statistics')
	.option('-e, --environment <env>', 'Environment name', DEFAULT_ENVIRONMENT)
	.option('-a, --application <app>', 'Application name', DEFAULT_APPLICATION)
	.option('--period <hours>', 'Time period in hours', '24')
	.action(async (options) => {
		try {
			console.log(chalk.blue('📊 Fetching performance metrics...'))
			const metrics = await getPerformanceMetrics(options)
			displayPerformanceMetrics(metrics)
		} catch (error) {
			console.error(
				chalk.red('❌ Failed to fetch performance metrics:'),
				error.message,
			)
			process.exit(1)
		}
	})

/**
 * Optimization recommendations command
 */
program
	.command('recommendations')
	.description('View optimization recommendations')
	.option('-e, --environment <env>', 'Environment name', DEFAULT_ENVIRONMENT)
	.option('-a, --application <app>', 'Application name', DEFAULT_APPLICATION)
	.option('-t, --type <type>', 'Filter by recommendation type')
	.option('-p, --priority <priority>', 'Filter by priority level')
	.option('-l, --limit <number>', 'Limit number of results', '20')
	.action(async (options) => {
		try {
			console.log(chalk.blue('💡 Fetching optimization recommendations...'))
			const recommendations = await getOptimizationRecommendations(options)
			displayOptimizationRecommendations(recommendations)
		} catch (error) {
			console.error(
				chalk.red('❌ Failed to fetch optimization recommendations:'),
				error.message,
			)
			process.exit(1)
		}
	})

/**
 * Performance analysis command
 */
program
	.command('analyze')
	.description('Run performance analysis and get insights')
	.option('-e, --environment <env>', 'Environment name', DEFAULT_ENVIRONMENT)
	.option('-a, --application <app>', 'Application name', DEFAULT_APPLICATION)
	.action(async (options) => {
		try {
			console.log(chalk.blue('🔬 Running performance analysis...'))
			const analysis = await runPerformanceAnalysis(options)
			displayPerformanceAnalysis(analysis)
		} catch (error) {
			console.error(
				chalk.red('❌ Failed to run performance analysis:'),
				error.message,
			)
			process.exit(1)
		}
	})

/**
 * Cost optimization command
 */
program
	.command('cost')
	.description('Analyze cost optimization opportunities')
	.option('-e, --environment <env>', 'Environment name', DEFAULT_ENVIRONMENT)
	.option('-a, --application <app>', 'Application name', DEFAULT_APPLICATION)
	.action(async (options) => {
		try {
			console.log(chalk.blue('💰 Analyzing cost optimization...'))
			const costAnalysis = await runCostOptimization(options)
			displayCostOptimization(costAnalysis)
		} catch (error) {
			console.error(
				chalk.red('❌ Failed to analyze cost optimization:'),
				error.message,
			)
			process.exit(1)
		}
	})

/**
 * Auto Scaling status command
 */
program
	.command('scaling')
	.description('View Auto Scaling Group status and metrics')
	.option('-e, --environment <env>', 'Environment name', DEFAULT_ENVIRONMENT)
	.option('-a, --application <app>', 'Application name', DEFAULT_APPLICATION)
	.action(async (options) => {
		try {
			console.log(chalk.blue('⚖️ Fetching Auto Scaling status...'))
			const scalingStatus = await getAutoScalingStatus(options)
			displayAutoScalingStatus(scalingStatus)
		} catch (error) {
			console.error(
				chalk.red('❌ Failed to fetch Auto Scaling status:'),
				error.message,
			)
			process.exit(1)
		}
	})

/**
 * Performance dashboard command
 */
program
	.command('dashboard')
	.description('Display performance optimization dashboard')
	.option('-e, --environment <env>', 'Environment name', DEFAULT_ENVIRONMENT)
	.option('-a, --application <app>', 'Application name', DEFAULT_APPLICATION)
	.action(async (options) => {
		try {
			console.log(chalk.blue('📈 Loading performance dashboard...'))
			const dashboard = await getPerformanceDashboard(options)
			displayPerformanceDashboard(dashboard)
		} catch (error) {
			console.error(
				chalk.red('❌ Failed to load performance dashboard:'),
				error.message,
			)
			process.exit(1)
		}
	})

/**
 * Get performance metrics from CloudWatch
 */
async function getPerformanceMetrics(options: any) {
	const endTime = new Date()
	const startTime = new Date(
		endTime.getTime() - parseInt(options.period) * 60 * 60 * 1000,
	)
	const asgName = `${options.application}-${options.environment}-asg`

	const metrics = await Promise.all([
		// CPU Utilization
		cloudwatch.send(
			new GetMetricStatisticsCommand({
				Namespace: 'AWS/EC2',
				MetricName: 'CPUUtilization',
				Dimensions: [{ Name: 'AutoScalingGroupName', Value: asgName }],
				StartTime: startTime,
				EndTime: endTime,
				Period: 3600,
				Statistics: ['Average', 'Maximum'],
			}),
		),

		// Performance Score
		cloudwatch.send(
			new GetMetricStatisticsCommand({
				Namespace: 'MacroAI/Optimization',
				MetricName: 'PerformanceScore',
				Dimensions: [
					{ Name: 'Environment', Value: options.environment },
					{ Name: 'Application', Value: options.application },
				],
				StartTime: startTime,
				EndTime: endTime,
				Period: 3600,
				Statistics: ['Average'],
			}),
		),

		// Efficiency Rating
		cloudwatch.send(
			new GetMetricStatisticsCommand({
				Namespace: 'MacroAI/Optimization',
				MetricName: 'EfficiencyRating',
				Dimensions: [
					{ Name: 'Environment', Value: options.environment },
					{ Name: 'Application', Value: options.application },
				],
				StartTime: startTime,
				EndTime: endTime,
				Period: 3600,
				Statistics: ['Average'],
			}),
		),
	])

	return {
		cpuAverage:
			metrics[0].Datapoints?.reduce((sum, dp) => sum + (dp.Average || 0), 0) /
				(metrics[0].Datapoints?.length || 1) || 0,
		cpuMaximum: Math.max(
			...(metrics[0].Datapoints?.map((dp) => dp.Maximum || 0) || [0]),
		),
		performanceScore:
			metrics[1].Datapoints?.reduce((sum, dp) => sum + (dp.Average || 0), 0) /
				(metrics[1].Datapoints?.length || 1) || 0,
		efficiencyRating:
			metrics[2].Datapoints?.reduce((sum, dp) => sum + (dp.Average || 0), 0) /
				(metrics[2].Datapoints?.length || 1) || 0,
		period: options.period,
	}
}

/**
 * Get optimization recommendations from DynamoDB
 */
async function getOptimizationRecommendations(options: any) {
	const tableName = `${options.application}-${options.environment}-optimization-recommendations`

	let command
	if (options.type || options.priority) {
		const indexName = options.type ? 'TypeIndex' : 'PriorityIndex'
		const keyCondition = options.type ? 'type = :type' : 'priority = :priority'
		const attributeValues = options.type
			? { ':type': { S: options.type } }
			: { ':priority': { S: options.priority } }

		command = new QueryCommand({
			TableName: tableName,
			IndexName: indexName,
			KeyConditionExpression: keyCondition,
			ExpressionAttributeValues: attributeValues,
			Limit: parseInt(options.limit),
		})
	} else {
		command = new ScanCommand({
			TableName: tableName,
			Limit: parseInt(options.limit),
		})
	}

	const result = await dynamodb.send(command)
	return (
		result.Items?.map(parseOptimizationRecommendation).filter(Boolean) || []
	)
}

/**
 * Run performance analysis
 */
async function runPerformanceAnalysis(options: any) {
	const functionName = `${options.application}-${options.environment}-performance-analyzer`

	const result = await lambda.send(
		new InvokeCommand({
			FunctionName: functionName,
			Payload: JSON.stringify({
				environment: options.environment,
				application: options.application,
			}),
		}),
	)

	const payload = JSON.parse(new TextDecoder().decode(result.Payload))
	return payload.body || payload
}

/**
 * Run cost optimization analysis
 */
async function runCostOptimization(options: any) {
	const functionName = `${options.application}-${options.environment}-cost-optimizer`

	const result = await lambda.send(
		new InvokeCommand({
			FunctionName: functionName,
			Payload: JSON.stringify({
				environment: options.environment,
				application: options.application,
			}),
		}),
	)

	const payload = JSON.parse(new TextDecoder().decode(result.Payload))
	return payload.body || payload
}

/**
 * Get Auto Scaling Group status
 */
async function getAutoScalingStatus(options: any) {
	const asgName = `${options.application}-${options.environment}-asg`

	const result = await autoscaling.send(
		new DescribeAutoScalingGroupsCommand({
			AutoScalingGroupNames: [asgName],
		}),
	)

	const asg = result.AutoScalingGroups?.[0]
	if (!asg) {
		throw new Error(`Auto Scaling Group ${asgName} not found`)
	}

	return {
		name: asg.AutoScalingGroupName,
		desiredCapacity: asg.DesiredCapacity,
		minSize: asg.MinSize,
		maxSize: asg.MaxSize,
		instances: asg.Instances?.length || 0,
		healthyInstances:
			asg.Instances?.filter((i) => i.HealthStatus === 'Healthy').length || 0,
		availabilityZones: asg.AvailabilityZones,
		createdTime: asg.CreatedTime,
	}
}

/**
 * Get performance dashboard data
 */
async function getPerformanceDashboard(options: any) {
	const [metrics, recommendations, scalingStatus, alarms] = await Promise.all([
		getPerformanceMetrics({ ...options, period: '24' }),
		getOptimizationRecommendations({ ...options, limit: '5' }),
		getAutoScalingStatus(options),
		getPerformanceAlarms(options),
	])

	return { metrics, recommendations, scalingStatus, alarms }
}

/**
 * Get performance alarms
 */
async function getPerformanceAlarms(options: any) {
	const result = await cloudwatch.send(
		new DescribeAlarmsCommand({
			AlarmNamePrefix: `${options.application}-${options.environment}`,
			StateValue: 'ALARM',
		}),
	)

	return (
		result.MetricAlarms?.filter(
			(alarm) =>
				alarm.AlarmName?.includes('performance') ||
				alarm.AlarmName?.includes('cpu'),
		) || []
	)
}

/**
 * Parse optimization recommendation from DynamoDB item
 */
function parseOptimizationRecommendation(item: any) {
	if (!item) return null

	try {
		return {
			id: item.id?.S,
			timestamp: item.timestamp?.S,
			type: item.type?.S,
			priority: item.priority?.S,
			description: item.description?.S,
			status: item.status?.S || 'PENDING',
			expectedImpact: item.expectedImpact?.M
				? Object.fromEntries(
						Object.entries(item.expectedImpact.M).map(
							([key, value]: [string, any]) => [
								key,
								value.N ? parseFloat(value.N) : value.S,
							],
						),
					)
				: {},
		}
	} catch (error) {
		console.warn('Failed to parse optimization recommendation:', error)
		return null
	}
}

/**
 * Display performance metrics
 */
function displayPerformanceMetrics(metrics: any) {
	console.log(chalk.bold('\n📊 Performance Metrics Summary'))
	console.log(chalk.gray('─'.repeat(50)))

	const table = new Table({
		head: ['Metric', 'Value', 'Status', 'Period'],
		colWidths: [25, 15, 15, 10],
	})

	// CPU metrics
	const cpuStatus = getCpuStatus(metrics.cpuAverage)
	table.push([
		'CPU Utilization (Avg)',
		`${metrics.cpuAverage.toFixed(1)}%`,
		cpuStatus.color(cpuStatus.status),
		`${metrics.period}h`,
	])

	table.push([
		'CPU Utilization (Max)',
		`${metrics.cpuMaximum.toFixed(1)}%`,
		getCpuStatus(metrics.cpuMaximum).color(
			getCpuStatus(metrics.cpuMaximum).status,
		),
		`${metrics.period}h`,
	])

	// Performance score
	const perfStatus = getPerformanceStatus(metrics.performanceScore)
	table.push([
		'Performance Score',
		metrics.performanceScore.toFixed(1),
		perfStatus.color(perfStatus.status),
		'Current',
	])

	// Efficiency rating
	const effStatus = getEfficiencyStatus(metrics.efficiencyRating)
	table.push([
		'Efficiency Rating',
		`${metrics.efficiencyRating.toFixed(1)}%`,
		effStatus.color(effStatus.status),
		'Current',
	])

	console.log(table.toString())

	// Overall assessment
	const overallStatus = getOverallPerformanceStatus(metrics)
	console.log(
		`\n🎯 Overall Performance: ${overallStatus.color(overallStatus.status)}`,
	)
}

/**
 * Display optimization recommendations
 */
function displayOptimizationRecommendations(recommendations: any[]) {
	if (recommendations.length === 0) {
		console.log(chalk.green('✅ No optimization recommendations found'))
		return
	}

	console.log(chalk.bold('\n💡 Optimization Recommendations'))
	console.log(chalk.gray('─'.repeat(60)))

	const table = new Table({
		head: ['ID', 'Type', 'Priority', 'Description', 'Status'],
		colWidths: [15, 20, 12, 35, 12],
	})

	recommendations.forEach((rec) => {
		const priorityColor = getPriorityColor(rec.priority)
		const statusColor = getStatusColor(rec.status)
		table.push([
			rec.id?.substring(0, 12) + '...',
			rec.type,
			priorityColor(rec.priority),
			rec.description?.substring(0, 30) + '...',
			statusColor(rec.status),
		])
	})

	console.log(table.toString())

	// Summary by priority
	const prioritySummary = recommendations.reduce((acc: any, rec) => {
		acc[rec.priority] = (acc[rec.priority] || 0) + 1
		return acc
	}, {})

	console.log(chalk.bold('\n📋 Summary by Priority:'))
	Object.entries(prioritySummary).forEach(([priority, count]) => {
		const priorityColor = getPriorityColor(priority)
		console.log(`  ${priorityColor(priority)}: ${count}`)
	})
}

/**
 * Display performance analysis results
 */
function displayPerformanceAnalysis(analysis: any) {
	console.log(chalk.bold('\n🔬 Performance Analysis Results'))
	console.log(chalk.gray('─'.repeat(50)))

	if (analysis.error) {
		console.log(chalk.red(`❌ Analysis failed: ${analysis.error}`))
		return
	}

	console.log(
		`📈 Performance Score: ${chalk.yellow(analysis.performanceScore || 'N/A')}`,
	)
	console.log(
		`⚡ Efficiency Rating: ${chalk.cyan(analysis.efficiency?.toFixed(1) + '%' || 'N/A')}`,
	)
	console.log(`💡 Recommendations: ${analysis.recommendations || 0}`)

	if (analysis.analysis?.bottlenecks?.length > 0) {
		console.log(chalk.bold('\n🚫 Performance Bottlenecks:'))
		analysis.analysis.bottlenecks.forEach(
			(bottleneck: string, index: number) => {
				console.log(`  ${index + 1}. ${chalk.red(bottleneck)}`)
			},
		)
	}

	if (analysis.analysis?.opportunities?.length > 0) {
		console.log(chalk.bold('\n🎯 Optimization Opportunities:'))
		analysis.analysis.opportunities.forEach(
			(opportunity: string, index: number) => {
				console.log(`  ${index + 1}. ${chalk.green(opportunity)}`)
			},
		)
	}
}

/**
 * Display cost optimization analysis
 */
function displayCostOptimization(costAnalysis: any) {
	console.log(chalk.bold('\n💰 Cost Optimization Analysis'))
	console.log(chalk.gray('─'.repeat(50)))

	if (costAnalysis.error) {
		console.log(chalk.red(`❌ Cost analysis failed: ${costAnalysis.error}`))
		return
	}

	console.log(
		`💵 Current Monthly Cost: $${costAnalysis.currentMonthlyCost?.toFixed(2) || 'N/A'}`,
	)
	console.log(
		`💾 Potential Savings: ${costAnalysis.potentialSavings?.toFixed(1) + '%' || 'N/A'}`,
	)
	console.log(`📊 Recommendations: ${costAnalysis.recommendations || 0}`)

	if (costAnalysis.analysis?.recommendations?.length > 0) {
		console.log(chalk.bold('\n💡 Cost Optimization Recommendations:'))
		costAnalysis.analysis.recommendations.forEach((rec: any, index: number) => {
			const priorityColor = getPriorityColor(rec.priority)
			const savings = rec.expectedImpact?.costSavings
			console.log(
				`  ${index + 1}. ${priorityColor(rec.priority)}: ${rec.description} ${savings ? `(${savings.toFixed(1)}% savings)` : ''}`,
			)
		})
	}
}

/**
 * Display Auto Scaling status
 */
function displayAutoScalingStatus(scalingStatus: any) {
	console.log(chalk.bold('\n⚖️ Auto Scaling Group Status'))
	console.log(chalk.gray('─'.repeat(50)))

	const table = new Table({
		head: ['Property', 'Value'],
		colWidths: [25, 25],
	})

	table.push(
		['Name', scalingStatus.name],
		['Desired Capacity', scalingStatus.desiredCapacity.toString()],
		['Min Size', scalingStatus.minSize.toString()],
		['Max Size', scalingStatus.maxSize.toString()],
		['Current Instances', scalingStatus.instances.toString()],
		[
			'Healthy Instances',
			`${scalingStatus.healthyInstances}/${scalingStatus.instances}`,
		],
		[
			'Availability Zones',
			scalingStatus.availabilityZones?.join(', ') || 'N/A',
		],
		['Created', new Date(scalingStatus.createdTime).toLocaleString()],
	)

	console.log(table.toString())

	// Health status
	const healthRatio = scalingStatus.healthyInstances / scalingStatus.instances
	const healthStatus = getHealthStatus(healthRatio)
	console.log(`\n🏥 Health Status: ${healthStatus.color(healthStatus.status)}`)

	// Capacity utilization
	const capacityRatio = scalingStatus.instances / scalingStatus.maxSize
	const capacityStatus = getCapacityStatus(capacityRatio)
	console.log(
		`📊 Capacity Utilization: ${capacityStatus.color(capacityStatus.status)}`,
	)
}

/**
 * Display performance dashboard
 */
function displayPerformanceDashboard(dashboard: any) {
	console.log(chalk.bold('\n📈 Performance Optimization Dashboard'))
	console.log(chalk.gray('═'.repeat(70)))

	// Performance metrics summary
	console.log(chalk.bold('\n📊 Performance Metrics (Last 24h)'))
	console.log(
		`  CPU Average: ${dashboard.metrics?.cpuAverage?.toFixed(1) || 'N/A'}%`,
	)
	console.log(
		`  Performance Score: ${dashboard.metrics?.performanceScore?.toFixed(1) || 'N/A'}`,
	)
	console.log(
		`  Efficiency Rating: ${dashboard.metrics?.efficiencyRating?.toFixed(1) || 'N/A'}%`,
	)

	// Auto Scaling status
	console.log(chalk.bold('\n⚖️ Auto Scaling Status'))
	console.log(
		`  Desired Capacity: ${dashboard.scalingStatus?.desiredCapacity || 'N/A'}`,
	)
	console.log(
		`  Healthy Instances: ${dashboard.scalingStatus?.healthyInstances || 'N/A'}/${dashboard.scalingStatus?.instances || 'N/A'}`,
	)

	// Recent recommendations
	console.log(chalk.bold('\n💡 Recent Recommendations'))
	if (dashboard.recommendations?.length > 0) {
		dashboard.recommendations.slice(0, 3).forEach((rec: any, index: number) => {
			const priorityColor = getPriorityColor(rec.priority)
			console.log(
				`  ${index + 1}. ${priorityColor(rec.priority)}: ${rec.description?.substring(0, 50) + '...'}`,
			)
		})
		if (dashboard.recommendations.length > 3) {
			console.log(
				chalk.gray(`  ... and ${dashboard.recommendations.length - 3} more`),
			)
		}
	} else {
		console.log(chalk.green('  ✅ No recent recommendations'))
	}

	// Active alarms
	console.log(chalk.bold('\n🚨 Active Performance Alarms'))
	if (dashboard.alarms?.length > 0) {
		dashboard.alarms.forEach((alarm: any) => {
			console.log(
				`  ${chalk.red('🔴')} ${alarm.AlarmName}: ${alarm.StateReason}`,
			)
		})
	} else {
		console.log(chalk.green('  ✅ No active alarms'))
	}

	console.log(chalk.gray('\n' + '═'.repeat(70)))
}

/**
 * Get CPU status assessment
 */
function getCpuStatus(cpuUtilization: number) {
	if (cpuUtilization >= 90) {
		return { status: 'CRITICAL', color: chalk.red.bold }
	} else if (cpuUtilization >= 80) {
		return { status: 'HIGH', color: chalk.red }
	} else if (cpuUtilization >= 60) {
		return { status: 'OPTIMAL', color: chalk.green }
	} else if (cpuUtilization >= 20) {
		return { status: 'LOW', color: chalk.yellow }
	} else {
		return { status: 'VERY LOW', color: chalk.blue }
	}
}

/**
 * Get performance status assessment
 */
function getPerformanceStatus(score: number) {
	if (score >= 90) {
		return { status: 'EXCELLENT', color: chalk.green.bold }
	} else if (score >= 80) {
		return { status: 'GOOD', color: chalk.green }
	} else if (score >= 70) {
		return { status: 'FAIR', color: chalk.yellow }
	} else if (score >= 50) {
		return { status: 'POOR', color: chalk.red }
	} else {
		return { status: 'CRITICAL', color: chalk.red.bold }
	}
}

/**
 * Get efficiency status assessment
 */
function getEfficiencyStatus(efficiency: number) {
	if (efficiency >= 90) {
		return { status: 'EXCELLENT', color: chalk.green.bold }
	} else if (efficiency >= 80) {
		return { status: 'GOOD', color: chalk.green }
	} else if (efficiency >= 60) {
		return { status: 'FAIR', color: chalk.yellow }
	} else {
		return { status: 'POOR', color: chalk.red }
	}
}

/**
 * Get overall performance status
 */
function getOverallPerformanceStatus(metrics: any) {
	const avgScore = (metrics.performanceScore + metrics.efficiencyRating) / 2
	return getPerformanceStatus(avgScore)
}

/**
 * Get health status assessment
 */
function getHealthStatus(healthRatio: number) {
	if (healthRatio >= 1.0) {
		return { status: 'HEALTHY', color: chalk.green }
	} else if (healthRatio >= 0.8) {
		return { status: 'MOSTLY HEALTHY', color: chalk.yellow }
	} else {
		return { status: 'UNHEALTHY', color: chalk.red }
	}
}

/**
 * Get capacity status assessment
 */
function getCapacityStatus(capacityRatio: number) {
	if (capacityRatio >= 0.9) {
		return { status: 'HIGH', color: chalk.red }
	} else if (capacityRatio >= 0.7) {
		return { status: 'MODERATE', color: chalk.yellow }
	} else {
		return { status: 'LOW', color: chalk.green }
	}
}

/**
 * Get color for priority level
 */
function getPriorityColor(priority: string) {
	switch (priority?.toUpperCase()) {
		case 'CRITICAL':
			return chalk.red.bold
		case 'HIGH':
			return chalk.red
		case 'MEDIUM':
			return chalk.yellow
		case 'LOW':
			return chalk.blue
		default:
			return chalk.white
	}
}

/**
 * Get color for status
 */
function getStatusColor(status: string) {
	switch (status?.toUpperCase()) {
		case 'COMPLETED':
			return chalk.green
		case 'IN_PROGRESS':
			return chalk.yellow
		case 'FAILED':
			return chalk.red
		case 'PENDING':
			return chalk.blue
		default:
			return chalk.white
	}
}

// Parse command line arguments
program.parse()

export { program }
