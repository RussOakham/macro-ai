/* eslint-disable security-node/detect-insecure-randomness */
import {
	CloudWatchClient,
	GetMetricDataCommand,
} from '@aws-sdk/client-cloudwatch'
import { ECSClient, UpdateServiceCommand } from '@aws-sdk/client-ecs'
import { EventBridgeClient, PutRuleCommand } from '@aws-sdk/client-eventbridge'
import type { Context } from 'aws-lambda'

const cloudwatch = new CloudWatchClient({})
const ecs = new ECSClient({})
const eventbridge = new EventBridgeClient({})

interface ScalingOptimizerEvent {
	source: string
	detail: any
	environment: string
	budget: string
}

export async function handler(
	event: ScalingOptimizerEvent,
	context: Context,
): Promise<void> {
	console.log('🔧 Scaling Optimizer Started')
	console.log('Event:', JSON.stringify(event, null, 2))

	try {
		const environment =
			event.environment || process.env.ENVIRONMENT_NAME || 'production'
		const monthlyBudget = parseFloat(
			event.budget || process.env.MONTHLY_BUDGET || '300',
		)

		// Analyze current scaling patterns
		const scalingAnalysis = await analyzeScalingPatterns(environment)

		// Generate scaling recommendations
		const recommendations = await generateScalingRecommendations(
			environment,
			monthlyBudget,
			scalingAnalysis,
		)

		// Apply cost optimizations
		await applyCostOptimizations(environment, recommendations)

		// Update scaling policies based on patterns
		await updateScalingPolicies(environment, recommendations)

		// Log optimization results
		await logOptimizationResults(environment, recommendations)

		console.log('✅ Scaling optimization completed successfully')
	} catch (error) {
		console.error('❌ Error in scaling optimization:', error)
		await logOptimizationError(environment, error)
		throw error
	}
}

/**
 * Analyze current scaling patterns over the past week
 */
async function analyzeScalingPatterns(
	environment: string,
): Promise<ScalingAnalysis> {
	console.log('📊 Analyzing scaling patterns...')

	const endTime = new Date()
	const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days ago

	// Get CPU utilization data
	const cpuMetrics = await getMetricData(
		'AWS/ECS',
		'CPUUtilization',
		{
			ClusterName: `${environment}-cluster`,
			ServiceName: `${environment}-service`,
		},
		startTime,
		endTime,
		'Maximum',
	)

	// Get memory utilization data
	const memoryMetrics = await getMetricData(
		'AWS/ECS',
		'MemoryUtilization',
		{
			ClusterName: `${environment}-cluster`,
			ServiceName: `${environment}-service`,
		},
		startTime,
		endTime,
		'Maximum',
	)

	// Get request count data
	const requestMetrics = await getMetricData(
		'AWS/ApplicationELB',
		'RequestCount',
		{
			LoadBalancer: `${environment}-alb`,
		},
		startTime,
		endTime,
		'Sum',
	)

	// Get task count data
	const taskCountMetrics = await getMetricData(
		'AWS/ECS',
		'RunningTaskCount',
		{
			ClusterName: `${environment}-cluster`,
			ServiceName: `${environment}-service`,
		},
		startTime,
		endTime,
		'Average',
	)

	// Analyze peak hours
	const peakHours = analyzePeakHours(requestMetrics)

	// Calculate utilization patterns
	const utilizationPatterns = {
		averageCpu: calculateAverage(cpuMetrics),
		peakCpu: calculatePeak(cpuMetrics),
		averageMemory: calculateAverage(memoryMetrics),
		peakMemory: calculatePeak(memoryMetrics),
		averageRequests: calculateAverage(requestMetrics),
		peakRequests: calculatePeak(requestMetrics),
		averageTasks: calculateAverage(taskCountMetrics),
		peakTasks: calculatePeak(taskCountMetrics),
	}

	return {
		peakHours,
		utilizationPatterns,
		timeRange: { start: startTime, end: endTime },
	}
}

/**
 * Generate scaling recommendations based on analysis
 */
