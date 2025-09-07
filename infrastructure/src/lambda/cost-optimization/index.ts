import {
	CloudWatchClient,
	GetMetricDataCommand,
} from '@aws-sdk/client-cloudwatch'
import {
	CostExplorerClient,
	GetCostAndUsageCommand,
} from '@aws-sdk/client-cost-explorer'
import { EC2Client, DescribeInstancesCommand } from '@aws-sdk/client-ec2'
import {
	ElasticLoadBalancingV2Client,
	DescribeLoadBalancersCommand,
} from '@aws-sdk/client-elastic-load-balancing-v2'

interface CostOptimizationEvent {
	environment: string
	budgetThreshold: number
	currentSpend: number
	budgetLimit: number
}

interface CostRecommendation {
	type:
		| 'instance_rightsizing'
		| 'unused_resources'
		| 'reserved_instances'
		| 'storage_optimization'
	priority: 'high' | 'medium' | 'low'
	savings: number
	description: string
	action: string
	resourceId?: string
	service: string
}

export const handler = async (event: CostOptimizationEvent) => {
	console.log('🧠 Starting cost optimization analysis:', event)

	const { environment, currentSpend, budgetLimit } = event

	const recommendations: CostRecommendation[] = []

	try {
		// Initialize AWS clients
		const cloudWatch = new CloudWatchClient({ region: process.env.AWS_REGION })
		const costExplorer = new CostExplorerClient({
			region: process.env.AWS_REGION,
		})
		const ec2 = new EC2Client({ region: process.env.AWS_REGION })
		const elbv2 = new ElasticLoadBalancingV2Client({
			region: process.env.AWS_REGION,
		})

		// Analyze EC2 instances for rightsizing
		const ec2Recommendations = await analyzeEC2Instances(ec2, cloudWatch)
		recommendations.push(...ec2Recommendations)

		// Analyze unused EBS volumes
		const ebsRecommendations = await analyzeEBSVolumes(costExplorer)
		recommendations.push(...ebsRecommendations)

		// Analyze Load Balancer utilization
		const elbRecommendations = await analyzeLoadBalancers(elbv2, cloudWatch)
		recommendations.push(...elbRecommendations)

		// Analyze Reserved Instance opportunities
		const riRecommendations = await analyzeReservedInstances(costExplorer)
		recommendations.push(...riRecommendations)

		// Generate summary
		const summary = generateOptimizationSummary(
			recommendations,
			currentSpend,
			budgetLimit,
		)

		console.log('✅ Cost optimization analysis completed:', summary)

		return {
			statusCode: 200,
			body: JSON.stringify({
				environment,
				analysisTimestamp: new Date().toISOString(),
				budgetUtilization: (currentSpend / budgetLimit) * 100,
				totalRecommendations: recommendations.length,
				estimatedSavings: recommendations.reduce(
					(sum: number, rec: CostRecommendation) => sum + rec.savings,
					0,
				),
				recommendations,
				summary,
			}),
		}
	} catch (error: unknown) {
		console.error('❌ Cost optimization analysis failed:', error)
		return {
			statusCode: 500,
			body: JSON.stringify({
				error: 'Cost optimization analysis failed',
				message: error instanceof Error ? error.message : String(error),
			}),
		}
	}
}

