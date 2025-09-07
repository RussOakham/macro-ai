/* eslint-disable security-node/detect-insecure-randomness */
import {
	CloudWatchClient,
	PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch'
import {
	ElasticLoadBalancingV2Client,
	DescribeTargetHealthCommand,
} from '@aws-sdk/client-elastic-load-balancing-v2'
import type { Context } from 'aws-lambda'

const cloudwatch = new CloudWatchClient({})
const elbv2 = new ElasticLoadBalancingV2Client({})

interface CustomMetricsEvent {
	// EventBridge scheduled event
	source: string
	detail: unknown
}

export async function handler(
	event: CustomMetricsEvent,
	context: Context,
): Promise<void> {
	console.log('🔍 Custom Metrics Collection Started')
	console.log('Event:', JSON.stringify(event, null, 2))

	try {
		const environmentName = process.env.ENVIRONMENT_NAME || 'development'
		const loadBalancerArn = process.env.LOAD_BALANCER_ARN || ''

		// Collect application metrics
		await collectApplicationMetrics(environmentName)

		// Collect infrastructure metrics
		await collectInfrastructureMetrics(environmentName, loadBalancerArn)

		// Collect performance metrics
		await collectPerformanceMetrics(environmentName)

		console.log('✅ Custom metrics collection completed successfully')
	} catch (error) {
		console.error('❌ Error collecting custom metrics:', error)

		// Send error metric to CloudWatch
		await putMetricData('MacroAI/Monitoring', 'CollectionError', 1, {
			Environment: process.env.ENVIRONMENT_NAME || 'unknown',
			Service: 'custom-metrics-lambda',
		})

		throw error
	}
}

/**
 * Collect application-specific metrics
 */
async function collectApplicationMetrics(
	environmentName: string,
): Promise<void> {
	console.log('📊 Collecting application metrics...')

	// Note: In a real implementation, these metrics would come from:
	// - Application logs analysis
	// - Custom application instrumentation
	// - Database query metrics
	// - External service response times

	// For now, we'll simulate some metrics
	const metrics = [
		{
			name: 'ActiveConnections',
			value: Math.floor(Math.random() * 100) + 50,
			dimensions: {
				Environment: environmentName,
				Service: 'api',
			},
		},
		{
			name: 'QueueDepth',
			value: Math.floor(Math.random() * 20),
			dimensions: {
				Environment: environmentName,
				Service: 'api',
			},
		},
		{
			name: 'CacheHitRate',
			value: Math.random() * 100,
			dimensions: {
				Environment: environmentName,
				Service: 'cache',
			},
		},
	]

	for (const metric of metrics) {
		await putMetricData(
			'MacroAI/Application',
			metric.name,
			metric.value,
			metric.dimensions,
		)
	}

	console.log(`✅ Collected ${metrics.length} application metrics`)
}

/**
 * Collect infrastructure-related metrics
 */
async function collectInfrastructureMetrics(
	environmentName: string,
	loadBalancerArn: string,
): Promise<void> {
	console.log('🏗️ Collecting infrastructure metrics...')

	try {
		// Target group health metrics
		if (loadBalancerArn) {
			const targetHealth = await elbv2.send(
				new DescribeTargetHealthCommand({
					TargetGroupArn: loadBalancerArn.replace(
						'loadbalancer',
						'targetgroup',
					), // Approximate mapping
				}),
			)

			const healthyCount =
				targetHealth.TargetHealthDescriptions?.filter(
					(desc) => desc.TargetHealth?.State === 'healthy',
				).length || 0

			const totalCount = targetHealth.TargetHealthDescriptions?.length || 0

			await putMetricData(
				'MacroAI/Infrastructure',
				'HealthyTargets',
				healthyCount,
				{
					Environment: environmentName,
					Service: 'load-balancer',
				},
			)

			await putMetricData(
				'MacroAI/Infrastructure',
				'TotalTargets',
				totalCount,
				{
					Environment: environmentName,
					Service: 'load-balancer',
				},
			)
		}

		// ECS service metrics
		const ecsMetrics = await collectECSMetrics(environmentName)
		for (const metric of ecsMetrics) {
			await putMetricData(
				'MacroAI/Infrastructure',
				metric.name,
				metric.value,
				metric.dimensions,
			)
		}

		console.log('✅ Infrastructure metrics collected')
	} catch (error) {
		console.warn('⚠️ Failed to collect infrastructure metrics:', error)
	}
}

/**
 * Collect ECS-specific metrics
 */
async function collectECSMetrics(
	environmentName: string,
): Promise<
	Array<{ name: string; value: number; dimensions: Record<string, string> }>
> {
	const metrics: Array<{
		name: string
		value: number
		dimensions: Record<string, string>
	}> = []

	try {
		const serviceResponse = await ecs.send(
			new DescribeServicesCommand({
				cluster: `${environmentName}-cluster`,
				services: [`${environmentName}-service`],
			}),
		)

		const service = serviceResponse.services?.[0]
		if (service) {
			metrics.push({
				name: 'DesiredTaskCount',
				value: service.desiredCount || 0,
				dimensions: {
					Environment: environmentName,
					Service: 'ecs',
				},
			})

			metrics.push({
				name: 'RunningTaskCount',
				value: service.runningCount || 0,
				dimensions: {
					Environment: environmentName,
					Service: 'ecs',
				},
			})

			metrics.push({
				name: 'PendingTaskCount',
				value: service.pendingCount || 0,
				dimensions: {
					Environment: environmentName,
					Service: 'ecs',
				},
			})
		}
	} catch (error) {
		console.warn('⚠️ Failed to collect ECS metrics:', error)
	}

	return metrics
}

/**
 * Collect performance-related metrics
 */
async function collectPerformanceMetrics(
	environmentName: string,
): Promise<void> {
	console.log('⚡ Collecting performance metrics...')

	// Simulate performance metrics (in real app, these would come from application)
	const performanceMetrics = [
		{
			name: 'AverageResponseTime',
			value: Math.floor(Math.random() * 1000) + 200, // 200-1200ms
			dimensions: {
				Environment: environmentName,
				Service: 'api',
				Endpoint: '/api/v1',
			},
		},
		{
			name: 'P95ResponseTime',
			value: Math.floor(Math.random() * 2000) + 500, // 500-2500ms
			dimensions: {
				Environment: environmentName,
				Service: 'api',
				Endpoint: '/api/v1',
			},
		},
		{
			name: 'ErrorRate',
			value: Math.random() * 5, // 0-5% error rate
			dimensions: {
				Environment: environmentName,
				Service: 'api',
			},
		},
		{
			name: 'Throughput',
			value: Math.floor(Math.random() * 1000) + 100, // 100-1100 requests/minute
			dimensions: {
				Environment: environmentName,
				Service: 'api',
			},
		},
	]

	for (const metric of performanceMetrics) {
		await putMetricData(
			'MacroAI/Performance',
			metric.name,
			metric.value,
			metric.dimensions,
		)
	}

	console.log(`✅ Collected ${performanceMetrics.length} performance metrics`)
}

/**
 * Helper function to send metrics to CloudWatch
 */
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
					Unit: getMetricUnit(metricName),
				},
			],
		})

		await cloudwatch.send(command)
		console.log(`📤 Sent metric: ${namespace}/${metricName} = ${value}`)
	} catch (error) {
		console.error(`❌ Failed to send metric ${metricName}:`, error)
		throw error
	}
}

/**
 * Get appropriate CloudWatch unit for metric
 */
function getMetricUnit(metricName: string): string {
	const unitMap: Record<string, string> = {
		ActiveConnections: 'Count',
		QueueDepth: 'Count',
		CacheHitRate: 'Percent',
		HealthyTargets: 'Count',
		TotalTargets: 'Count',
		DesiredTaskCount: 'Count',
		RunningTaskCount: 'Count',
		PendingTaskCount: 'Count',
		AverageResponseTime: 'Milliseconds',
		P95ResponseTime: 'Milliseconds',
		ErrorRate: 'Percent',
		Throughput: 'Count/Second',
		CollectionError: 'Count',
	}

	return unitMap[metricName] || 'Count'
}