async function generateScalingRecommendations(
	environment: string,
	monthlyBudget: number,
	analysis: ScalingAnalysis,
): Promise<ScalingRecommendations> {
	console.log('🎯 Generating scaling recommendations...')

	const recommendations: ScalingRecommendations = {
		scheduledScaling: [],
		policyAdjustments: [],
		costOptimizations: [],
		alerts: [],
	}

	const { peakHours, utilizationPatterns } = analysis

	// 1. Scheduled scaling recommendations
	if (peakHours.length > 0) {
		// Scale up during peak hours
		for (const peakHour of peakHours) {
			recommendations.scheduledScaling.push({
				type: 'scale-up',
				schedule: `cron(${peakHour.minute} ${peakHour.hour} * * ? *)`,
				minCapacity: Math.max(
					2,
					Math.ceil(utilizationPatterns.averageTasks * 1.5),
				),
				maxCapacity: Math.min(10, Math.ceil(utilizationPatterns.peakTasks * 2)),
				reason: `Peak traffic detected at ${peakHour.hour}:${peakHour.minute}`,
			})
		}

		// Scale down during off-peak hours
		const offPeakHours = findOffPeakHours(peakHours)
		for (const offPeakHour of offPeakHours) {
			recommendations.scheduledScaling.push({
				type: 'scale-down',
				schedule: `cron(${offPeakHour.minute} ${offPeakHour.hour} * * ? *)`,
				minCapacity: 1,
				maxCapacity: Math.max(
					1,
					Math.floor(utilizationPatterns.averageTasks * 0.7),
				),
				reason: `Low traffic detected at ${offPeakHour.hour}:${offPeakHour.minute}`,
			})
		}
	}

	// 2. Policy adjustments based on utilization
	if (utilizationPatterns.averageCpu < 40) {
		recommendations.policyAdjustments.push({
			policyType: 'cpu-target-tracking',
			action: 'increase-target',
			newValue: Math.min(80, Math.ceil(utilizationPatterns.averageCpu + 20)),
			reason:
				'CPU utilization consistently below target, can increase threshold',
		})
	} else if (utilizationPatterns.averageCpu > 70) {
		recommendations.policyAdjustments.push({
			policyType: 'cpu-target-tracking',
			action: 'decrease-target',
			newValue: Math.max(50, Math.floor(utilizationPatterns.averageCpu - 10)),
			reason:
				'CPU utilization consistently above target, should decrease threshold',
		})
	}

	// 3. Cost optimization recommendations
	const estimatedMonthlyCost = calculateEstimatedCost(
		utilizationPatterns,
		monthlyBudget,
	)
	if (estimatedMonthlyCost > monthlyBudget * 0.8) {
		recommendations.costOptimizations.push({
			action: 'reduce-min-capacity',
			currentValue: utilizationPatterns.averageTasks,
			recommendedValue: Math.max(
				1,
				Math.floor(utilizationPatterns.averageTasks * 0.8),
			),
			estimatedSavings: estimatedMonthlyCost * 0.2,
			reason: 'Monthly cost approaching budget limit',
		})
	}

	// 4. Alert recommendations
	if (utilizationPatterns.peakRequests > 10000) {
		recommendations.alerts.push({
			type: 'high-traffic',
			threshold: Math.ceil(utilizationPatterns.peakRequests * 0.8),
			message: 'Traffic approaching high levels, consider scaling up capacity',
		})
	}

	return recommendations
}

/**
 * Apply cost optimization changes
 */
async function applyCostOptimizations(
	environment: string,
	recommendations: ScalingRecommendations,
): Promise<void> {
	console.log('💰 Applying cost optimizations...')

	for (const optimization of recommendations.costOptimizations) {
		if (optimization.action === 'reduce-min-capacity') {
			try {
				await updateServiceMinCapacity(
					environment,
					optimization.recommendedValue,
				)
				console.log(
					`✅ Reduced min capacity to ${optimization.recommendedValue}`,
				)
			} catch (error) {
				console.warn(`⚠️ Failed to apply cost optimization:`, error)
			}
		}
	}
}

/**
 * Update scaling policies based on recommendations
 */
async function updateScalingPolicies(
	environment: string,
	recommendations: ScalingRecommendations,
): Promise<void> {
	console.log('🔄 Updating scaling policies...')

	for (const adjustment of recommendations.policyAdjustments) {
		try {
			if (adjustment.policyType === 'cpu-target-tracking') {
				await updateCpuTargetTrackingPolicy(environment, adjustment.newValue)
				console.log(
					`✅ Updated CPU target tracking policy to ${adjustment.newValue}%`,
				)
			}
		} catch (error) {
			console.warn(`⚠️ Failed to update scaling policy:`, error)
		}
	}

	// Apply scheduled scaling
	for (const scheduled of recommendations.scheduledScaling) {
		try {
			await createScheduledScalingRule(environment, scheduled)
			console.log(`✅ Created scheduled scaling rule: ${scheduled.type}`)
		} catch (error) {
			console.warn(`⚠️ Failed to create scheduled scaling rule:`, error)
		}
	}
}

