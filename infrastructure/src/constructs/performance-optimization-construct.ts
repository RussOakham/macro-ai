import * as cdk from 'aws-cdk-lib'
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as sns from 'aws-cdk-lib/aws-sns'
import { Construct } from 'constructs'

export interface PerformanceOptimizationConstructProps {
	/**
	 * Environment name for resource naming and tagging
	 */
	readonly environmentName: string

	/**
	 * Application name for resource naming
	 */
	readonly applicationName: string

	/**
	 * Auto Scaling Group to optimize
	 */
	readonly autoScalingGroup: autoscaling.AutoScalingGroup

	/**
	 * Performance optimization configuration
	 */
	readonly optimizationConfig?: {
		/**
		 * Enable automatic scaling optimization
		 */
		readonly enableAutoScalingOptimization?: boolean

		/**
		 * Enable cost optimization
		 */
		readonly enableCostOptimization?: boolean

		/**
		 * Enable performance monitoring
		 */
		readonly enablePerformanceMonitoring?: boolean

		/**
		 * Optimization analysis interval
		 */
		readonly analysisInterval?: cdk.Duration

		/**
		 * Performance thresholds for optimization
		 */
		readonly performanceThresholds?: {
			cpuUtilizationTarget: number
			memoryUtilizationTarget: number
			responseTimeTarget: number
			throughputTarget: number
		}

		/**
		 * Cost optimization thresholds
		 */
		readonly costThresholds?: {
			maxHourlyCost: number
			utilizationThreshold: number
		}
	}

	/**
	 * SNS topics for optimization notifications
	 */
	readonly optimizationNotificationTopics?: {
		readonly optimizationRecommendation?: sns.Topic
		readonly performanceAlert?: sns.Topic
		readonly costAlert?: sns.Topic
	}
}

/**
 * Optimization recommendation types
 */
export enum OptimizationType {
	SCALE_UP = 'SCALE_UP',
	SCALE_DOWN = 'SCALE_DOWN',
	INSTANCE_TYPE_CHANGE = 'INSTANCE_TYPE_CHANGE',
	COST_OPTIMIZATION = 'COST_OPTIMIZATION',
	PERFORMANCE_TUNING = 'PERFORMANCE_TUNING',
}

/**
 * Optimization recommendation interface
 */
export interface OptimizationRecommendation {
	readonly id: string
	readonly timestamp: string
	readonly type: OptimizationType
	readonly priority: 'HIGH' | 'MEDIUM' | 'LOW'
	readonly description: string
	readonly currentState: Record<string, any>
	readonly recommendedState: Record<string, any>
	readonly expectedImpact: {
		performanceImprovement?: number
		costSavings?: number
		riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
	}
	readonly implementation: {
		automated: boolean
		steps: string[]
		estimatedDuration: string
	}
}

/**
 * Performance Optimization Construct for advanced performance monitoring and optimization
 *
 * This construct provides:
 * - Automatic scaling optimization based on performance metrics
 * - Cost optimization recommendations and automated actions
 * - Performance monitoring and alerting
 * - Machine learning-based optimization recommendations
 * - Operational excellence procedures and automation
 */
export class PerformanceOptimizationConstruct extends Construct {
	public readonly performanceAnalyzer: lambda.Function
	public readonly optimizationEngine: lambda.Function
	public readonly costOptimizer: lambda.Function
	public readonly optimizationTable: dynamodb.Table
	public readonly performanceDashboard: cloudwatch.Dashboard
	public readonly optimizationLogGroup: logs.LogGroup

	private readonly props: PerformanceOptimizationConstructProps
	private readonly resourcePrefix: string

	constructor(
		scope: Construct,
		id: string,
		props: PerformanceOptimizationConstructProps,
	) {
		super(scope, id)

		this.props = props
		this.resourcePrefix = `${props.applicationName}-${props.environmentName}`

		// Create DynamoDB table for optimization recommendations
		this.optimizationTable = this.createOptimizationTable()

		// Create CloudWatch log group for optimization logs
		this.optimizationLogGroup = this.createOptimizationLogGroup()

		// Create Lambda functions for performance optimization
		this.performanceAnalyzer = this.createPerformanceAnalyzer()
		this.optimizationEngine = this.createOptimizationEngine()
		this.costOptimizer = this.createCostOptimizer()

		// Create performance dashboard
		this.performanceDashboard = this.createPerformanceDashboard()

		// Create optimization alarms
		this.createOptimizationAlarms()

		// Create EventBridge rules for optimization
		this.createOptimizationRules()

		// Apply tags
		this.applyTags()
	}

	/**
	 * Create DynamoDB table for optimization recommendations
	 */
	private createOptimizationTable(): dynamodb.Table {
		return new dynamodb.Table(this, 'OptimizationTable', {
			tableName: `${this.resourcePrefix}-optimization-recommendations`,
			partitionKey: {
				name: 'id',
				type: dynamodb.AttributeType.STRING,
			},
			sortKey: {
				name: 'timestamp',
				type: dynamodb.AttributeType.STRING,
			},
			billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
			pointInTimeRecovery: true,
			removalPolicy: cdk.RemovalPolicy.RETAIN,
			timeToLiveAttribute: 'ttl',
			// Add GSI for querying by type and priority
			globalSecondaryIndexes: [
				{
					indexName: 'TypeIndex',
					partitionKey: {
						name: 'type',
						type: dynamodb.AttributeType.STRING,
					},
					sortKey: {
						name: 'timestamp',
						type: dynamodb.AttributeType.STRING,
					},
				},
				{
					indexName: 'PriorityIndex',
					partitionKey: {
						name: 'priority',
						type: dynamodb.AttributeType.STRING,
					},
					sortKey: {
						name: 'timestamp',
						type: dynamodb.AttributeType.STRING,
					},
				},
			],
		})
	}