async function analyzeEC2Instances(
	ec2: EC2Client,
	cloudWatch: CloudWatchClient,
): Promise<CostRecommendation[]> {
	const recommendations: CostRecommendation[] = []

	try {
		// Get running instances
		const instancesResponse = await ec2.send(
			new DescribeInstancesCommand({
				Filters: [{ Name: 'instance-state-name', Values: ['running'] }],
			}),
		)

		for (const reservation of instancesResponse.Reservations || []) {
			for (const instance of reservation.Instances || []) {
				const instanceId = instance.InstanceId!
				const instanceType = instance.InstanceType!

				// Get CPU utilization metrics
				const cpuMetrics = await cloudWatch.send(
					new GetMetricDataCommand({
						MetricDataQueries: [
							{
								Id: 'cpu_util',
								MetricStat: {
									Metric: {
										Namespace: 'AWS/EC2',
										MetricName: 'CPUUtilization',
										Dimensions: [
											{
												Name: 'InstanceId',
												Value: instanceId,
											},
										],
									},
									Period: 3600, // 1 hour
									Stat: 'Average',
								},
							},
						],
						StartTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
						EndTime: new Date(),
					}),
				)

				const avgCpu =
					cpuMetrics.MetricDataResults?.[0]?.Values?.reduce(
						(sum: number, val: number) => sum + val,
						0,
					) || 0
				const cpuUtilization =
					avgCpu / (cpuMetrics.MetricDataResults?.[0]?.Values?.length || 1)

				// Analyze CPU utilization for rightsizing
				if (cpuUtilization < 20) {
					recommendations.push({
						type: 'instance_rightsizing',
						priority: 'medium',
						savings: estimateInstanceSavings(instanceType, 'downsize'),
						description: `Instance ${instanceId} has low CPU utilization (${cpuUtilization.toFixed(1)}%)`,
						action: `Consider downsizing from ${instanceType} to a smaller instance type`,
						resourceId: instanceId,
						service: 'EC2',
					})
				} else if (cpuUtilization > 80) {
					recommendations.push({
						type: 'instance_rightsizing',
						priority: 'high',
						savings: estimateInstanceSavings(instanceType, 'upsize'),
						description: `Instance ${instanceId} has high CPU utilization (${cpuUtilization.toFixed(1)}%)`,
						action: `Consider upsizing from ${instanceType} for better performance`,
						resourceId: instanceId,
						service: 'EC2',
					})
				}
			}
		}
	} catch (error) {
		console.warn('Failed to analyze EC2 instances:', error)
	}

	return recommendations
}

async function analyzeEBSVolumes(
	costExplorer: CostExplorerClient,
): Promise<CostRecommendation[]> {
	const recommendations: CostRecommendation[] = []

	try {
		// Get EBS cost data for the last 30 days
		const costResponse = await costExplorer.send(
			new GetCostAndUsageCommand({
				TimePeriod: {
					Start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
						.toISOString()
						.split('T')[0],
					End: new Date().toISOString().split('T')[0],
				},
				Granularity: 'DAILY',
				Metrics: ['BlendedCost'],
				GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
				Filter: {
					Dimensions: {
						Key: 'SERVICE',
						Values: ['Amazon Elastic Compute Cloud - Compute'],
					},
				},
			}),
		)

		// Analyze for unused or underutilized EBS volumes
		// This is a simplified analysis - in production, you'd want more detailed metrics
		const totalEbsCost = costResponse.ResultsByTime?.[0]?.Groups?.find(
			(group: Record<string, unknown>) =>
				Array.isArray(group.Keys) &&
				typeof group.Keys[0] === 'string' &&
				group.Keys[0].includes('EBS'),
		)?.Metrics?.BlendedCost?.Amount

		if (totalEbsCost && parseFloat(totalEbsCost) > 50) {
			recommendations.push({
				type: 'storage_optimization',
				priority: 'medium',
				savings: parseFloat(totalEbsCost) * 0.3, // Estimate 30% savings
				description: `High EBS storage costs detected ($${totalEbsCost}/month)`,
				action:
					'Review EBS volumes for unused storage and optimize snapshot schedules',
				service: 'EBS',
			})
		}
	} catch (error) {
		console.warn('Failed to analyze EBS volumes:', error)
	}

	return recommendations
}

async function analyzeLoadBalancers(
	elbv2: ElasticLoadBalancingV2Client,
	cloudWatch: CloudWatchClient,
): Promise<CostRecommendation[]> {
	const recommendations: CostRecommendation[] = []

	try {
		const lbsResponse = await elbv2.send(new DescribeLoadBalancersCommand({}))

		for (const lb of lbsResponse.LoadBalancers || []) {
			// Get request count metrics
			const requestMetrics = await cloudWatch.send(
				new GetMetricDataCommand({
					MetricDataQueries: [
						{
							Id: 'request_count',
							MetricStat: {
								Metric: {
									Namespace: 'AWS/ApplicationELB',
									MetricName: 'RequestCount',
									Dimensions: [
										{
											Name: 'LoadBalancer',
											Value: lb.DNSName!,
										},
									],
								},
								Period: 86400, // 1 day
								Stat: 'Sum',
							},
						},
					],
					StartTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
					EndTime: new Date(),
				}),
			)

			const avgRequests =
				requestMetrics.MetricDataResults?.[0]?.Values?.reduce(
					(sum: number, val: number) => sum + val,
					0,
				) || 0
			const dailyRequests = avgRequests / 7

			// Low traffic load balancer
			if (dailyRequests < 100) {
				recommendations.push({
					type: 'unused_resources',
					priority: 'low',
					savings: 25, // Estimated monthly savings for ALB
					description: `Load balancer ${lb.DNSName} has low traffic (${dailyRequests.toFixed(0)} requests/day)`,
					action:
						'Consider removing unused load balancer or consolidating services',
					resourceId: lb.DNSName,
					service: 'ELB',
				})
			}
		}
	} catch (error) {
		console.warn('Failed to analyze load balancers:', error)
	}

	return recommendations
}