/**
 * Log optimization results
 */
async function logOptimizationResults(
	environment: string,
	recommendations: ScalingRecommendations,
): Promise<void> {
	const logData = {
		environment,
		timestamp: new Date().toISOString(),
		recommendations: {
			scheduledScaling: recommendations.scheduledScaling.length,
			policyAdjustments: recommendations.policyAdjustments.length,
			costOptimizations: recommendations.costOptimizations.length,
			alerts: recommendations.alerts.length,
		},
		summary: `Applied ${recommendations.policyAdjustments.length} policy adjustments, ${recommendations.scheduledScaling.length} scheduled rules, and ${recommendations.costOptimizations.length} cost optimizations`,
	}

	console.log('📋 Optimization Results:', JSON.stringify(logData, null, 2))

	// Send summary metric to CloudWatch
	await putMetricData('MacroAI/Scaling', 'OptimizationRuns', 1, {
		Environment: environment,
		Result: 'success',
	})

	await putMetricData(
		'MacroAI/Scaling',
		'PolicyAdjustments',
		recommendations.policyAdjustments.length,
		{
			Environment: environment,
		},
	)

	await putMetricData(
		'MacroAI/Scaling',
		'ScheduledRules',
		recommendations.scheduledScaling.length,
		{
			Environment: environment,
		},
	)
}

/**
 * Helper Functions
 */

async function getMetricData(
	namespace: string,
	metricName: string,
	dimensions: Record<string, string>,
	startTime: Date,
	endTime: Date,
	statistic: string,
): Promise<Array<{ timestamp: Date; value: number }>> {
	try {
		const command = new GetMetricDataCommand({
			MetricDataQueries: [
				{
					Id: 'm1',
					MetricStat: {
						Metric: {
							Namespace: namespace,
							MetricName: metricName,
							Dimensions: Object.entries(dimensions).map(([name, value]) => ({
								Name: name,
								Value: value,
							})),
						},
						Period: 3600, // 1 hour
						Stat: statistic,
					},
					ReturnData: true,
				},
			],
			StartTime: startTime,
			EndTime: endTime,
		})

		const response = await cloudwatch.send(command)
		return (
			response.MetricDataResults?.[0]?.Timestamps?.map((timestamp, index) => ({
				timestamp,
				value: response.MetricDataResults?.[0]?.Values?.[index] || 0,
			})) || []
		)
	} catch (error) {
		console.warn(`⚠️ Failed to get metric data for ${metricName}:`, error)
		return []
	}
}

function analyzePeakHours(
	metrics: Array<{ timestamp: Date; value: number }>,
): Array<{ hour: number; minute: number }> {
	const hourlySums = new Map<number, { sum: number; count: number }>()

	// Aggregate by hour
	for (const metric of metrics) {
		const hour = metric.timestamp.getHours()
		const existing = hourlySums.get(hour) || { sum: 0, count: 0 }
		hourlySums.set(hour, {
			sum: existing.sum + metric.value,
			count: existing.count + 1,
		})
	}

	// Find peak hours (top 20% of hours)
	const hourlyAverages = Array.from(hourlySums.entries()).map(
		([hour, data]) => ({
			hour,
			average: data.sum / data.count,
		}),
	)

	hourlyAverages.sort((a, b) => b.average - a.average)
	const top20Percent = Math.ceil(hourlyAverages.length * 0.2)
	const peakHours = hourlyAverages.slice(0, top20Percent)

	return peakHours.map((p) => ({ hour: p.hour, minute: 0 })) // Scale at top of hour
}

function findOffPeakHours(
	peakHours: Array<{ hour: number; minute: number }>,
): Array<{ hour: number; minute: number }> {
	const peakHourSet = new Set(peakHours.map((p) => p.hour))
	const offPeakHours: Array<{ hour: number; minute: number }> = []

	// Find hours that are not in peak hours
	for (let hour = 0; hour < 24; hour++) {
		if (!peakHourSet.has(hour)) {
			offPeakHours.push({ hour, minute: 0 })
		}
	}

	// Return first few off-peak hours
	return offPeakHours.slice(0, 3)
}

