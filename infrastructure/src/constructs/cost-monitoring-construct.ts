import { Construct } from 'constructs'
import * as budgets from 'aws-cdk-lib/aws-budgets'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Duration } from 'aws-cdk-lib'

export interface CostMonitoringProps {
	environment: string
	budgetAmount: number // Monthly budget in USD
	costAnomalyDetection?: boolean
	alertEmail?: string
	alertThresholds?: number[] // Alert percentages (e.g., [75, 90, 100])
	enableCostOptimization?: boolean
	tags?: { [key: string]: string }
}

export class CostMonitoringConstruct extends Construct {
	public readonly budget: budgets.CfnBudget
	public readonly alarms: cloudwatch.Alarm[]
	public readonly dashboard: cloudwatch.Dashboard
	public readonly costOptimizationRole: iam.Role
	public readonly alertTopic: sns.ITopic

	constructor(scope: Construct, id: string, props: CostMonitoringProps) {
		super(scope, id)

		this.alarms = []

		const { environment, alertEmail } = props

		// Create SNS topic for cost alerts
		this.alertTopic = new sns.Topic(this, 'CostAlertTopic', {
			displayName: `${environment} Cost Alerts`,
			topicName: `${environment.toLowerCase()}-cost-alerts`,
		})

		// Add email subscription if provided
		if (alertEmail) {
			new sns.Subscription(this, 'EmailSubscription', {
				protocol: sns.SubscriptionProtocol.EMAIL,
				endpoint: alertEmail,
				topic: this.alertTopic,
			})
		}

		// Create AWS Budget
		this.budget = this.createBudget(props)

		// Create CloudWatch alarms for budget thresholds
		this.createBudgetAlarms(props)

		// Create cost monitoring dashboard
		this.dashboard = this.createCostDashboard(props)

		// Create cost optimization IAM role (optional)
		if (props.enableCostOptimization) {
			this.costOptimizationRole = this.createCostOptimizationRole(props)
		}
	}

	private createBudget(props: CostMonitoringProps): budgets.CfnBudget {
		const { environment, budgetAmount, tags } = props

		return new budgets.CfnBudget(this, 'Budget', {
			budget: {
				budgetName: `${environment}-monthly-budget`,
				budgetType: 'COST',
				timeUnit: 'MONTHLY',
				budgetLimit: {
					amount: budgetAmount,
					unit: 'USD',
				},
				costFilters: {
					TagKeyValue: Object.entries(tags || {}).map(
						([key, value]) => `user:${key}$${value}`,
					),
				},
				costTypes: {
					includeCredit: false,
					includeDiscount: true,
					includeOtherSubscription: true,
					includeRecurring: true,
					includeRefund: false,
					includeSubscription: true,
					includeSupport: true,
					includeTax: true,
					includeUpfront: true,
					useAmortized: false,
					useBlended: false,
				},
			},
			notificationsWithSubscribers: this.createBudgetNotifications(props),
		})
	}

	private createBudgetNotifications(
		props: CostMonitoringProps,
	): budgets.CfnBudget.NotificationWithSubscribersProperty[] {
		const { alertThresholds = [75, 90, 100] } = props

		return alertThresholds.map((threshold) => ({
			notification: {
				notificationType: 'ACTUAL',
				comparisonOperator: 'GREATER_THAN',
				threshold: threshold,
				thresholdType: 'PERCENTAGE',
			},
			subscribers: [
				{
					subscriptionType: 'SNS',
					address: this.alertTopic.topicArn,
				},
			],
		}))
	}

