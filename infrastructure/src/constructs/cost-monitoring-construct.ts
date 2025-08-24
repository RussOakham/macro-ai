import * as cdk from 'aws-cdk-lib'
import * as budgets from 'aws-cdk-lib/aws-budgets'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions'
import { Construct } from 'constructs'

/**
 * Properties for the Cost Monitoring Construct
 */
export interface CostMonitoringConstructProps {
	/**
	 * Environment name for resource naming and tagging
	 */
	readonly environmentName: string

	/**
	 * Monthly budget limit in USD
	 * @default 3 (£3 target converted to USD)
	 */
	readonly monthlyBudgetLimit?: number

	/**
	 * Email addresses for cost alerts
	 */
	readonly alertEmails: string[]

	/**
	 * Budget alert thresholds as percentages
	 * @default [50, 80, 100] (50%, 80%, 100% of budget)
	 */
	readonly alertThresholds?: number[]

	/**
	 * Resource tags to filter costs by
	 */
	readonly costFilters?: Record<string, string[]>
}

/**
 * Cost Monitoring Construct for Preview Environments
 *
 * Provides comprehensive cost tracking and alerting for preview environments
 * to ensure spending stays within the <£3/month target.
 *
 * Features:
 * - AWS Budgets integration with email alerts
 * - CloudWatch cost metrics and alarms
 * - Daily cost tracking and reporting
 * - Resource-specific cost attribution
 */
export class CostMonitoringConstruct extends Construct {
	public readonly budget: budgets.CfnBudget
	public readonly alertTopic: sns.Topic
	public readonly costAlarms: cloudwatch.Alarm[]

	constructor(
		scope: Construct,
		id: string,
		props: CostMonitoringConstructProps,
	) {
		super(scope, id)

		const {
			environmentName,
			monthlyBudgetLimit = 3.5, // ~£3 in USD
			alertEmails,
			alertThresholds = [50, 80, 100],
			costFilters = {},
		} = props

		// Create SNS topic for cost alerts
		this.alertTopic = new sns.Topic(this, 'CostAlertTopic', {
			topicName: `macro-ai-${environmentName}-cost-alerts`,
			displayName: `Macro AI ${environmentName} Cost Alerts`,
		})

		// Allow AWS Budgets to publish to this topic
		this.alertTopic.addToResourcePolicy(
			new iam.PolicyStatement({
				sid: 'AllowBudgetsToPublish',
				effect: iam.Effect.ALLOW,
				principals: [new iam.ServicePrincipal('budgets.amazonaws.com')],
				actions: ['SNS:Publish'],
				resources: [this.alertTopic.topicArn],
				conditions: {
					StringEquals: {
						'AWS:SourceAccount': cdk.Stack.of(this).account,
					},
				},
			}),
		)

		// Subscribe email addresses to alerts
		console.log(
			`Cost monitoring: Processing ${alertEmails.length} email addresses:`,
			alertEmails,
		)

		const validEmails = alertEmails.filter(
			(email) => email && email.trim().length > 0 && this.isValidEmail(email),
		)

		console.log(
			`Cost monitoring: Found ${validEmails.length} valid email addresses:`,
			validEmails,
		)

		validEmails.forEach((email) => {
			this.alertTopic.addSubscription(
				new snsSubscriptions.EmailSubscription(email.trim()),
			)
		})

		// Create AWS Budget with multiple alert thresholds
		this.budget = this.createBudget(
			environmentName,
			monthlyBudgetLimit,
			alertThresholds,
			costFilters,
		)

		// Create CloudWatch cost alarms
		this.costAlarms = this.createCostAlarms(environmentName, monthlyBudgetLimit)

		// Apply tags
		this.applyTags(environmentName)
	}