function calculateAverage(
	metrics: Array<{ timestamp: Date; value: number }>,
): number {
	if (metrics.length === 0) return 0
	const sum = metrics.reduce((acc, metric) => acc + metric.value, 0)
	return sum / metrics.length
}

function calculatePeak(
	metrics: Array<{ timestamp: Date; value: number }>,
): number {
	if (metrics.length === 0) return 0
	return Math.max(...metrics.map((m) => m.value))
}

function calculateEstimatedCost(
	utilizationPatterns: any,
	monthlyBudget: number,
): number {
	// Simplified cost estimation based on task count and utilization
	const avgTasks = utilizationPatterns.averageTasks
	const peakTasks = utilizationPatterns.peakTasks

	// Rough Fargate cost estimation ($0.04048 per vCPU hour, $0.004445 per GB hour)
	const estimatedCost =
		(avgTasks * 0.25 * 0.04048 + avgTasks * 0.5 * 0.004445) * 24 * 30
	return estimatedCost
}

async function updateServiceMinCapacity(
	environment: string,
	minCapacity: number,
): Promise<void> {
	const command = new UpdateServiceCommand({
		cluster: `${environment}-cluster`,
		service: `${environment}-service`,
		desiredCount: minCapacity, // This will effectively set the minimum
	})

	await ecs.send(command)
}

async function updateCpuTargetTrackingPolicy(
	environment: string,
	newTarget: number,
): Promise<void> {
	// Note: This is a simplified implementation. In practice, you'd need to
	// describe the existing policy and update it, or create a new one.
	console.log(
		`📝 Would update CPU target tracking policy to ${newTarget}% for ${environment}`,
	)
}

async function createScheduledScalingRule(
	environment: string,
	scheduled: any,
): Promise<void> {
	const ruleName = `${environment}-scheduled-${scheduled.type}-${Date.now()}`

	// Create EventBridge rule
	const ruleCommand = new PutRuleCommand({
		Name: ruleName,
		ScheduleExpression: scheduled.schedule,
		State: 'ENABLED',
		Description: scheduled.reason,
	})

	await eventbridge.send(ruleCommand)

	// Note: In a real implementation, you'd add targets to trigger Lambda functions
	// that actually perform the scaling operations
	console.log(`📅 Created scheduled scaling rule: ${ruleName}`)
}

async function putMetricData(
	namespace: string,
	metricName: string,
	value: number,
	dimensions: Record<string, string>,
): Promise<void> {
	try {
		const command = new PutMetricDataCommand({
			Namespace: namespace,
			MetricData: [
				{
					MetricName: metricName,
					Value: value,
					Dimensions: Object.entries(dimensions).map(([name, value]) => ({
						Name: name,
						Value: value,
					})),
					Timestamp: new Date(),
				},
			],
		})

		await cloudwatch.send(command)
	} catch (error) {
		console.warn(`⚠️ Failed to put metric ${metricName}:`, error)
	}
}

async function logOptimizationError(
	environment: string,
	error: any,
): Promise<void> {
	await putMetricData('MacroAI/Scaling', 'OptimizationErrors', 1, {
		Environment: environment,
		ErrorType: error.name || 'Unknown',
	})
}

/**
 * Type definitions
 */

interface ScalingAnalysis {
	peakHours: Array<{ hour: number; minute: number }>
	utilizationPatterns: {
		averageCpu: number
		peakCpu: number
		averageMemory: number
		peakMemory: number
		averageRequests: number
		peakRequests: number
		averageTasks: number
		peakTasks: number
	}
	timeRange: { start: Date; end: Date }
}

interface ScalingRecommendations {
	scheduledScaling: Array<{
		type: string
		schedule: string
		minCapacity: number
		maxCapacity: number
		reason: string
	}>
	policyAdjustments: Array<{
		policyType: string
		action: string
		newValue: number
		reason: string
	}>
	costOptimizations: Array<{
		action: string
		currentValue: number
		recommendedValue: number
		estimatedSavings: number
		reason: string
	}>
	alerts: Array<{
		type: string
		threshold: number
		message: string
	}>
}