	private createBudgetAlarms(props: CostMonitoringProps): void {
		const { environment, budgetAmount, alertThresholds = [75, 90, 100] } = props

		// Create CloudWatch alarms for each threshold
		alertThresholds.forEach((threshold) => {
			const alarm = new cloudwatch.Alarm(this, `BudgetAlarm${threshold}`, {
				alarmName: `${environment}-budget-${threshold}pct`,
				alarmDescription: `${environment} environment has exceeded ${threshold}% of monthly budget`,
				metric: new cloudwatch.Metric({
					namespace: 'AWS/Budgets',
					metricName: 'EstimatedMonthlyCost',
					dimensionsMap: {
						BudgetName: `${environment}-monthly-budget`,
					},
					statistic: 'Maximum',
					period: Duration.hours(6),
				}),
				threshold: (budgetAmount * threshold) / 100,
				evaluationPeriods: 1,
				comparisonOperator:
					cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
				treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
			})

			alarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alertTopic))
			this.alarms.push(alarm)
		})

		// Daily cost spike alarm
		const dailyCostSpikeAlarm = new cloudwatch.Alarm(
			this,
			'DailyCostSpikeAlarm',
			{
				alarmName: `${environment}-daily-cost-spike`,
				alarmDescription: `Unusual daily cost increase detected in ${environment} environment`,
				metric: new cloudwatch.Metric({
					namespace: 'AWS/Budgets',
					metricName: 'DailyEstimatedCharges',
					dimensionsMap: {
						ServiceName: 'Total',
					},
					statistic: 'Maximum',
					period: Duration.hours(24),
				}),
				threshold: (budgetAmount / 30) * 2, // 2x daily average
				evaluationPeriods: 1,
				comparisonOperator:
					cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
				treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
			},
		)

		dailyCostSpikeAlarm.addAlarmAction(
			new cloudwatch_actions.SnsAction(this.alertTopic),
		)
		this.alarms.push(dailyCostSpikeAlarm)
	}

	private createCostDashboard(
		props: CostMonitoringProps,
	): cloudwatch.Dashboard {
		const { environment } = props

		const dashboard = new cloudwatch.Dashboard(this, 'CostDashboard', {
			dashboardName: `${environment}-cost-dashboard`,
		})

		// Monthly cost trend
		const monthlyCostWidget = new cloudwatch.GraphWidget({
			title: 'Monthly Cost Trend',
			left: [
				new cloudwatch.Metric({
					namespace: 'AWS/Budgets',
					metricName: 'EstimatedMonthlyCost',
					dimensionsMap: {
						BudgetName: `${environment}-monthly-budget`,
					},
					statistic: 'Maximum',
				}),
			],
			width: 12,
			height: 6,
		})

		// Budget utilization percentage
		const budgetUtilizationWidget = new cloudwatch.GraphWidget({
			title: 'Budget Utilization',
			left: [
				new cloudwatch.MathExpression({
					expression: '(estimated_cost / budget_limit) * 100',
					usingMetrics: {
						estimated_cost: new cloudwatch.Metric({
							namespace: 'AWS/Budgets',
							metricName: 'EstimatedMonthlyCost',
							dimensionsMap: {
								BudgetName: `${environment}-monthly-budget`,
							},
							statistic: 'Maximum',
						}),
						budget_limit: new cloudwatch.Metric({
							namespace: 'AWS/Budgets',
							metricName: 'BudgetLimit',
							dimensionsMap: {
								BudgetName: `${environment}-monthly-budget`,
							},
							statistic: 'Maximum',
						}),
					},
					label: 'Budget % Used',
				}),
			],
			width: 12,
			height: 6,
		})

		// Top cost services
		const topServicesWidget = new cloudwatch.GraphWidget({
			title: 'Top Cost Services (Last 30 Days)',
			left: [
				new cloudwatch.Metric({
					namespace: 'AWS/Budgets',
					metricName: 'EstimatedMonthlyCost',
					dimensionsMap: {
						ServiceName: 'Amazon Elastic Compute Cloud - Compute',
					},
					statistic: 'Maximum',
					label: 'EC2',
				}),
				new cloudwatch.Metric({
					namespace: 'AWS/Budgets',
					metricName: 'EstimatedMonthlyCost',
					dimensionsMap: {
						ServiceName: 'Amazon Elastic Load Balancing',
					},
					statistic: 'Maximum',
					label: 'ELB',
				}),
				new cloudwatch.Metric({
					namespace: 'AWS/Budgets',
					metricName: 'EstimatedMonthlyCost',
					dimensionsMap: {
						ServiceName: 'Amazon CloudWatch',
					},
					statistic: 'Maximum',
					label: 'CloudWatch',
				}),
			],
			width: 24,
			height: 8,
		})

		// Cost by availability zone
		const azCostWidget = new cloudwatch.GraphWidget({
			title: 'Cost by Availability Zone',
			left: [
				new cloudwatch.Metric({
					namespace: 'AWS/Budgets',
					metricName: 'EstimatedMonthlyCost',
					dimensionsMap: {
						AvailabilityZone: 'us-east-1a',
					},
					statistic: 'Maximum',
					label: 'us-east-1a',
				}),
				new cloudwatch.Metric({
					namespace: 'AWS/Budgets',
					metricName: 'EstimatedMonthlyCost',
					dimensionsMap: {
						AvailabilityZone: 'us-east-1b',
					},
					statistic: 'Maximum',
					label: 'us-east-1b',
				}),
			],
			width: 12,
			height: 6,
		})

		// Cost optimization opportunities
		const costOptimizationWidget = new cloudwatch.SingleValueWidget({
			title: 'Cost Optimization Score',
			metrics: [
				new cloudwatch.MathExpression({
					expression: '100 - ((estimated_cost / budget_limit) * 100)',
					usingMetrics: {
						estimated_cost: new cloudwatch.Metric({
							namespace: 'AWS/Budgets',
							metricName: 'EstimatedMonthlyCost',
							dimensionsMap: {
								BudgetName: `${environment}-monthly-budget`,
							},
							statistic: 'Maximum',
						}),
						budget_limit: new cloudwatch.Metric({
							namespace: 'AWS/Budgets',
							metricName: 'BudgetLimit',
							dimensionsMap: {
								BudgetName: `${environment}-monthly-budget`,
							},
							statistic: 'Maximum',
						}),
					},
					label: 'Budget Remaining %',
				}),
			],
			width: 12,
			height: 6,
		})

		// Add widgets to dashboard
		dashboard.addWidgets(
			monthlyCostWidget,
			budgetUtilizationWidget,
			topServicesWidget,
			azCostWidget,
			costOptimizationWidget,
		)

		// Add alarm status widget
		const alarmWidget = new cloudwatch.AlarmStatusWidget({
			title: 'Cost Alert Status',
			alarms: this.alarms,
			width: 24,
			height: 4,
		})
		dashboard.addWidgets(alarmWidget)

		return dashboard
	}

	private createCostOptimizationRole(props: CostMonitoringProps): iam.Role {
		const { environment } = props

		const role = new iam.Role(this, 'CostOptimizationRole', {
			roleName: `${environment}-cost-optimization-role`,
			assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
			description: 'IAM role for cost optimization Lambda functions',
		})

		// Add permissions for cost optimization
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'budgets:DescribeBudget',
					'budgets:DescribeBudgets',
					'ce:GetCostAndUsage',
					'ce:GetUsageAndCosts',
					'ec2:DescribeInstances',
					'ec2:DescribeSnapshots',
					'ec2:DescribeVolumes',
					'elasticloadbalancing:DescribeLoadBalancers',
					'cloudwatch:GetMetricData',
					'cloudwatch:ListMetrics',
				],
				resources: ['*'],
			}),
		)

		return role
	}

	/**
	 * Get budget utilization percentage
	 */
	public getBudgetUtilization(): cloudwatch.MathExpression {
		return new cloudwatch.MathExpression({
			expression: '(estimated_cost / budget_limit) * 100',
			usingMetrics: {
				estimated_cost: new cloudwatch.Metric({
					namespace: 'AWS/Budgets',
					metricName: 'EstimatedMonthlyCost',
					dimensionsMap: {
						BudgetName: this.budget.ref,
					},
					statistic: 'Maximum',
				}),
				budget_limit: new cloudwatch.Metric({
					namespace: 'AWS/Budgets',
					metricName: 'BudgetLimit',
					dimensionsMap: {
						BudgetName: this.budget.ref,
					},
					statistic: 'Maximum',
				}),
			},
		})
	}

	/**
	 * Get estimated monthly cost metric
	 */
	public getEstimatedMonthlyCost(): cloudwatch.Metric {
		return new cloudwatch.Metric({
			namespace: 'AWS/Budgets',
			metricName: 'EstimatedMonthlyCost',
			dimensionsMap: {
				BudgetName: this.budget.ref,
			},
			statistic: 'Maximum',
		})
	}
}
