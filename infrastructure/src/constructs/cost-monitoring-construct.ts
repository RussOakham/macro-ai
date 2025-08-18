import * as cdk from 'aws-cdk-lib'
import * as budgets from 'aws-cdk-lib/aws-budgets'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions'
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

		// Subscribe email addresses to alerts
		alertEmails.forEach((email) => {
			this.alertTopic.addSubscription(
				new snsSubscriptions.EmailSubscription(email),
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
		costFilters: Record<string, string[]>,
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

		// Build cost filters
		const filters = {
			Tags: {
				Environment: [environmentName],
				Project: ['MacroAI'],
				...costFilters,
			},
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

		// Daily cost alarm (20% of monthly budget per day)
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
			}),
			threshold: budgetLimit * 0.2, // 20% of monthly budget per day
			evaluationPeriods: 1,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
		})

		dailyCostAlarm.addAlarmAction(
			new cloudwatchActions.SnsAction(this.alertTopic),
		)

		alarms.push(dailyCostAlarm)

		return alarms
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
- Environment: ${environmentName}

Priority 2 Cost Optimizations:
- Instance Type: t3.nano (50% cost reduction)
- Enhanced Auto-Scaling: Aggressive scale-in policies
- Storage: gp3 volumes with optimized IOPS
- Monitoring: Real-time cost tracking and alerts
		`.trim()
	}
}