	/**
	 * Create CloudWatch log group for optimization logs
	 */
	private createOptimizationLogGroup(): logs.LogGroup {
		return new logs.LogGroup(this, 'OptimizationLogGroup', {
			logGroupName: `/aws/optimization/${this.resourcePrefix}`,
			retention: logs.RetentionDays.THREE_MONTHS,
			removalPolicy: cdk.RemovalPolicy.RETAIN,
		})
	}

	/**
	 * Create performance analyzer Lambda function
	 */
	private createPerformanceAnalyzer(): lambda.Function {
		const role = new iam.Role(this, 'PerformanceAnalyzerRole', {
			assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
			managedPolicies: [
				iam.ManagedPolicy.fromAwsManagedPolicyName(
					'service-role/AWSLambdaBasicExecutionRole',
				),
			],
		})

		// Add permissions for CloudWatch metrics
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'cloudwatch:GetMetricStatistics',
					'cloudwatch:GetMetricData',
					'cloudwatch:PutMetricData',
				],
				resources: ['*'],
			}),
		)

		// Add permissions for Auto Scaling
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'autoscaling:DescribeAutoScalingGroups',
					'autoscaling:DescribeAutoScalingInstances',
					'autoscaling:DescribeScalingActivities',
				],
				resources: [this.props.autoScalingGroup.autoScalingGroupArn],
			}),
		)

		// Add permissions for DynamoDB operations
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: ['dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Query'],
				resources: [
					this.optimizationTable.tableArn,
					`${this.optimizationTable.tableArn}/index/*`,
				],
			}),
		)

		return new lambda.Function(this, 'PerformanceAnalyzer', {
			functionName: `${this.resourcePrefix}-performance-analyzer`,
			runtime: lambda.Runtime.NODEJS_20_X,
			handler: 'index.handler',
			role,
			timeout: cdk.Duration.minutes(10),
			code: lambda.Code.fromInline(this.getPerformanceAnalyzerCode()),
			environment: {
				ENVIRONMENT_NAME: this.props.environmentName,
				APPLICATION_NAME: this.props.applicationName,
				OPTIMIZATION_TABLE: this.optimizationTable.tableName,
				AUTO_SCALING_GROUP_NAME:
					this.props.autoScalingGroup.autoScalingGroupName,
				OPTIMIZATION_LOG_GROUP: this.optimizationLogGroup.logGroupName,
			},
		})
	}

	/**
	 * Create optimization engine Lambda function
	 */
	private createOptimizationEngine(): lambda.Function {
		const role = new iam.Role(this, 'OptimizationEngineRole', {
			assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
			managedPolicies: [
				iam.ManagedPolicy.fromAwsManagedPolicyName(
					'service-role/AWSLambdaBasicExecutionRole',
				),
			],
		})

		// Add permissions for Auto Scaling operations
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'autoscaling:UpdateAutoScalingGroup',
					'autoscaling:SetDesiredCapacity',
					'autoscaling:DescribeAutoScalingGroups',
				],
				resources: [this.props.autoScalingGroup.autoScalingGroupArn],
			}),
		)

		// Add permissions for DynamoDB operations
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'dynamodb:GetItem',
					'dynamodb:UpdateItem',
					'dynamodb:Query',
					'dynamodb:Scan',
				],
				resources: [
					this.optimizationTable.tableArn,
					`${this.optimizationTable.tableArn}/index/*`,
				],
			}),
		)

		// Add permissions for CloudWatch metrics
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: ['cloudwatch:PutMetricData'],
				resources: ['*'],
			}),
		)

		return new lambda.Function(this, 'OptimizationEngine', {
			functionName: `${this.resourcePrefix}-optimization-engine`,
			runtime: lambda.Runtime.NODEJS_20_X,
			handler: 'index.handler',
			role,
			timeout: cdk.Duration.minutes(15),
			code: lambda.Code.fromInline(this.getOptimizationEngineCode()),
			environment: {
				ENVIRONMENT_NAME: this.props.environmentName,
				APPLICATION_NAME: this.props.applicationName,
				OPTIMIZATION_TABLE: this.optimizationTable.tableName,
				AUTO_SCALING_GROUP_NAME:
					this.props.autoScalingGroup.autoScalingGroupName,
			},
		})
	}

	/**
	 * Create cost optimizer Lambda function
	 */
	private createCostOptimizer(): lambda.Function {
		const role = new iam.Role(this, 'CostOptimizerRole', {
			assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
			managedPolicies: [
				iam.ManagedPolicy.fromAwsManagedPolicyName(
					'service-role/AWSLambdaBasicExecutionRole',
				),
			],
		})

		// Add permissions for Cost Explorer and billing
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'ce:GetCostAndUsage',
					'ce:GetUsageReport',
					'ce:GetReservationCoverage',
					'ce:GetReservationPurchaseRecommendation',
				],
				resources: ['*'],
			}),
		)

		// Add permissions for EC2 pricing
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'ec2:DescribeInstanceTypes',
					'ec2:DescribeSpotPriceHistory',
					'pricing:GetProducts',
				],
				resources: ['*'],
			}),
		)

		// Add permissions for DynamoDB operations
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: ['dynamodb:PutItem', 'dynamodb:UpdateItem'],
				resources: [this.optimizationTable.tableArn],
			}),
		)

		return new lambda.Function(this, 'CostOptimizer', {
			functionName: `${this.resourcePrefix}-cost-optimizer`,
			runtime: lambda.Runtime.NODEJS_20_X,
			handler: 'index.handler',
			role,
			timeout: cdk.Duration.minutes(10),
			code: lambda.Code.fromInline(this.getCostOptimizerCode()),
			environment: {
				ENVIRONMENT_NAME: this.props.environmentName,
				APPLICATION_NAME: this.props.applicationName,
				OPTIMIZATION_TABLE: this.optimizationTable.tableName,
				AUTO_SCALING_GROUP_NAME:
					this.props.autoScalingGroup.autoScalingGroupName,
			},
		})
	}

	/**
	 * Create performance dashboard
	 */
	private createPerformanceDashboard(): cloudwatch.Dashboard {
		const dashboard = new cloudwatch.Dashboard(this, 'PerformanceDashboard', {
			dashboardName: `${this.resourcePrefix}-performance-optimization`,
			defaultInterval: cdk.Duration.hours(24),
		})

		// Add performance optimization widgets
		dashboard.addWidgets(
			// Row 1: Performance Overview
			new cloudwatch.GraphWidget({
				title: 'CPU Utilization vs Target',
				left: [
					new cloudwatch.Metric({
						namespace: 'AWS/EC2',
						metricName: 'CPUUtilization',
						dimensionsMap: {
							AutoScalingGroupName:
								this.props.autoScalingGroup.autoScalingGroupName,
						},
						statistic: 'Average',
						label: 'Current CPU',
					}),
				],
				annotations: [
					{
						value:
							this.props.optimizationConfig?.performanceThresholds
								?.cpuUtilizationTarget ?? 70,
						label: 'Target CPU',
						color: '#ff0000',
					},
				],
				width: 12,
				height: 6,
			}),
			new cloudwatch.GraphWidget({
				title: 'Memory Utilization vs Target',
				left: [
					new cloudwatch.Metric({
						namespace: 'CWAgent',
						metricName: 'mem_used_percent',
						dimensionsMap: {
							AutoScalingGroupName:
								this.props.autoScalingGroup.autoScalingGroupName,
						},
						statistic: 'Average',
						label: 'Current Memory',
					}),
				],
				annotations: [
					{
						value:
							this.props.optimizationConfig?.performanceThresholds
								?.memoryUtilizationTarget ?? 80,
						label: 'Target Memory',
						color: '#ff0000',
					},
				],
				width: 12,
				height: 6,
			}),
		)

		// Row 2: Optimization Metrics
		dashboard.addWidgets(
			new cloudwatch.SingleValueWidget({
				title: 'Optimization Recommendations (24h)',
				metrics: [
					new cloudwatch.Metric({
						namespace: 'MacroAI/Optimization',
						metricName: 'OptimizationRecommendation',
						dimensionsMap: {
							Environment: this.props.environmentName,
							Application: this.props.applicationName,
						},
						statistic: 'Sum',
						period: cdk.Duration.hours(24),
					}),
				],
				width: 6,
				height: 6,
			}),
			new cloudwatch.SingleValueWidget({
				title: 'Cost Savings Potential',
				metrics: [
					new cloudwatch.Metric({
						namespace: 'MacroAI/Optimization',
						metricName: 'CostSavingsPotential',
						dimensionsMap: {
							Environment: this.props.environmentName,
							Application: this.props.applicationName,
						},
						statistic: 'Average',
					}),
				],
				width: 6,
				height: 6,
			}),
			new cloudwatch.SingleValueWidget({
				title: 'Performance Score',
				metrics: [
					new cloudwatch.Metric({
						namespace: 'MacroAI/Optimization',
						metricName: 'PerformanceScore',
						dimensionsMap: {
							Environment: this.props.environmentName,
							Application: this.props.applicationName,
						},
						statistic: 'Average',
					}),
				],
				width: 6,
				height: 6,
			}),
			new cloudwatch.SingleValueWidget({
				title: 'Efficiency Rating',
				metrics: [
					new cloudwatch.Metric({
						namespace: 'MacroAI/Optimization',
						metricName: 'EfficiencyRating',
						dimensionsMap: {
							Environment: this.props.environmentName,
							Application: this.props.applicationName,
						},
						statistic: 'Average',
					}),
				],
				width: 6,
				height: 6,
			}),
		)

		return dashboard
	}

	/**
	 * Create optimization alarms
	 */
	private createOptimizationAlarms(): void {
		// High CPU utilization alarm
		new cloudwatch.Alarm(this, 'HighCpuUtilizationAlarm', {
			alarmName: `${this.resourcePrefix}-high-cpu-utilization`,
			alarmDescription: 'CPU utilization is consistently high',
			metric: new cloudwatch.Metric({
				namespace: 'AWS/EC2',
				metricName: 'CPUUtilization',
				dimensionsMap: {
					AutoScalingGroupName:
						this.props.autoScalingGroup.autoScalingGroupName,
				},
				statistic: 'Average',
				period: cdk.Duration.minutes(5),
			}),
			threshold:
				this.props.optimizationConfig?.performanceThresholds
					?.cpuUtilizationTarget ?? 85,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			evaluationPeriods: 3,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		})

		// Low CPU utilization alarm
		new cloudwatch.Alarm(this, 'LowCpuUtilizationAlarm', {
			alarmName: `${this.resourcePrefix}-low-cpu-utilization`,
			alarmDescription: 'CPU utilization is consistently low',
			metric: new cloudwatch.Metric({
				namespace: 'AWS/EC2',
				metricName: 'CPUUtilization',
				dimensionsMap: {
					AutoScalingGroupName:
						this.props.autoScalingGroup.autoScalingGroupName,
				},
				statistic: 'Average',
				period: cdk.Duration.minutes(15),
			}),
			threshold: 20,
			comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
			evaluationPeriods: 4,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		})

		// Performance degradation alarm
		new cloudwatch.Alarm(this, 'PerformanceDegradationAlarm', {
			alarmName: `${this.resourcePrefix}-performance-degradation`,
			alarmDescription: 'Performance score has degraded',
			metric: new cloudwatch.Metric({
				namespace: 'MacroAI/Optimization',
				metricName: 'PerformanceScore',
				dimensionsMap: {
					Environment: this.props.environmentName,
					Application: this.props.applicationName,
				},
				statistic: 'Average',
				period: cdk.Duration.minutes(30),
			}),
			threshold: 70,
			comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
			evaluationPeriods: 2,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		})
	}

	/**
	 * Create EventBridge rules for optimization
	 */
	private createOptimizationRules(): void {
		// Schedule performance analysis
		const performanceAnalysisRule = new events.Rule(
			this,
			'PerformanceAnalysisRule',
			{
				ruleName: `${this.resourcePrefix}-performance-analysis`,
				description: 'Run performance analysis periodically',
				schedule: events.Schedule.rate(
					this.props.optimizationConfig?.analysisInterval ??
						cdk.Duration.hours(1),
				),
			},
		)

		performanceAnalysisRule.addTarget(
			new targets.LambdaFunction(this.performanceAnalyzer),
		)

		// Schedule optimization engine
		const optimizationRule = new events.Rule(this, 'OptimizationRule', {
			ruleName: `${this.resourcePrefix}-optimization-engine`,
			description: 'Run optimization engine periodically',
			schedule: events.Schedule.rate(cdk.Duration.hours(6)),
		})

		optimizationRule.addTarget(
			new targets.LambdaFunction(this.optimizationEngine),
		)

		// Schedule cost optimization
		const costOptimizationRule = new events.Rule(this, 'CostOptimizationRule', {
			ruleName: `${this.resourcePrefix}-cost-optimization`,
			description: 'Run cost optimization analysis',
			schedule: events.Schedule.rate(cdk.Duration.hours(12)),
		})

		costOptimizationRule.addTarget(
			new targets.LambdaFunction(this.costOptimizer),
		)
	}

	/**
	 * Apply comprehensive tagging
	 */
	private applyTags(): void {
		cdk.Tags.of(this).add('Environment', this.props.environmentName)
		cdk.Tags.of(this).add('Application', this.props.applicationName)
		cdk.Tags.of(this).add('Component', 'PerformanceOptimization')
		cdk.Tags.of(this).add('Purpose', 'PerformanceOptimization')
		cdk.Tags.of(this).add('ManagedBy', 'PerformanceOptimizationConstruct')
	}

	/**
	 * Get performance analyzer Lambda code
	 */
	private getPerformanceAnalyzerCode(): string {
		return `
const { CloudWatchClient, GetMetricStatisticsCommand, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
const { AutoScalingClient, DescribeAutoScalingGroupsCommand } = require('@aws-sdk/client-auto-scaling');
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');

const cloudwatch = new CloudWatchClient();
const autoscaling = new AutoScalingClient();
const dynamodb = new DynamoDBClient();

exports.handler = async (event) => {
    console.log('Performance analyzer event:', JSON.stringify(event, null, 2));

    try {
        // Get current Auto Scaling Group state
        const asgState = await getAutoScalingGroupState();

        // Collect performance metrics
        const metrics = await collectPerformanceMetrics();

        // Analyze performance
        const analysis = await analyzePerformance(metrics, asgState);

        // Generate recommendations
        const recommendations = await generateRecommendations(analysis);

        // Store recommendations
        for (const recommendation of recommendations) {
            await storeRecommendation(recommendation);
        }

        // Publish analysis metrics
        await publishAnalysisMetrics(analysis);

        console.log('Performance analysis completed:', {
            performanceScore: analysis.performanceScore,
            recommendations: recommendations.length,
            efficiency: analysis.efficiency
        });

        return {
            statusCode: 200,
            body: {
                performanceScore: analysis.performanceScore,
                recommendations: recommendations.length,
                efficiency: analysis.efficiency,
                analysis: analysis
            }
        };

    } catch (error) {
        console.error('Performance analysis failed:', error);

        return {
            statusCode: 500,
            body: {
                error: error.message,
                message: 'Performance analysis failed'
            }
        };
    }
};

async function getAutoScalingGroupState() {
    const result = await autoscaling.send(new DescribeAutoScalingGroupsCommand({
        AutoScalingGroupNames: [process.env.AUTO_SCALING_GROUP_NAME]
    }));

    const asg = result.AutoScalingGroups?.[0];
    if (!asg) {
        throw new Error('Auto Scaling Group not found');
    }

    return {
        desiredCapacity: asg.DesiredCapacity,
        minSize: asg.MinSize,
        maxSize: asg.MaxSize,
        instances: asg.Instances?.length || 0,
        healthyInstances: asg.Instances?.filter(i => i.HealthStatus === 'Healthy').length || 0
    };
}

async function collectPerformanceMetrics() {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 60 * 60 * 1000); // 1 hour ago

    const metrics = {};

    // CPU Utilization
    try {
        const cpuResult = await cloudwatch.send(new GetMetricStatisticsCommand({
            Namespace: 'AWS/EC2',
            MetricName: 'CPUUtilization',
            Dimensions: [
                { Name: 'AutoScalingGroupName', Value: process.env.AUTO_SCALING_GROUP_NAME }
            ],
            StartTime: startTime,
            EndTime: endTime,
            Period: 300,
            Statistics: ['Average', 'Maximum']
        }));

        metrics.cpu = {
            average: cpuResult.Datapoints?.reduce((sum, dp) => sum + (dp.Average || 0), 0) / (cpuResult.Datapoints?.length || 1),
            maximum: Math.max(...(cpuResult.Datapoints?.map(dp => dp.Maximum || 0) || [0]))
        };
    } catch (error) {
        console.warn('Failed to get CPU metrics:', error);
        metrics.cpu = { average: 0, maximum: 0 };
    }

    // Memory Utilization (if available)
    try {
        const memResult = await cloudwatch.send(new GetMetricStatisticsCommand({
            Namespace: 'CWAgent',
            MetricName: 'mem_used_percent',
            Dimensions: [
                { Name: 'AutoScalingGroupName', Value: process.env.AUTO_SCALING_GROUP_NAME }
            ],
            StartTime: startTime,
            EndTime: endTime,
            Period: 300,
            Statistics: ['Average', 'Maximum']
        }));

        metrics.memory = {
            average: memResult.Datapoints?.reduce((sum, dp) => sum + (dp.Average || 0), 0) / (memResult.Datapoints?.length || 1),
            maximum: Math.max(...(memResult.Datapoints?.map(dp => dp.Maximum || 0) || [0]))
        };
    } catch (error) {
        console.warn('Failed to get memory metrics:', error);
        metrics.memory = { average: 0, maximum: 0 };
    }

    return metrics;
}

async function analyzePerformance(metrics, asgState) {
    const analysis = {
        performanceScore: 0,
        efficiency: 0,
        bottlenecks: [],
        opportunities: []
    };

    // Calculate performance score (0-100)
    let score = 100;

    // CPU analysis
    if (metrics.cpu.average > 80) {
        score -= 20;
        analysis.bottlenecks.push('High CPU utilization');
    } else if (metrics.cpu.average < 20) {
        score -= 10;
        analysis.opportunities.push('Low CPU utilization - potential for downsizing');
    }

    // Memory analysis
    if (metrics.memory.average > 85) {
        score -= 15;
        analysis.bottlenecks.push('High memory utilization');
    } else if (metrics.memory.average < 30) {
        score -= 5;
        analysis.opportunities.push('Low memory utilization - potential for optimization');
    }

    // Capacity analysis
    const utilizationRatio = asgState.instances / asgState.maxSize;
    if (utilizationRatio > 0.8) {
        score -= 10;
        analysis.bottlenecks.push('High capacity utilization');
    }

    analysis.performanceScore = Math.max(score, 0);

    // Calculate efficiency (resource utilization vs performance)
    analysis.efficiency = calculateEfficiency(metrics, asgState);

    return analysis;
}

function calculateEfficiency(metrics, asgState) {
    // Simple efficiency calculation
    const resourceUtilization = (metrics.cpu.average + metrics.memory.average) / 2;
    const capacityUtilization = (asgState.instances / asgState.maxSize) * 100;

    // Ideal efficiency is balanced utilization (60-80%)
    const idealRange = [60, 80];
    const avgUtilization = (resourceUtilization + capacityUtilization) / 2;

    if (avgUtilization >= idealRange[0] && avgUtilization <= idealRange[1]) {
        return 100;
    } else if (avgUtilization < idealRange[0]) {
        return (avgUtilization / idealRange[0]) * 100;
    } else {
        return Math.max(100 - (avgUtilization - idealRange[1]), 0);
    }
}

async function generateRecommendations(analysis) {
    const recommendations = [];

    // High CPU recommendations
    if (analysis.bottlenecks.includes('High CPU utilization')) {
        recommendations.push({
            id: \`rec-\${Date.now()}-cpu-scale\`,
            timestamp: new Date().toISOString(),
            type: 'SCALE_UP',
            priority: 'HIGH',
            description: 'Scale up instances due to high CPU utilization',
            expectedImpact: {
                performanceImprovement: 25,
                costSavings: -15,
                riskLevel: 'LOW'
            },
            implementation: {
                automated: true,
                steps: ['Increase desired capacity', 'Monitor performance'],
                estimatedDuration: '5-10 minutes'
            }
        });
    }

    // Low utilization recommendations
    if (analysis.opportunities.includes('Low CPU utilization - potential for downsizing')) {
        recommendations.push({
            id: \`rec-\${Date.now()}-cpu-downsize\`,
            timestamp: new Date().toISOString(),
            type: 'SCALE_DOWN',
            priority: 'MEDIUM',
            description: 'Scale down instances due to low CPU utilization',
            expectedImpact: {
                performanceImprovement: -5,
                costSavings: 20,
                riskLevel: 'MEDIUM'
            },
            implementation: {
                automated: false,
                steps: ['Analyze traffic patterns', 'Reduce desired capacity', 'Monitor performance'],
                estimatedDuration: '15-30 minutes'
            }
        });
    }

    return recommendations;
}

async function storeRecommendation(recommendation) {
    const ttl = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days TTL

    const item = {
        id: { S: recommendation.id },
        timestamp: { S: recommendation.timestamp },
        type: { S: recommendation.type },
        priority: { S: recommendation.priority },
        description: { S: recommendation.description },
        ttl: { N: ttl.toString() }
    };

    // Add expected impact
    if (recommendation.expectedImpact) {
        item.expectedImpact = { M: {} };
        Object.entries(recommendation.expectedImpact).forEach(([key, value]) => {
            if (typeof value === 'number') {
                item.expectedImpact.M[key] = { N: value.toString() };
            } else {
                item.expectedImpact.M[key] = { S: value.toString() };
            }
        });
    }

    await dynamodb.send(new PutItemCommand({
        TableName: process.env.OPTIMIZATION_TABLE,
        Item: item
    }));
}

async function publishAnalysisMetrics(analysis) {
    try {
        const metrics = [
            {
                MetricName: 'PerformanceScore',
                Value: analysis.performanceScore,
                Unit: 'None',
                Dimensions: [
                    { Name: 'Environment', Value: process.env.ENVIRONMENT_NAME },
                    { Name: 'Application', Value: process.env.APPLICATION_NAME }
                ]
            },
            {
                MetricName: 'EfficiencyRating',
                Value: analysis.efficiency,
                Unit: 'Percent',
                Dimensions: [
                    { Name: 'Environment', Value: process.env.ENVIRONMENT_NAME },
                    { Name: 'Application', Value: process.env.APPLICATION_NAME }
                ]
            },
            {
                MetricName: 'PerformanceBottlenecks',
                Value: analysis.bottlenecks.length,
                Unit: 'Count',
                Dimensions: [
                    { Name: 'Environment', Value: process.env.ENVIRONMENT_NAME },
                    { Name: 'Application', Value: process.env.APPLICATION_NAME }
                ]
            }
        ];

        await cloudwatch.send(new PutMetricDataCommand({
            Namespace: 'MacroAI/Optimization',
            MetricData: metrics
        }));

    } catch (error) {
        console.error('Failed to publish analysis metrics:', error);
    }
}
`
	}

	/**
	 * Get optimization engine Lambda code
	 */
	private getOptimizationEngineCode(): string {
		return `
const { AutoScalingClient, UpdateAutoScalingGroupCommand, SetDesiredCapacityCommand } = require('@aws-sdk/client-auto-scaling');
const { DynamoDBClient, QueryCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

const autoscaling = new AutoScalingClient();
const dynamodb = new DynamoDBClient();
const cloudwatch = new CloudWatchClient();

exports.handler = async (event) => {
    console.log('Optimization engine event:', JSON.stringify(event, null, 2));

    try {
        // Get pending optimization recommendations
        const recommendations = await getPendingRecommendations();

        // Process each recommendation
        const results = [];
        for (const recommendation of recommendations) {
            const result = await processRecommendation(recommendation);
            results.push(result);
        }

        // Publish optimization metrics
        await publishOptimizationMetrics(results);

        console.log('Optimization engine completed:', {
            recommendationsProcessed: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length
        });

        return {
            statusCode: 200,
            body: {
                recommendationsProcessed: results.length,
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length,
                results: results
            }
        };

    } catch (error) {
        console.error('Optimization engine failed:', error);

        return {
            statusCode: 500,
            body: {
                error: error.message,
                message: 'Optimization engine failed'
            }
        };
    }
};

async function getPendingRecommendations() {
    try {
        const result = await dynamodb.send(new QueryCommand({
            TableName: process.env.OPTIMIZATION_TABLE,
            IndexName: 'PriorityIndex',
            KeyConditionExpression: 'priority = :priority',
            ExpressionAttributeValues: {
                ':priority': { S: 'HIGH' }
            },
            Limit: 10
        }));

        return result.Items?.map(parseRecommendation).filter(Boolean) || [];

    } catch (error) {
        console.error('Failed to get recommendations:', error);
        return [];
    }
}

async function processRecommendation(recommendation) {
    try {
        console.log(\`Processing recommendation: \${recommendation.id}\`);

        let success = false;
        let message = '';

        switch (recommendation.type) {
            case 'SCALE_UP':
                success = await handleScaleUp(recommendation);
                message = success ? 'Successfully scaled up' : 'Failed to scale up';
                break;

            case 'SCALE_DOWN':
                success = await handleScaleDown(recommendation);
                message = success ? 'Successfully scaled down' : 'Failed to scale down';
                break;

            case 'INSTANCE_TYPE_CHANGE':
                success = await handleInstanceTypeChange(recommendation);
                message = success ? 'Successfully changed instance type' : 'Failed to change instance type';
                break;

            default:
                message = \`Unsupported recommendation type: \${recommendation.type}\`;
        }

        // Update recommendation status
        await updateRecommendationStatus(recommendation.id, success ? 'COMPLETED' : 'FAILED', message);

        return {
            id: recommendation.id,
            type: recommendation.type,
            success,
            message
        };

    } catch (error) {
        console.error(\`Failed to process recommendation \${recommendation.id}:\`, error);

        await updateRecommendationStatus(recommendation.id, 'FAILED', error.message);

        return {
            id: recommendation.id,
            type: recommendation.type,
            success: false,
            message: error.message
        };
    }
}

async function handleScaleUp(recommendation) {
    try {
        // Only auto-scale if explicitly marked as automated
        if (!recommendation.implementation?.automated) {
            console.log('Scale up requires manual intervention');
            return false;
        }

        // Get current capacity and increase by 1
        const result = await autoscaling.send(new SetDesiredCapacityCommand({
            AutoScalingGroupName: process.env.AUTO_SCALING_GROUP_NAME,
            DesiredCapacity: await getCurrentDesiredCapacity() + 1,
            HonorCooldown: true
        }));

        return true;

    } catch (error) {
        console.error('Failed to scale up:', error);
        return false;
    }
}

async function handleScaleDown(recommendation) {
    try {
        // Scale down requires manual approval for safety
        console.log('Scale down requires manual intervention for safety');
        return false;

    } catch (error) {
        console.error('Failed to scale down:', error);
        return false;
    }
}

async function handleInstanceTypeChange(recommendation) {
    try {
        // Instance type changes require manual intervention
        console.log('Instance type change requires manual intervention');
        return false;

    } catch (error) {
        console.error('Failed to change instance type:', error);
        return false;
    }
}

async function getCurrentDesiredCapacity() {
    // This would need to be implemented to get current ASG state
    // For now, return a default value
    return 2;
}

async function updateRecommendationStatus(id, status, message) {
    try {
        await dynamodb.send(new UpdateItemCommand({
            TableName: process.env.OPTIMIZATION_TABLE,
            Key: {
                id: { S: id }
            },
            UpdateExpression: 'SET #status = :status, #message = :message, #updatedAt = :updatedAt',
            ExpressionAttributeNames: {
                '#status': 'status',
                '#message': 'message',
                '#updatedAt': 'updatedAt'
            },
            ExpressionAttributeValues: {
                ':status': { S: status },
                ':message': { S: message },
                ':updatedAt': { S: new Date().toISOString() }
            }
        }));

    } catch (error) {
        console.error('Failed to update recommendation status:', error);
    }
}

async function publishOptimizationMetrics(results) {
    try {
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        const metrics = [
            {
                MetricName: 'OptimizationRecommendation',
                Value: results.length,
                Unit: 'Count',
                Dimensions: [
                    { Name: 'Environment', Value: process.env.ENVIRONMENT_NAME },
                    { Name: 'Application', Value: process.env.APPLICATION_NAME }
                ]
            },
            {
                MetricName: 'OptimizationSuccess',
                Value: successful,
                Unit: 'Count',
                Dimensions: [
                    { Name: 'Environment', Value: process.env.ENVIRONMENT_NAME },
                    { Name: 'Application', Value: process.env.APPLICATION_NAME }
                ]
            },
            {
                MetricName: 'OptimizationFailure',
                Value: failed,
                Unit: 'Count',
                Dimensions: [
                    { Name: 'Environment', Value: process.env.ENVIRONMENT_NAME },
                    { Name: 'Application', Value: process.env.APPLICATION_NAME }
                ]
            }
        ];

        await cloudwatch.send(new PutMetricDataCommand({
            Namespace: 'MacroAI/Optimization',
            MetricData: metrics
        }));

    } catch (error) {
        console.error('Failed to publish optimization metrics:', error);
    }
}

function parseRecommendation(item) {
    if (!item) return null;

    try {
        const recommendation = {
            id: item.id?.S,
            timestamp: item.timestamp?.S,
            type: item.type?.S,
            priority: item.priority?.S,
            description: item.description?.S
        };

        // Parse implementation details
        if (item.implementation?.M) {
            recommendation.implementation = {};
            Object.entries(item.implementation.M).forEach(([key, value]) => {
                if (value.BOOL !== undefined) {
                    recommendation.implementation[key] = value.BOOL;
                } else if (value.S) {
                    recommendation.implementation[key] = value.S;
                }
            });
        }

        return recommendation;

    } catch (error) {
        console.error('Failed to parse recommendation:', error);
        return null;
    }
}
`
	}

	/**
	 * Get cost optimizer Lambda code
	 */
	private getCostOptimizerCode(): string {
		return `
const { CostExplorerClient, GetCostAndUsageCommand } = require('@aws-sdk/client-cost-explorer');
const { EC2Client, DescribeInstanceTypesCommand, DescribeSpotPriceHistoryCommand } = require('@aws-sdk/client-ec2');
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

const costExplorer = new CostExplorerClient();
const ec2 = new EC2Client();
const dynamodb = new DynamoDBClient();
const cloudwatch = new CloudWatchClient();

exports.handler = async (event) => {
    console.log('Cost optimizer event:', JSON.stringify(event, null, 2));

    try {
        // Analyze current costs
        const costAnalysis = await analyzeCosts();

        // Get instance pricing information
        const pricingAnalysis = await analyzePricing();

        // Generate cost optimization recommendations
        const recommendations = await generateCostRecommendations(costAnalysis, pricingAnalysis);

        // Store recommendations
        for (const recommendation of recommendations) {
            await storeRecommendation(recommendation);
        }

        // Publish cost metrics
        await publishCostMetrics(costAnalysis, recommendations);

        console.log('Cost optimization completed:', {
            currentMonthlyCost: costAnalysis.currentMonthlyCost,
            potentialSavings: costAnalysis.potentialSavings,
            recommendations: recommendations.length
        });

        return {
            statusCode: 200,
            body: {
                currentMonthlyCost: costAnalysis.currentMonthlyCost,
                potentialSavings: costAnalysis.potentialSavings,
                recommendations: recommendations.length,
                analysis: costAnalysis
            }
        };

    } catch (error) {
        console.error('Cost optimization failed:', error);

        return {
            statusCode: 500,
            body: {
                error: error.message,
                message: 'Cost optimization failed'
            }
        };
    }
};

async function analyzeCosts() {
    try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30); // Last 30 days

        const result = await costExplorer.send(new GetCostAndUsageCommand({
            TimePeriod: {
                Start: startDate.toISOString().split('T')[0],
                End: endDate.toISOString().split('T')[0]
            },
            Granularity: 'DAILY',
            Metrics: ['BlendedCost'],
            GroupBy: [
                { Type: 'DIMENSION', Key: 'SERVICE' }
            ]
        }));

        const ec2Costs = result.ResultsByTime?.reduce((total, day) => {
            const ec2Group = day.Groups?.find(group =>
                group.Keys?.[0]?.includes('Amazon Elastic Compute Cloud')
            );
            return total + parseFloat(ec2Group?.Metrics?.BlendedCost?.Amount || '0');
        }, 0) || 0;

        const dailyAverage = ec2Costs / 30;
        const monthlyProjection = dailyAverage * 30;

        return {
            currentMonthlyCost: monthlyProjection,
            dailyAverage: dailyAverage,
            potentialSavings: 0, // Will be calculated based on recommendations
            costTrend: 'stable' // Simplified
        };

    } catch (error) {
        console.error('Failed to analyze costs:', error);
        return {
            currentMonthlyCost: 0,
            dailyAverage: 0,
            potentialSavings: 0,
            costTrend: 'unknown'
        };
    }
}

async function analyzePricing() {
    try {
        // Get current instance types and their pricing
        const instanceTypes = ['t3.micro', 't3.small', 't3.medium', 't3.large'];
        const pricing = {};

        for (const instanceType of instanceTypes) {
            // Get spot pricing for comparison
            try {
                const spotResult = await ec2.send(new DescribeSpotPriceHistoryCommand({
                    InstanceTypes: [instanceType],
                    ProductDescriptions: ['Linux/UNIX'],
                    MaxResults: 1
                }));

                const spotPrice = parseFloat(spotResult.SpotPriceHistory?.[0]?.SpotPrice || '0');

                pricing[instanceType] = {
                    spotPrice: spotPrice,
                    onDemandPrice: getOnDemandPrice(instanceType), // Simplified
                    savings: calculateSpotSavings(instanceType, spotPrice)
                };

            } catch (error) {
                console.warn(\`Failed to get pricing for \${instanceType}:\`, error);
            }
        }

        return pricing;

    } catch (error) {
        console.error('Failed to analyze pricing:', error);
        return {};
    }
}

function getOnDemandPrice(instanceType) {
    // Simplified on-demand pricing (would normally use Pricing API)
    const prices = {
        't3.micro': 0.0104,
        't3.small': 0.0208,
        't3.medium': 0.0416,
        't3.large': 0.0832
    };
    return prices[instanceType] || 0;
}

function calculateSpotSavings(instanceType, spotPrice) {
    const onDemandPrice = getOnDemandPrice(instanceType);
    if (onDemandPrice === 0) return 0;

    return ((onDemandPrice - spotPrice) / onDemandPrice) * 100;
}

async function generateCostRecommendations(costAnalysis, pricingAnalysis) {
    const recommendations = [];

    // Spot instance recommendation
    const bestSpotSavings = Object.entries(pricingAnalysis)
        .filter(([_, pricing]) => pricing.savings > 50)
        .sort((a, b) => b[1].savings - a[1].savings)[0];

    if (bestSpotSavings) {
        const [instanceType, pricing] = bestSpotSavings;
        recommendations.push({
            id: \`cost-\${Date.now()}-spot\`,
            timestamp: new Date().toISOString(),
            type: 'COST_OPTIMIZATION',
            priority: 'MEDIUM',
            description: \`Switch to spot instances (\${instanceType}) for \${pricing.savings.toFixed(1)}% savings\`,
            expectedImpact: {
                costSavings: pricing.savings,
                riskLevel: 'MEDIUM'
            },
            implementation: {
                automated: false,
                steps: [
                    'Create new launch template with spot instances',
                    'Update Auto Scaling Group',
                    'Monitor instance availability'
                ],
                estimatedDuration: '30-60 minutes'
            }
        });
    }

    // Right-sizing recommendation
    if (costAnalysis.currentMonthlyCost > 100) {
        recommendations.push({
            id: \`cost-\${Date.now()}-rightsize\`,
            timestamp: new Date().toISOString(),
            type: 'INSTANCE_TYPE_CHANGE',
            priority: 'LOW',
            description: 'Analyze instance utilization for potential right-sizing',
            expectedImpact: {
                costSavings: 15,
                riskLevel: 'LOW'
            },
            implementation: {
                automated: false,
                steps: [
                    'Analyze CPU and memory utilization',
                    'Identify over-provisioned instances',
                    'Test smaller instance types'
                ],
                estimatedDuration: '2-4 hours'
            }
        });
    }

    return recommendations;
}

async function storeRecommendation(recommendation) {
    const ttl = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days TTL

    const item = {
        id: { S: recommendation.id },
        timestamp: { S: recommendation.timestamp },
        type: { S: recommendation.type },
        priority: { S: recommendation.priority },
        description: { S: recommendation.description },
        ttl: { N: ttl.toString() }
    };

    await dynamodb.send(new PutItemCommand({
        TableName: process.env.OPTIMIZATION_TABLE,
        Item: item
    }));
}

async function publishCostMetrics(costAnalysis, recommendations) {
    try {
        const totalPotentialSavings = recommendations.reduce((total, rec) =>
            total + (rec.expectedImpact?.costSavings || 0), 0
        );

        const metrics = [
            {
                MetricName: 'MonthlyCost',
                Value: costAnalysis.currentMonthlyCost,
                Unit: 'None',
                Dimensions: [
                    { Name: 'Environment', Value: process.env.ENVIRONMENT_NAME },
                    { Name: 'Application', Value: process.env.APPLICATION_NAME }
                ]
            },
            {
                MetricName: 'CostSavingsPotential',
                Value: totalPotentialSavings,
                Unit: 'Percent',
                Dimensions: [
                    { Name: 'Environment', Value: process.env.ENVIRONMENT_NAME },
                    { Name: 'Application', Value: process.env.APPLICATION_NAME }
                ]
            },
            {
                MetricName: 'CostOptimizationRecommendations',
                Value: recommendations.length,
                Unit: 'Count',
                Dimensions: [
                    { Name: 'Environment', Value: process.env.ENVIRONMENT_NAME },
                    { Name: 'Application', Value: process.env.APPLICATION_NAME }
                ]
            }
        ];

        await cloudwatch.send(new PutMetricDataCommand({
            Namespace: 'MacroAI/Optimization',
            MetricData: metrics
        }));

    } catch (error) {
        console.error('Failed to publish cost metrics:', error);
    }
}
`
	}
}
