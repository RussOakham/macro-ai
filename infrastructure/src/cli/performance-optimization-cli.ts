#!/usr/bin/env node

import {
	AutoScalingClient,
	DescribeAutoScalingGroupsCommand,
} from '@aws-sdk/client-auto-scaling'
import {
	CloudWatchClient,
	DescribeAlarmsCommand,
	GetMetricStatisticsCommand,
} from '@aws-sdk/client-cloudwatch'
import {
	DynamoDBClient,
	QueryCommand,
	ScanCommand,
} from '@aws-sdk/client-dynamodb'
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda'
import chalk from 'chalk'
import Table from 'cli-table3'
import { Command } from 'commander'

/**
 * Performance Optimization CLI Tool
 *
 * Provides command-line interface for monitoring performance metrics,
 * analyzing optimization opportunities, and managing performance configurations.
 */

interface PerformanceOptions {
	application: string
	environment: string
	period: string
	type?: string
	priority?: string
	limit?: string
}

interface OptimizationRecommendation {
	id: string
	timestamp: string
	type: string
	priority: string
	description: string
	status: string
	expectedImpact: Record<string, unknown>
}

interface AutoScalingGroupInfo {
	name: string
	desiredCapacity: number
	minSize: number
	maxSize: number
	instances: number
	healthyInstances: number
	availabilityZones: string[]
	createdTime: Date
}

interface PerformanceMetrics {
	cpuAverage: number
	cpuMaximum: number
	performanceScore: number
	efficiencyRating: number
	period: string
}

interface AnalysisRecommendation {
	priority: string
	description: string
	expectedImpact: number
}

interface AnalysisDetail {
	type: string
	severity: string
	confidence: number
	description: string
}

interface LambdaPerformanceResponse {
	statusCode: number
	body: {
		performanceScore?: number
		efficiency?: number
		recommendations?: AnalysisRecommendation[]
		analysis?: AnalysisDetail[]
		currentMonthlyCost?: number
		potentialSavings?: number
		error?: string
		[key: string]: unknown
	}
}

interface DynamoDBAttributeValue {
	S?: string
	N?: string
	BOOL?: boolean
	M?: Record<string, DynamoDBAttributeValue>
}