	/**
	 * Create AWS Budget with cost alerts
	 */
	private createBudget(
		environmentName: string,
		budgetLimit: number,
		thresholds: number[],
		costFilters?: Record<string, string[]>,
	): budgets.CfnBudget {
		// Create budget notifications for each threshold
		const notifications = thresholds.map((threshold) => ({
			notification: {
				notificationType: 'ACTUAL',
				comparisonOperator: 'GREATER_THAN',
				threshold,
				thresholdType: 'PERCENTAGE',
			},
			subscribers: [
				{
					subscriptionType: 'SNS',
					address: this.alertTopic.topicArn,
				},
			],
		}))

		// Build cost filters in AWS Budgets format
		// AWS Budgets uses TagKeyValue format: "user:TagKey$TagValue"
		const tagFilters: string[] = [
			`user:Environment$${environmentName}`,
			'user:Project$MacroAI',
		]

		// Add any additional cost filters
		if (costFilters) {
			Object.entries(costFilters).forEach(([key, values]) => {
				if (Array.isArray(values)) {
					values.forEach((value) => {
						tagFilters.push(`user:${key}$${value}`)
					})
				}
			})
		}

		const filters: Record<string, string[]> = {
			TagKeyValue: tagFilters,
		}

		return new budgets.CfnBudget(this, 'PreviewEnvironmentBudget', {
			budget: {
				budgetName: `macro-ai-${environmentName}-monthly-budget`,
				budgetType: 'COST',
				timeUnit: 'MONTHLY',
				budgetLimit: {
					amount: budgetLimit,
					unit: 'USD',
				},
				costFilters: filters,
			},
			notificationsWithSubscribers: notifications,
		})
	}

	/**
	 * Create CloudWatch cost alarms
	 */
	private createCostAlarms(
		environmentName: string,
		budgetLimit: number,
	): cloudwatch.Alarm[] {
		const alarms: cloudwatch.Alarm[] = []

		// Daily cost alarm - AWS/Billing metrics are only available in us-east-1
		const dailyCostAlarm = new cloudwatch.Alarm(this, 'DailyCostAlarm', {
			alarmName: `macro-ai-${environmentName}-daily-cost-alarm`,
			alarmDescription: `Daily cost exceeds expected threshold for ${environmentName}`,
			metric: new cloudwatch.Metric({
				namespace: 'AWS/Billing',
				metricName: 'EstimatedCharges',
				dimensionsMap: {
					Currency: 'USD',
				},
				statistic: 'Maximum',
				period: cdk.Duration.hours(24),
				region: 'us-east-1', // AWS/Billing metrics are only published in us-east-1
			}),
			threshold: budgetLimit / 30, // True daily budget (monthly budget / 30 days)
			evaluationPeriods: 1,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
		})

		dailyCostAlarm.addAlarmAction(
			new cloudwatchActions.SnsAction(this.alertTopic),
		)

		alarms.push(dailyCostAlarm)

		// Priority 3: Enhanced cost monitoring with $5/month threshold for early detection
		const enhancedCostAlarm = new cloudwatch.Alarm(this, 'EnhancedCostAlarm', {
			alarmName: `macro-ai-${environmentName}-enhanced-cost-alarm`,
			alarmDescription: `Enhanced cost monitoring: Monthly charges approaching $5 threshold for ${environmentName}`,
			metric: new cloudwatch.Metric({
				namespace: 'AWS/Billing',
				metricName: 'EstimatedCharges',
				dimensionsMap: {
					Currency: 'USD',
				},
				statistic: 'Maximum',
				period: cdk.Duration.hours(6), // Check every 6 hours for early detection
				region: 'us-east-1',
			}),
			threshold: 5.0, // $5/month threshold for early cost detection
			evaluationPeriods: 1,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		})

		enhancedCostAlarm.addAlarmAction(
			new cloudwatchActions.SnsAction(this.alertTopic),
		)

		alarms.push(enhancedCostAlarm)

		return alarms
	}

	/**
	 * Validate email address format
	 */
	private isValidEmail(email: string): boolean {
		// Basic email validation regex
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
		return emailRegex.test(email)
	}

	/**
	 * Apply consistent tags to all resources
	 */
	private applyTags(environmentName: string): void {
		cdk.Tags.of(this).add('Component', 'CostMonitoring')
		cdk.Tags.of(this).add('Purpose', 'CostTracking')
		cdk.Tags.of(this).add('Environment', environmentName)
		cdk.Tags.of(this).add('CostOptimization', 'Priority2')
	}

	/**
	 * Get cost monitoring summary for CloudFormation outputs
	 */
	public getCostMonitoringSummary(
		budgetLimit: number,
		environmentName: string,
	): string {
		return `
Cost Monitoring Configuration:
- Budget Limit: $${budgetLimit}/month
- Alert Topic: ${this.alertTopic.topicName}
- Cost Alarms: ${this.costAlarms.length}
- Environment: ${environmentName}`.trim()
	}
}
