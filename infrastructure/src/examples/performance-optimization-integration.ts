import * as cdk from 'aws-cdk-lib'
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling'
import * as sns from 'aws-cdk-lib/aws-sns'
import { Construct } from 'constructs'
import { PerformanceOptimizationConstruct } from '../constructs/performance-optimization-construct'
import { AutoScalingConstruct } from '../constructs/auto-scaling-construct'
import { MonitoringConstruct } from '../constructs/monitoring-construct'

/**
 * Example integration of Performance Optimization with existing infrastructure
 *
 * This example demonstrates how to integrate the Performance Optimization
 * construct with existing Auto Scaling and monitoring infrastructure.
 */
export class PerformanceOptimizationIntegrationExample extends Construct {
	public readonly performanceOptimization: PerformanceOptimizationConstruct

	constructor(
		scope: Construct,
		id: string,
		props: {
			autoScalingGroup: autoscaling.AutoScalingGroup
			environmentName: string
		},
	) {
		super(scope, id)

		// Create SNS topics for optimization notifications
		const optimizationRecommendation = new sns.Topic(
			this,
			'OptimizationRecommendation',
			{
				topicName: `macro-ai-${props.environmentName}-optimization-recommendation`,
				displayName: 'Optimization Recommendation',
			},
		)

		const performanceAlert = new sns.Topic(this, 'PerformanceAlert', {
			topicName: `macro-ai-${props.environmentName}-performance-alert`,
			displayName: 'Performance Alert',
		})

		const costAlert = new sns.Topic(this, 'CostAlert', {
			topicName: `macro-ai-${props.environmentName}-cost-alert`,
			displayName: 'Cost Alert',
		})

		// Get environment-specific configuration
		const optimizationConfig = this.getOptimizationConfig(props.environmentName)

		// Create Performance Optimization construct
		this.performanceOptimization = new PerformanceOptimizationConstruct(
			this,
			'PerformanceOptimization',
			{
				environmentName: props.environmentName,
				applicationName: 'macro-ai',
				autoScalingGroup: props.autoScalingGroup,
				optimizationConfig,
				optimizationNotificationTopics: {
					optimizationRecommendation,
					performanceAlert,
					costAlert,
				},
			},
		)

		// Add email subscriptions based on environment
		this.addEmailSubscriptions(props.environmentName, {
			optimizationRecommendation,
			performanceAlert,
			costAlert,
		})

		// Output important resources
		new cdk.CfnOutput(this, 'PerformanceDashboardUrl', {
			value: `https://console.aws.amazon.com/cloudwatch/home?region=${cdk.Stack.of(this).region}#dashboards:name=${this.performanceOptimization.performanceDashboard.dashboardName}`,
			description: 'URL to the Performance Optimization Dashboard',
		})

		new cdk.CfnOutput(this, 'OptimizationTableName', {
			value: this.performanceOptimization.optimizationTable.tableName,
			description: 'DynamoDB table for optimization recommendations',
		})

		new cdk.CfnOutput(this, 'PerformanceAnalyzerFunctionName', {
			value: this.performanceOptimization.performanceAnalyzer.functionName,
			description: 'Performance analyzer Lambda function',
		})
	}

	/**
	 * Get environment-specific optimization configuration
	 */
	private getOptimizationConfig(environmentName: string) {
		switch (environmentName) {
			case 'production':
				return {
					enableAutoScalingOptimization: true,
					enableCostOptimization: true,
					enablePerformanceMonitoring: true,
					analysisInterval: cdk.Duration.hours(1),
					performanceThresholds: {
						cpuUtilizationTarget: 70,
						memoryUtilizationTarget: 80,
						responseTimeTarget: 500, // ms
						throughputTarget: 1000, // requests/min
					},
					costThresholds: {
						maxHourlyCost: 50,
						utilizationThreshold: 60,
					},
				}

			case 'staging':
				return {
					enableAutoScalingOptimization: true,
					enableCostOptimization: true,
					enablePerformanceMonitoring: true,
					analysisInterval: cdk.Duration.hours(2),
					performanceThresholds: {
						cpuUtilizationTarget: 75,
						memoryUtilizationTarget: 85,
						responseTimeTarget: 1000, // ms
						throughputTarget: 500, // requests/min
					},
					costThresholds: {
						maxHourlyCost: 20,
						utilizationThreshold: 50,
					},
				}

			case 'development':
				return {
					enableAutoScalingOptimization: false, // Manual control in dev
					enableCostOptimization: true,
					enablePerformanceMonitoring: true,
					analysisInterval: cdk.Duration.hours(4),
					performanceThresholds: {
						cpuUtilizationTarget: 80,
						memoryUtilizationTarget: 90,
						responseTimeTarget: 2000, // ms
						throughputTarget: 100, // requests/min
					},
					costThresholds: {
						maxHourlyCost: 10,
						utilizationThreshold: 40,
					},
				}

			default:
				return {
					enableAutoScalingOptimization: false,
					enableCostOptimization: true,
					enablePerformanceMonitoring: true,
					analysisInterval: cdk.Duration.hours(6),
					performanceThresholds: {
						cpuUtilizationTarget: 70,
						memoryUtilizationTarget: 80,
						responseTimeTarget: 1000,
						throughputTarget: 500,
					},
					costThresholds: {
						maxHourlyCost: 25,
						utilizationThreshold: 50,
					},
				}
		}
	}