type DynamoDBItem = Record<string, DynamoDBAttributeValue>

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
	.action(async (options: PerformanceOptions) => {
		try {
			console.log(chalk.blue('📊 Fetching performance metrics...'))
			// Validate and parse period input
			const validatedOptions = {
				...options,
				period: parseNumericInput(options.period, 24, 'period').toString(),
			}
			const metrics = await getPerformanceMetrics(validatedOptions)
			displayPerformanceMetrics(metrics)
		} catch (error) {
			console.error(
				chalk.red('❌ Failed to fetch performance metrics:'),
				error instanceof Error ? error.message : String(error),
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
	.action(async (options: PerformanceOptions) => {
		try {
			console.log(chalk.blue('💡 Fetching optimization recommendations...'))
			// Validate and parse limit input
			const validatedOptions = {
				...options,
				limit: options.limit
					? parseNumericInput(options.limit, 10, 'limit').toString()
					: undefined,
			}
			const recommendations =
				await getOptimizationRecommendations(validatedOptions)
			displayOptimizationRecommendations(recommendations)
		} catch (error) {
			console.error(
				chalk.red('❌ Failed to fetch optimization recommendations:'),
				error instanceof Error ? error.message : String(error),
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
	.action(async (options: PerformanceOptions) => {
		try {
			console.log(chalk.blue('🔬 Running performance analysis...'))
			const analysis = await runPerformanceAnalysis(options)
			displayPerformanceAnalysis(analysis)
		} catch (error) {
			console.error(
				chalk.red('❌ Failed to run performance analysis:'),
				error instanceof Error ? error.message : String(error),
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
	.action(async (options: PerformanceOptions) => {
		try {
			console.log(chalk.blue('💰 Analyzing cost optimization...'))
			const costAnalysis = await runCostOptimization(options)
			displayCostOptimization(costAnalysis)
		} catch (error) {
			console.error(
				chalk.red('❌ Failed to analyze cost optimization:'),
				error instanceof Error ? error.message : String(error),
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
	.action(async (options: PerformanceOptions) => {
		try {
			console.log(chalk.blue('⚖️ Fetching Auto Scaling status...'))
			const scalingStatus = await getAutoScalingStatus(options)
			displayAutoScalingStatus(scalingStatus)
		} catch (error) {
			console.error(
				chalk.red('❌ Failed to fetch Auto Scaling status:'),
				error instanceof Error ? error.message : String(error),
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
	.action(async (options: PerformanceOptions) => {
		try {
			console.log(chalk.blue('📈 Loading performance dashboard...'))
			const dashboard = await getPerformanceDashboard(options)
			displayPerformanceDashboard(dashboard)
		} catch (error) {
			console.error(
				chalk.red('❌ Failed to load performance dashboard:'),
				error instanceof Error ? error.message : String(error),
			)
			process.exit(1)
		}
	})

/**
 * Get performance metrics from CloudWatch
 */
async function getPerformanceMetrics(
	options: PerformanceOptions,
): Promise<PerformanceMetrics> {
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
		cpuAverage: calculateSafeAverage(metrics[0].Datapoints),
		cpuMaximum: calculateSafeMaximum(metrics[0].Datapoints),
		performanceScore: calculateSafeAverage(metrics[1].Datapoints),
		efficiencyRating: calculateSafeAverage(metrics[2].Datapoints),
		period: options.period,
	}
}

/**
 * Get optimization recommendations from DynamoDB
 */
async function getOptimizationRecommendations(
	options: PerformanceOptions,
): Promise<OptimizationRecommendation[]> {
	const tableName = `${options.application}-${options.environment}-optimization-recommendations`

	let command
	if (options.type || options.priority) {
		const indexName = options.type ? 'TypeIndex' : 'PriorityIndex'
		const keyCondition = options.type ? 'type = :type' : 'priority = :priority'
		const attributeValues: Record<string, { S: string }> = {}

		if (options.type) {
			attributeValues[':type'] = { S: options.type }
		}
		if (options.priority) {
			attributeValues[':priority'] = { S: options.priority }
		}

		command = new QueryCommand({
			TableName: tableName,
			IndexName: indexName,
			KeyConditionExpression: keyCondition,
			ExpressionAttributeValues: attributeValues,
			Limit: parseInt(options.limit ?? '20'),
		})
	} else {
		command = new ScanCommand({
			TableName: tableName,
			Limit: parseInt(options.limit ?? '20'),
		})
	}

	const result = await dynamodb.send(command)
	return (
		result.Items?.map(parseOptimizationRecommendation).filter(
			(item): item is OptimizationRecommendation => item !== null,
		) ?? []
	)
}

/**
 * Validate and parse numeric input with fallback
 */
function parseNumericInput(
	value: string,
	fallback: number,
	name: string,
): number {
	if (!value || typeof value !== 'string') {
		console.warn(`Invalid ${name} input: using fallback value ${fallback}`)
		return fallback
	}

	const parsed = parseInt(value, 10)
	if (isNaN(parsed) || parsed <= 0) {
		console.warn(
			`Invalid ${name} value "${value}": using fallback value ${fallback}`,
		)
		return fallback
	}

	return parsed
}

/**
 * Safely calculate average from CloudWatch Datapoints
 */
function calculateSafeAverage(
	datapoints: { Average?: number }[] | undefined,
): number {
	if (!datapoints || datapoints.length === 0) {
		return 0
	}

	const validDatapoints = datapoints.filter(
		(dp) => dp.Average !== undefined && !isNaN(dp.Average),
	)
	if (validDatapoints.length === 0) {
		return 0
	}

	const sum = validDatapoints.reduce((acc, dp) => acc + (dp.Average ?? 0), 0)
	return sum / validDatapoints.length
}

/**
 * Safely calculate maximum from CloudWatch Datapoints
 */
function calculateSafeMaximum(
	datapoints: { Maximum?: number }[] | undefined,
): number {
	if (!datapoints || datapoints.length === 0) {
		return 0
	}

	const validMaximums = datapoints
		.map((dp) => dp.Maximum)
		.filter((max): max is number => max !== undefined && !isNaN(max))

	if (validMaximums.length === 0) {
		return 0
	}

	return Math.max(...validMaximums)
}

/**
 * Validate Lambda response structure
 */
function validateLambdaResponse(payload: unknown): LambdaPerformanceResponse {
	if (!payload || typeof payload !== 'object') {
		throw new Error('Invalid Lambda response: payload is not an object')
	}

	const response = payload as Record<string, unknown>

	if (typeof response.statusCode !== 'number') {
		throw new Error('Invalid Lambda response: missing or invalid statusCode')
	}

	if (!response.body || typeof response.body !== 'object') {
		throw new Error('Invalid Lambda response: missing or invalid body')
	}

	return response as unknown as LambdaPerformanceResponse
}

/**
 * Run performance analysis
 */
async function runPerformanceAnalysis(
	options: PerformanceOptions,
): Promise<LambdaPerformanceResponse> {
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

	if (!result.Payload) {
		throw new Error('Lambda function returned no payload')
	}

	const payload = JSON.parse(
		new TextDecoder().decode(result.Payload),
	) as unknown

	return validateLambdaResponse(payload)
}

/**
 * Run cost optimization analysis
 */
async function runCostOptimization(
	options: PerformanceOptions,
): Promise<LambdaPerformanceResponse> {
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

	if (!result.Payload) {
		throw new Error('Lambda function returned no payload')
	}

	const payload = JSON.parse(
		new TextDecoder().decode(result.Payload),
	) as unknown

	return validateLambdaResponse(payload)
}

/**
 * Get Auto Scaling Group status
 */
async function getAutoScalingStatus(
	options: PerformanceOptions,
): Promise<AutoScalingGroupInfo> {
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
		name: asg.AutoScalingGroupName ?? 'Unknown',
		desiredCapacity: asg.DesiredCapacity ?? 0,
		minSize: asg.MinSize ?? 0,
		maxSize: asg.MaxSize ?? 0,
		instances: asg.Instances?.length ?? 0,
		healthyInstances:
			asg.Instances?.filter((i) => i.HealthStatus === 'Healthy').length ?? 0,
		availabilityZones: asg.AvailabilityZones ?? [],
		createdTime: asg.CreatedTime ?? new Date(),
	}
}

/**
 * Get performance dashboard data
 */
async function getPerformanceDashboard(options: PerformanceOptions): Promise<{
	metrics: PerformanceMetrics
	recommendations: OptimizationRecommendation[]
	scalingStatus: AutoScalingGroupInfo
	alarms: unknown[]
}> {
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
async function getPerformanceAlarms(
	options: PerformanceOptions,
): Promise<unknown[]> {
	const result = await cloudwatch.send(
		new DescribeAlarmsCommand({
			AlarmNamePrefix: `${options.application}-${options.environment}`,
			StateValue: 'ALARM',
		}),
	)

	return (
		result.MetricAlarms?.filter(
			(alarm) =>
				(alarm.AlarmName?.includes('performance') ?? false) ||
				(alarm.AlarmName?.includes('cpu') ?? false),
		) ?? []
	)
}

/**
 * Parse optimization recommendation from DynamoDB item
 */
function parseOptimizationRecommendation(
	item: DynamoDBItem,
): OptimizationRecommendation | null {
	try {
		return {
			id: item.id?.S ?? '',
			timestamp: item.timestamp?.S ?? '',
			type: item.type?.S ?? '',
			priority: item.priority?.S ?? '',
			description: item.description?.S ?? '',
			status: item.status?.S ?? 'PENDING',
			expectedImpact: item.expectedImpact?.M
				? Object.fromEntries(
						Object.entries(item.expectedImpact.M).map(
							([key, value]: [string, DynamoDBAttributeValue]) => [
								key,
								value.N ? parseFloat(value.N) : (value.S ?? ''),
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
function displayPerformanceMetrics(metrics: PerformanceMetrics): void {
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
function displayOptimizationRecommendations(
	recommendations: OptimizationRecommendation[],
): void {
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

	recommendations.forEach((rec: OptimizationRecommendation) => {
		const priorityColor = getPriorityColor(rec.priority)
		const statusColor = getStatusColor(rec.status)
		table.push([
			rec.id.substring(0, 12) + '...',
			rec.type,
			priorityColor(rec.priority),
			rec.description.substring(0, 30) + '...',
			statusColor(rec.status),
		])
	})

	console.log(table.toString())

	// Summary by priority
	const prioritySummary = recommendations.reduce(
		(acc: Record<string, number>, rec: OptimizationRecommendation) => {
			acc[rec.priority] = (acc[rec.priority] ?? 0) + 1
			return acc
		},
		{},
	)

	console.log(chalk.bold('\n📋 Summary by Priority:'))
	Object.entries(prioritySummary).forEach(([priority, count]) => {
		const priorityColor = getPriorityColor(priority)
		console.log(`  ${priorityColor(priority)}: ${count}`)
	})
}

/**
 * Display performance analysis results
 */
function displayPerformanceAnalysis(analysis: LambdaPerformanceResponse): void {
	console.log(chalk.bold('\n🔬 Performance Analysis Results'))
	console.log(chalk.gray('─'.repeat(50)))

	if (analysis.body.error) {
		console.log(chalk.red(`❌ Analysis failed: ${analysis.body.error}`))
		return
	}

	console.log(
		`📈 Performance Score: ${chalk.yellow(analysis.body.performanceScore ?? 'N/A')}`,
	)
	const efficiencyText = analysis.body.efficiency
		? `${analysis.body.efficiency}%`
		: 'N/A'
	console.log(`⚡ Efficiency Rating: ${chalk.cyan(efficiencyText)}`)
	console.log(
		`💡 Recommendations: ${analysis.body.recommendations?.length ?? 0}`,
	)

	if (
		analysis.body.analysis &&
		Array.isArray(analysis.body.analysis) &&
		analysis.body.analysis.length > 0
	) {
		console.log(chalk.bold('\n🎯 Analysis Details:'))
		analysis.body.analysis.forEach((detail: AnalysisDetail, index: number) => {
			console.log(`  ${index + 1}. ${chalk.green(detail.description)}`)
		})
	}
}

/**
 * Display cost optimization analysis
 */
function displayCostOptimization(
	costAnalysis: LambdaPerformanceResponse,
): void {
	console.log(chalk.bold('\n💰 Cost Optimization Analysis'))
	console.log(chalk.gray('─'.repeat(50)))

	if (costAnalysis.body.error) {
		console.log(
			chalk.red(`❌ Cost analysis failed: ${costAnalysis.body.error}`),
		)
		return
	}

	const currentCost = costAnalysis.body.currentMonthlyCost?.toFixed(2) ?? 'N/A'
	const potentialSavings =
		costAnalysis.body.potentialSavings?.toFixed(1) ?? 'N/A'

	console.log(`💵 Current Monthly Cost: $${currentCost}`)
	console.log(`💾 Potential Savings: ${potentialSavings}%`)
	console.log(
		`📊 Recommendations: ${costAnalysis.body.recommendations?.length ?? 0}`,
	)

	if (
		costAnalysis.body.recommendations &&
		costAnalysis.body.recommendations.length > 0
	) {
		console.log(chalk.bold('\n💡 Cost Optimization Recommendations:'))
		costAnalysis.body.recommendations.forEach(
			(rec: AnalysisRecommendation, index: number) => {
				const priorityColor = getPriorityColor(rec.priority)
				const savings = rec.expectedImpact.toFixed(1)
				console.log(
					`  ${index + 1}. ${priorityColor(rec.priority)}: ${rec.description} (${savings}% savings)`,
				)
			},
		)
	}
}

/**
 * Display Auto Scaling status
 */
function displayAutoScalingStatus(scalingStatus: AutoScalingGroupInfo): void {
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
		['Availability Zones', scalingStatus.availabilityZones.join(', ') || 'N/A'],
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
function displayPerformanceDashboard(dashboard: {
	metrics: PerformanceMetrics
	recommendations: OptimizationRecommendation[]
	scalingStatus: AutoScalingGroupInfo
	alarms: unknown[]
}): void {
	console.log(chalk.bold('\n📈 Performance Optimization Dashboard'))
	console.log(chalk.gray('═'.repeat(70)))

	// Performance metrics summary
	console.log(chalk.bold('\n📊 Performance Metrics (Last 24h)'))
	console.log(`  CPU Average: ${dashboard.metrics.cpuAverage.toFixed(1)}%`)
	console.log(
		`  Performance Score: ${dashboard.metrics.performanceScore.toFixed(1)}`,
	)
	console.log(
		`  Efficiency Rating: ${dashboard.metrics.efficiencyRating.toFixed(1)}%`,
	)

	// Auto Scaling status
	console.log(chalk.bold('\n⚖️ Auto Scaling Status'))
	console.log(`  Desired Capacity: ${dashboard.scalingStatus.desiredCapacity}`)
	console.log(
		`  Healthy Instances: ${dashboard.scalingStatus.healthyInstances}/${dashboard.scalingStatus.instances}`,
	)

	// Recent recommendations
	console.log(chalk.bold('\n💡 Recent Recommendations'))
	if (dashboard.recommendations.length > 0) {
		dashboard.recommendations
			.slice(0, 3)
			.forEach((rec: OptimizationRecommendation, index: number) => {
				const priorityColor = getPriorityColor(rec.priority)
				console.log(
					`  ${index + 1}. ${priorityColor(rec.priority)}: ${rec.description.substring(0, 50) + '...'}`,
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
	if (dashboard.alarms.length > 0) {
		dashboard.alarms.forEach((alarm: unknown) => {
			const alarmData = alarm as { AlarmName?: string; StateReason?: string }
			console.log(
				`  ${chalk.red('🔴')} ${alarmData.AlarmName ?? 'Unknown'}: ${alarmData.StateReason ?? 'No reason'}`,
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
function getCpuStatus(cpuUtilization: number): {
	status: string
	color: (text: string) => string
} {
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
function getPerformanceStatus(score: number): {
	status: string
	color: (text: string) => string
} {
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
function getEfficiencyStatus(efficiency: number): {
	status: string
	color: (text: string) => string
} {
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
function getOverallPerformanceStatus(metrics: PerformanceMetrics): {
	status: string
	color: (text: string) => string
} {
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
	switch (priority.toUpperCase()) {
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
	switch (status.toUpperCase()) {
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