async function analyzeReservedInstances(
	costExplorer: CostExplorerClient,
): Promise<CostRecommendation[]> {
	const recommendations: CostRecommendation[] = []

	try {
		// Get on-demand vs reserved instance costs
		const costResponse = await costExplorer.send(
			new GetCostAndUsageCommand({
				TimePeriod: {
					Start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
						.toISOString()
						.split('T')[0],
					End: new Date().toISOString().split('T')[0],
				},
				Granularity: 'MONTHLY',
				Metrics: ['BlendedCost'],
				GroupBy: [{ Type: 'DIMENSION', Key: 'PURCHASE_TYPE' }],
			}),
		)

		const onDemandCost = costResponse.ResultsByTime?.[0]?.Groups?.find(
			(group: Record<string, unknown>) =>
				Array.isArray(group.Keys) && group.Keys[0] === 'OnDemand',
		)?.Metrics?.BlendedCost?.Amount

		if (onDemandCost && parseFloat(onDemandCost) > 100) {
			const potentialSavings = parseFloat(onDemandCost) * 0.3 // Estimate 30% savings with RI
			recommendations.push({
				type: 'reserved_instances',
				priority: 'high',
				savings: potentialSavings,
				description: `High on-demand EC2 costs detected ($${onDemandCost}/month)`,
				action: 'Consider purchasing Reserved Instances for steady workloads',
				service: 'EC2',
			})
		}
	} catch (error) {
		console.warn('Failed to analyze reserved instances:', error)
	}

	return recommendations
}

function estimateInstanceSavings(
	instanceType: string,
	action: 'upsize' | 'downsize',
): number {
	// Simplified cost estimation - in production, you'd use AWS pricing API
	const baseCosts: Record<string, number> = {
		't2.micro': 10,
		't2.small': 20,
		't2.medium': 40,
		't3.micro': 8,
		't3.small': 16,
		't3.medium': 32,
		'm5.large': 80,
		'm5.xlarge': 160,
		'm5.2xlarge': 320,
	}

	const currentCost = baseCosts[instanceType] || 50

	if (action === 'downsize') {
		return currentCost * 0.5 // Assume 50% savings when downsizing
	} else {
		return -currentCost * 0.2 // Negative savings (cost increase) when upsizing
	}
}

function generateOptimizationSummary(
	recommendations: CostRecommendation[],
	currentSpend: number,
	budgetLimit: number,
): Record<string, unknown> {
	const highPriority = recommendations.filter((r) => r.priority === 'high')
	const mediumPriority = recommendations.filter((r) => r.priority === 'medium')
	const lowPriority = recommendations.filter((r) => r.priority === 'low')

	const totalSavings = recommendations.reduce(
		(sum: number, rec: CostRecommendation) => sum + rec.savings,
		0,
	)
	const budgetUtilization = (currentSpend / budgetLimit) * 100

	return {
		budgetUtilization: budgetUtilization.toFixed(1),
		totalRecommendations: recommendations.length,
		highPriorityCount: highPriority.length,
		mediumPriorityCount: mediumPriority.length,
		lowPriorityCount: lowPriority.length,
		estimatedMonthlySavings: totalSavings.toFixed(2),
		savingsPercentage: ((totalSavings / currentSpend) * 100).toFixed(1),
		quickWins: recommendations
			.filter((r) => r.priority === 'high' && r.savings > 50)
			.map((r) => ({
				service: r.service,
				savings: r.savings.toFixed(2),
				action: r.action,
			})),
	}
}