	/**
	 * Add email subscriptions based on environment
	 */
	private addEmailSubscriptions(
		environmentName: string,
		topics: {
			optimizationRecommendation: sns.Topic
			performanceAlert: sns.Topic
			costAlert: sns.Topic
		},
	): void {
		const emailConfig = this.getEmailConfig(environmentName)

		// Add subscriptions for optimization recommendations
		emailConfig.optimizationEmails.forEach((email, index) => {
			new sns.Subscription(this, `OptimizationRecommendationEmail${index}`, {
				topic: topics.optimizationRecommendation,
				protocol: sns.SubscriptionProtocol.EMAIL,
				endpoint: email,
			})
		})

		// Add subscriptions for performance alerts
		emailConfig.performanceEmails.forEach((email, index) => {
			new sns.Subscription(this, `PerformanceAlertEmail${index}`, {
				topic: topics.performanceAlert,
				protocol: sns.SubscriptionProtocol.EMAIL,
				endpoint: email,
			})
		})

		// Add subscriptions for cost alerts
		emailConfig.costEmails.forEach((email, index) => {
			new sns.Subscription(this, `CostAlertEmail${index}`, {
				topic: topics.costAlert,
				protocol: sns.SubscriptionProtocol.EMAIL,
				endpoint: email,
			})
		})
	}

	/**
	 * Get email configuration for environment
	 */
	private getEmailConfig(environmentName: string) {
		switch (environmentName) {
			case 'production':
				return {
					optimizationEmails: [
						'devops-team@company.com',
						'performance-team@company.com',
					],
					performanceEmails: ['devops-team@company.com', 'on-call@company.com'],
					costEmails: ['finops-team@company.com', 'devops-team@company.com'],
				}

			case 'staging':
				return {
					optimizationEmails: ['devops-team@company.com'],
					performanceEmails: ['devops-team@company.com'],
					costEmails: ['devops-team@company.com'],
				}

			case 'development':
				return {
					optimizationEmails: ['dev-team@company.com'],
					performanceEmails: ['dev-team@company.com'],
					costEmails: ['dev-team@company.com'],
				}

			default:
				return {
					optimizationEmails: ['devops-team@company.com'],
					performanceEmails: ['devops-team@company.com'],
					costEmails: ['devops-team@company.com'],
				}
		}
	}
}

/**
 * Complete performance optimization integration with existing constructs
 */
export class PerformanceOptimizationIntegration extends Construct {
	constructor(
		scope: Construct,
		id: string,
		props: {
			environmentName: string
			applicationName: string
			autoScalingConstruct: AutoScalingConstruct
			monitoringConstruct: MonitoringConstruct
		},
	) {
		super(scope, id)

		// Create performance optimization
		const performanceOptimization =
			new PerformanceOptimizationIntegrationExample(
				this,
				'PerformanceOptimizationExample',
				{
					autoScalingGroup: props.autoScalingConstruct.autoScalingGroup,
					environmentName: props.environmentName,
				},
			)

		// Integrate with existing monitoring dashboard
		this.integrateWithMonitoring(
			performanceOptimization.performanceOptimization,
			props.monitoringConstruct,
		)

		// Add performance optimization widgets to existing dashboard
		this.addPerformanceWidgetsToMonitoring(
			performanceOptimization.performanceOptimization,
			props.monitoringConstruct,
			props.environmentName,
		)
	}

	/**
	 * Integrate with existing monitoring construct
	 */
	private integrateWithMonitoring(
		performanceOptimization: PerformanceOptimizationConstruct,
		monitoring: MonitoringConstruct,
	): void {
		// Add performance optimization metrics to existing dashboard
		monitoring.dashboard.addWidgets(
			new cdk.aws_cloudwatch.SingleValueWidget({
				title: 'Performance Score',
				metrics: [
					new cdk.aws_cloudwatch.Metric({
						namespace: 'MacroAI/Optimization',
						metricName: 'PerformanceScore',
						statistic: 'Average',
					}),
				],
				width: 6,
				height: 6,
			}),
		)
	}

	/**
	 * Add performance widgets to monitoring dashboard
	 */
	private addPerformanceWidgetsToMonitoring(
		performanceOptimization: PerformanceOptimizationConstruct,
		monitoring: MonitoringConstruct,
		environmentName: string,
	): void {
		// Add optimization-specific widgets
		monitoring.dashboard.addWidgets(
			new cdk.aws_cloudwatch.GraphWidget({
				title: 'Optimization Recommendations Trend',
				left: [
					new cdk.aws_cloudwatch.Metric({
						namespace: 'MacroAI/Optimization',
						metricName: 'OptimizationRecommendation',
						dimensionsMap: {
							Environment: environmentName,
							Application: 'macro-ai',
						},
						statistic: 'Sum',
						period: cdk.Duration.hours(1),
					}),
				],
				width: 12,
				height: 6,
			}),
			new cdk.aws_cloudwatch.GraphWidget({
				title: 'Cost Savings Potential',
				left: [
					new cdk.aws_cloudwatch.Metric({
						namespace: 'MacroAI/Optimization',
						metricName: 'CostSavingsPotential',
						dimensionsMap: {
							Environment: environmentName,
							Application: 'macro-ai',
						},
						statistic: 'Average',
					}),
				],
				width: 12,
				height: 6,
			}),
		)
	}
}

/**
 * Complete performance optimization stack example
 */
export class PerformanceOptimizationStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props?: cdk.StackProps) {
		super(scope, id, props)

		// This would typically use existing Auto Scaling and Monitoring constructs
		// For this example, we'll create minimal versions

		// Add stack-level tags
		cdk.Tags.of(this).add('Component', 'PerformanceOptimization')
		cdk.Tags.of(this).add('Environment', 'production')
		cdk.Tags.of(this).add('Application', 'macro-ai')
	}
}
