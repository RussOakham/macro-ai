import * as cdk from 'aws-cdk-lib'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions'
import { Construct } from 'constructs'

/**
 * Configuration for monitoring construct
 */
export interface MonitoringConstructProps {
	/**
	 * Environment name (development, staging, production)
	 */
	environmentName: string

	/**
	 * Application name for resource naming
	 */
	applicationName: string

	/**
	 * EC2 instances to monitor
	 */
	ec2Instances?: ec2.Instance[]

	/**
	 * Application Load Balancer to monitor
	 */
	applicationLoadBalancer?: elbv2.ApplicationLoadBalancer

	/**
	 * Target groups to monitor
	 */
	targetGroups?: elbv2.ApplicationTargetGroup[]

	/**
	 * Auto Scaling Groups to monitor
	 */
	autoScalingGroups?: string[]

	/**
	 * Email addresses for critical alerts
	 */
	criticalAlertEmails?: string[]

	/**
	 * Email addresses for warning alerts
	 */
	warningAlertEmails?: string[]

	/**
	 * Enable cost monitoring alerts
	 */
	enableCostMonitoring?: boolean

	/**
	 * PR number for PR-specific monitoring (optional)
	 */
	prNumber?: number

	/**
	 * Custom metric namespace
	 */
	customMetricNamespace?: string
}

/**
 * Alarm severity levels
 */
export enum AlarmSeverity {
	CRITICAL = 'CRITICAL',
	WARNING = 'WARNING',
	INFO = 'INFO',
}

/**
 * Comprehensive CloudWatch monitoring construct for production-ready observability
 *
 * This construct provides:
 * - CloudWatch dashboards for infrastructure and application metrics
 * - Automated alerting with severity-based notification channels
 * - Cost monitoring and optimization alerts
 * - Application performance monitoring integration
 * - Production-ready alarm thresholds and best practices
 */
export class MonitoringConstruct extends Construct {
	public readonly dashboard: cloudwatch.Dashboard
	public readonly criticalAlertsTopic: sns.Topic
	public readonly warningAlertsTopic: sns.Topic
	public readonly infoAlertsTopic: sns.Topic
	public readonly logGroups: logs.LogGroup[]

	private readonly props: MonitoringConstructProps
	private readonly resourcePrefix: string

	constructor(scope: Construct, id: string, props: MonitoringConstructProps) {
		super(scope, id)

		this.props = props
		this.resourcePrefix = props.prNumber
			? `${props.applicationName}-PR${props.prNumber.toString()}`
			: `${props.applicationName}-${props.environmentName}`

		// Initialize notification topics
		this.criticalAlertsTopic = this.createNotificationTopic(
			AlarmSeverity.CRITICAL,
		)
		this.warningAlertsTopic = this.createNotificationTopic(
			AlarmSeverity.WARNING,
		)
		this.infoAlertsTopic = this.createNotificationTopic(AlarmSeverity.INFO)

		// Create log groups
		this.logGroups = this.createLogGroups()

		// Create comprehensive dashboard
		this.dashboard = this.createComprehensiveDashboard()

		// Create infrastructure alarms
		this.createInfrastructureAlarms()

		// Create application alarms
		this.createApplicationAlarms()

		// Create cost monitoring alarms if enabled
		if (props.enableCostMonitoring) {
			this.createCostMonitoringAlarms()
		}
	}

	/**
	 * Create SNS topics for different alarm severities
	 */
	private createNotificationTopic(severity: AlarmSeverity): sns.Topic {
		const topic = new sns.Topic(this, `${severity}AlertsTopic`, {
			displayName: `${this.resourcePrefix} ${severity} Alerts`,
			topicName: `${this.resourcePrefix}-${severity.toLowerCase()}-alerts`,
		})

		// Add email subscriptions based on severity
		const emails =
			severity === AlarmSeverity.CRITICAL
				? this.props.criticalAlertEmails
				: this.props.warningAlertEmails

		if (emails && emails.length > 0) {
			emails.forEach((email) => {
				topic.addSubscription(
					new snsSubscriptions.EmailSubscription(email, {
						json: false,
					}),
				)
			})
		}

		// Add tags for cost tracking
		cdk.Tags.of(topic).add('Environment', this.props.environmentName)
		cdk.Tags.of(topic).add('Application', this.props.applicationName)
		cdk.Tags.of(topic).add('Component', 'Monitoring')
		cdk.Tags.of(topic).add('Severity', severity)

		if (this.props.prNumber) {
			cdk.Tags.of(topic).add('PRNumber', this.props.prNumber.toString())
		}

		return topic
	}

	/**
	 * Create log groups for application and infrastructure logging
	 */
	private createLogGroups(): logs.LogGroup[] {
		const logGroups: logs.LogGroup[] = []

		// Application log group
		const applicationLogGroup = new logs.LogGroup(this, 'ApplicationLogGroup', {
			logGroupName: `/aws/ec2/${this.resourcePrefix}/application`,
			retention: this.getLogRetentionForEnvironment(),
			removalPolicy: this.getRemovalPolicyForEnvironment(),
		})
		logGroups.push(applicationLogGroup)

		// System log group
		const systemLogGroup = new logs.LogGroup(this, 'SystemLogGroup', {
			logGroupName: `/aws/ec2/${this.resourcePrefix}/system`,
			retention: this.getLogRetentionForEnvironment(),
			removalPolicy: this.getRemovalPolicyForEnvironment(),
		})
		logGroups.push(systemLogGroup)

		// Error log group - attempt to reference existing first, create new if needed
		const errorLogGroupName = `/aws/ec2/${this.resourcePrefix}/errors`
		const contextValue: unknown = this.node.tryGetContext('reuseExistingResources')
		const shouldReuseExisting: boolean =
			contextValue !== undefined ? (contextValue as boolean) : true

		let errorLogGroup: logs.LogGroup
		if (shouldReuseExisting) {
			try {
				// Try to reference existing error log group
				console.log(
					`Attempting to reference existing error log group: ${errorLogGroupName}`,
				)
				errorLogGroup = logs.LogGroup.fromLogGroupName(
					this,
					'ExistingErrorLogGroup',
					errorLogGroupName,
				)
			} catch (error: unknown) {
				console.log(
					`Could not reference existing error log group, will create new one: ${String(error)}`,
				)
				errorLogGroup = new logs.LogGroup(this, 'ErrorLogGroup', {
					logGroupName: errorLogGroupName,
					retention: logs.RetentionDays.SIX_MONTHS, // Keep errors longer
					removalPolicy: cdk.RemovalPolicy.RETAIN, // Always retain error logs
				})
			}
		} else {
			// Create new error log group
			console.log(`Creating new error log group: ${errorLogGroupName}`)
			errorLogGroup = new logs.LogGroup(this, 'ErrorLogGroup', {
				logGroupName: errorLogGroupName,
				retention: logs.RetentionDays.SIX_MONTHS, // Keep errors longer
				removalPolicy: cdk.RemovalPolicy.RETAIN, // Always retain error logs
			})
		}
		logGroups.push(errorLogGroup)

		// Performance log group
		const performanceLogGroup = new logs.LogGroup(this, 'PerformanceLogGroup', {
			logGroupName: `/aws/ec2/${this.resourcePrefix}/performance`,
			retention: this.getLogRetentionForEnvironment(),
			removalPolicy: this.getRemovalPolicyForEnvironment(),
		})
		logGroups.push(performanceLogGroup)

		// Add tags to all log groups
		logGroups.forEach((logGroup) => {
			cdk.Tags.of(logGroup).add('Environment', this.props.environmentName)
			cdk.Tags.of(logGroup).add('Application', this.props.applicationName)
			cdk.Tags.of(logGroup).add('Component', 'Logging')

			if (this.props.prNumber) {
				cdk.Tags.of(logGroup).add('PRNumber', this.props.prNumber.toString())
			}
		})

		return logGroups
	}

	/**
	 * Get log retention period based on environment
	 */
	private getLogRetentionForEnvironment(): logs.RetentionDays {
		switch (this.props.environmentName) {
			case 'production':
				return logs.RetentionDays.SIX_MONTHS
			case 'staging':
				return logs.RetentionDays.THREE_MONTHS
			default:
				return logs.RetentionDays.ONE_MONTH
		}
	}

	/**
	 * Get removal policy based on environment
	 */
	private getRemovalPolicyForEnvironment(): cdk.RemovalPolicy {
		switch (this.props.environmentName) {
			case 'production':
				return cdk.RemovalPolicy.RETAIN
			case 'staging':
				return cdk.RemovalPolicy.SNAPSHOT
			default:
				return cdk.RemovalPolicy.DESTROY
		}
	}

	/**
	 * Create comprehensive CloudWatch dashboard
	 */
	private createComprehensiveDashboard(): cloudwatch.Dashboard {
		const dashboard = new cloudwatch.Dashboard(this, 'ComprehensiveDashboard', {
			dashboardName: `${this.resourcePrefix}-monitoring`,
			defaultInterval: cdk.Duration.hours(1),
		})

		// Add infrastructure overview widgets
		this.addInfrastructureWidgets(dashboard)

		// Add application performance widgets
		this.addApplicationPerformanceWidgets(dashboard)

		// Add cost monitoring widgets if enabled
		if (this.props.enableCostMonitoring) {
			this.addCostMonitoringWidgets(dashboard)
		}

		// Add auto scaling widgets if auto scaling groups are provided
		if (
			this.props.autoScalingGroups &&
			this.props.autoScalingGroups.length > 0
		) {
			this.addAutoScalingWidgets(dashboard)
		}

		// Add operational widgets
		this.addOperationalWidgets(dashboard)

		// Add tags
		cdk.Tags.of(dashboard).add('Environment', this.props.environmentName)
		cdk.Tags.of(dashboard).add('Application', this.props.applicationName)
		cdk.Tags.of(dashboard).add('Component', 'Monitoring')

		if (this.props.prNumber) {
			cdk.Tags.of(dashboard).add('PRNumber', this.props.prNumber.toString())
		}

		return dashboard
	}

	/**
	 * Add infrastructure monitoring widgets to dashboard
	 */
	private addInfrastructureWidgets(dashboard: cloudwatch.Dashboard): void {
		const widgets: cloudwatch.IWidget[] = []

		// EC2 Instance Metrics
		if (this.props.ec2Instances && this.props.ec2Instances.length > 0) {
			// CPU Utilization
			widgets.push(
				new cloudwatch.GraphWidget({
					title: 'EC2 CPU Utilization',
					left: this.props.ec2Instances.map(
						(instance) =>
							new cloudwatch.Metric({
								namespace: 'AWS/EC2',
								metricName: 'CPUUtilization',
								dimensionsMap: {
									InstanceId: instance.instanceId,
								},
								statistic: 'Average',
								label: `${instance.instanceId} CPU`,
							}),
					),
					width: 12,
					height: 6,
				}),
			)

			// Memory Utilization (from CloudWatch Agent)
			widgets.push(
				new cloudwatch.GraphWidget({
					title: 'EC2 Memory Utilization',
					left: this.props.ec2Instances.map(
						(instance) =>
							new cloudwatch.Metric({
								namespace: 'CWAgent',
								metricName: 'mem_used_percent',
								dimensionsMap: {
									InstanceId: instance.instanceId,
								},
								statistic: 'Average',
								label: `${instance.instanceId} Memory`,
							}),
					),
					width: 12,
					height: 6,
				}),
			)

			// Network I/O
			widgets.push(
				new cloudwatch.GraphWidget({
					title: 'EC2 Network I/O',
					left: this.props.ec2Instances.map(
						(instance) =>
							new cloudwatch.Metric({
								namespace: 'AWS/EC2',
								metricName: 'NetworkIn',
								dimensionsMap: {
									InstanceId: instance.instanceId,
								},
								statistic: 'Average',
								label: `${instance.instanceId} Network In`,
							}),
					),
					right: this.props.ec2Instances.map(
						(instance) =>
							new cloudwatch.Metric({
								namespace: 'AWS/EC2',
								metricName: 'NetworkOut',
								dimensionsMap: {
									InstanceId: instance.instanceId,
								},
								statistic: 'Average',
								label: `${instance.instanceId} Network Out`,
							}),
					),
					width: 12,
					height: 6,
				}),
			)

			// Disk I/O
			widgets.push(
				new cloudwatch.GraphWidget({
					title: 'EC2 Disk I/O',
					left: this.props.ec2Instances.map(
						(instance) =>
							new cloudwatch.Metric({
								namespace: 'AWS/EC2',
								metricName: 'DiskReadBytes',
								dimensionsMap: {
									InstanceId: instance.instanceId,
								},
								statistic: 'Average',
								label: `${instance.instanceId} Disk Read`,
							}),
					),
					right: this.props.ec2Instances.map(
						(instance) =>
							new cloudwatch.Metric({
								namespace: 'AWS/EC2',
								metricName: 'DiskWriteBytes',
								dimensionsMap: {
									InstanceId: instance.instanceId,
								},
								statistic: 'Average',
								label: `${instance.instanceId} Disk Write`,
							}),
					),
					width: 12,
					height: 6,
				}),
			)
		}

		// ALB Metrics
		if (this.props.applicationLoadBalancer) {
			// Request Count and Response Time
			widgets.push(
				new cloudwatch.GraphWidget({
					title: 'ALB Request Count & Response Time',
					left: [
						new cloudwatch.Metric({
							namespace: 'AWS/ApplicationELB',
							metricName: 'RequestCount',
							dimensionsMap: {
								LoadBalancer:
									this.props.applicationLoadBalancer.loadBalancerFullName,
							},
							statistic: 'Sum',
							label: 'Request Count',
						}),
					],
					right: [
						new cloudwatch.Metric({
							namespace: 'AWS/ApplicationELB',
							metricName: 'TargetResponseTime',
							dimensionsMap: {
								LoadBalancer:
									this.props.applicationLoadBalancer.loadBalancerFullName,
							},
							statistic: 'Average',
							label: 'Response Time (avg)',
						}),
						new cloudwatch.Metric({
							namespace: 'AWS/ApplicationELB',
							metricName: 'TargetResponseTime',
							dimensionsMap: {
								LoadBalancer:
									this.props.applicationLoadBalancer.loadBalancerFullName,
							},
							statistic: 'p95',
							label: 'Response Time (p95)',
						}),
					],
					width: 12,
					height: 6,
				}),
			)

			// HTTP Status Codes
			widgets.push(
				new cloudwatch.GraphWidget({
					title: 'ALB HTTP Status Codes',
					left: [
						new cloudwatch.Metric({
							namespace: 'AWS/ApplicationELB',
							metricName: 'HTTPCode_Target_2XX_Count',
							dimensionsMap: {
								LoadBalancer:
									this.props.applicationLoadBalancer.loadBalancerFullName,
							},
							statistic: 'Sum',
							label: '2XX Success',
							color: cloudwatch.Color.GREEN,
						}),
						new cloudwatch.Metric({
							namespace: 'AWS/ApplicationELB',
							metricName: 'HTTPCode_Target_4XX_Count',
							dimensionsMap: {
								LoadBalancer:
									this.props.applicationLoadBalancer.loadBalancerFullName,
							},
							statistic: 'Sum',
							label: '4XX Client Error',
							color: cloudwatch.Color.ORANGE,
						}),
						new cloudwatch.Metric({
							namespace: 'AWS/ApplicationELB',
							metricName: 'HTTPCode_Target_5XX_Count',
							dimensionsMap: {
								LoadBalancer:
									this.props.applicationLoadBalancer.loadBalancerFullName,
							},
							statistic: 'Sum',
							label: '5XX Server Error',
							color: cloudwatch.Color.RED,
						}),
					],
					width: 12,
					height: 6,
				}),
			)

			// Target Health
			if (this.props.targetGroups && this.props.targetGroups.length > 0) {
				const albFullName =
					this.props.applicationLoadBalancer.loadBalancerFullName
				if (albFullName) {
					widgets.push(
						new cloudwatch.GraphWidget({
							title: 'ALB Target Health',
							left: this.props.targetGroups.flatMap((tg) => [
								new cloudwatch.Metric({
									namespace: 'AWS/ApplicationELB',
									metricName: 'HealthyHostCount',
									dimensionsMap: {
										TargetGroup: tg.targetGroupFullName,
										LoadBalancer: albFullName,
									},
									statistic: 'Average',
									label: `${tg.targetGroupName} Healthy`,
									color: cloudwatch.Color.GREEN,
								}),
								new cloudwatch.Metric({
									namespace: 'AWS/ApplicationELB',
									metricName: 'UnHealthyHostCount',
									dimensionsMap: {
										TargetGroup: tg.targetGroupFullName,
										LoadBalancer: albFullName,
									},
									statistic: 'Average',
									label: `${tg.targetGroupName} Unhealthy`,
									color: cloudwatch.Color.RED,
								}),
							]),
							width: 12,
							height: 6,
						}),
					)
				}
			}
		}

		// Add all widgets to dashboard
		if (widgets.length > 0) {
			dashboard.addWidgets(...widgets)
		}
	}

	/**
	 * Add application performance monitoring widgets
	 */
	private addApplicationPerformanceWidgets(
		dashboard: cloudwatch.Dashboard,
	): void {
		const widgets: cloudwatch.IWidget[] = []
		const namespace = this.props.customMetricNamespace ?? 'MacroAI/API'

		// API Response Times
		widgets.push(
			new cloudwatch.GraphWidget({
				title: 'API Response Times',
				left: [
					new cloudwatch.Metric({
						namespace,
						metricName: 'RequestDuration',
						statistic: 'Average',
						label: 'Average Response Time',
						color: cloudwatch.Color.BLUE,
					}),
					new cloudwatch.Metric({
						namespace,
						metricName: 'RequestDuration',
						statistic: 'p95',
						label: '95th Percentile',
						color: cloudwatch.Color.ORANGE,
					}),
					new cloudwatch.Metric({
						namespace,
						metricName: 'RequestDuration',
						statistic: 'p99',
						label: '99th Percentile',
						color: cloudwatch.Color.RED,
					}),
				],
				width: 12,
				height: 6,
			}),
		)

		// API Request Volume and Error Rate
		widgets.push(
			new cloudwatch.GraphWidget({
				title: 'API Request Volume & Error Rate',
				left: [
					new cloudwatch.Metric({
						namespace,
						metricName: 'RequestCount',
						statistic: 'Sum',
						label: 'Total Requests',
						color: cloudwatch.Color.GREEN,
					}),
				],
				right: [
					new cloudwatch.Metric({
						namespace,
						metricName: 'ErrorCount',
						statistic: 'Sum',
						label: 'Error Count',
						color: cloudwatch.Color.RED,
					}),
					new cloudwatch.MathExpression({
						expression: '(errors / requests) * 100',
						usingMetrics: {
							errors: new cloudwatch.Metric({
								namespace,
								metricName: 'ErrorCount',
								statistic: 'Sum',
							}),
							requests: new cloudwatch.Metric({
								namespace,
								metricName: 'RequestCount',
								statistic: 'Sum',
							}),
						},
						label: 'Error Rate %',
						color: cloudwatch.Color.PURPLE,
					}),
				],
				width: 12,
				height: 6,
			}),
		)

		// Database Performance
		widgets.push(
			new cloudwatch.GraphWidget({
				title: 'Database Performance',
				left: [
					new cloudwatch.Metric({
						namespace,
						metricName: 'DatabaseQueryDuration',
						statistic: 'Average',
						label: 'Avg Query Time',
						color: cloudwatch.Color.BLUE,
					}),
					new cloudwatch.Metric({
						namespace,
						metricName: 'DatabaseQueryDuration',
						statistic: 'p95',
						label: '95th Percentile Query Time',
						color: cloudwatch.Color.ORANGE,
					}),
				],
				right: [
					new cloudwatch.Metric({
						namespace,
						metricName: 'DatabaseConnectionCount',
						statistic: 'Average',
						label: 'Active Connections',
						color: cloudwatch.Color.GREEN,
					}),
					new cloudwatch.Metric({
						namespace,
						metricName: 'DatabaseErrorCount',
						statistic: 'Sum',
						label: 'Database Errors',
						color: cloudwatch.Color.RED,
					}),
				],
				width: 12,
				height: 6,
			}),
		)

		// Health Check Status
		widgets.push(
			new cloudwatch.SingleValueWidget({
				title: 'Health Check Status',
				metrics: [
					new cloudwatch.Metric({
						namespace,
						metricName: 'HealthCheckSuccess',
						statistic: 'Average',
						label: 'Health Check Success Rate',
					}),
				],
				width: 6,
				height: 6,
			}),
		)

		// Application Uptime
		widgets.push(
			new cloudwatch.SingleValueWidget({
				title: 'Application Uptime',
				metrics: [
					new cloudwatch.Metric({
						namespace,
						metricName: 'ApplicationUptime',
						statistic: 'Maximum',
						label: 'Uptime (seconds)',
					}),
				],
				width: 6,
				height: 6,
			}),
		)

		// Add all widgets to dashboard
		if (widgets.length > 0) {
			dashboard.addWidgets(...widgets)
		}
	}

	/**
	 * Add cost monitoring widgets
	 */
	private addCostMonitoringWidgets(dashboard: cloudwatch.Dashboard): void {
		const widgets: cloudwatch.IWidget[] = []

		// EC2 Cost Tracking
		if (this.props.ec2Instances && this.props.ec2Instances.length > 0) {
			widgets.push(
				new cloudwatch.GraphWidget({
					title: 'EC2 Instance Hours',
					left: this.props.ec2Instances.map(
						(instance) =>
							new cloudwatch.Metric({
								namespace: 'AWS/EC2',
								metricName: 'StatusCheckPassed',
								dimensionsMap: {
									InstanceId: instance.instanceId,
								},
								statistic: 'Sum',
								label: `${instance.instanceId} Running Hours`,
							}),
					),
					width: 12,
					height: 6,
				}),
			)
		}

		// Data Transfer Costs
		widgets.push(
			new cloudwatch.GraphWidget({
				title: 'Data Transfer (Cost Impact)',
				left: [
					new cloudwatch.Metric({
						namespace: 'AWS/ApplicationELB',
						metricName: 'ProcessedBytes',
						dimensionsMap: this.props.applicationLoadBalancer
							? {
									LoadBalancer:
										this.props.applicationLoadBalancer.loadBalancerFullName,
								}
							: {},
						statistic: 'Sum',
						label: 'ALB Data Transfer',
					}),
				],
				width: 12,
				height: 6,
			}),
		)

		// Add all widgets to dashboard
		if (widgets.length > 0) {
			dashboard.addWidgets(...widgets)
		}
	}

	/**
	 * Add auto scaling monitoring widgets
	 */
	private addAutoScalingWidgets(dashboard: cloudwatch.Dashboard): void {
		const widgets: cloudwatch.IWidget[] = []

		if (
			!this.props.autoScalingGroups ||
			this.props.autoScalingGroups.length === 0
		) {
			return
		}

		// Auto Scaling Group Capacity
		widgets.push(
			new cloudwatch.GraphWidget({
				title: 'Auto Scaling Group Capacity',
				left: this.props.autoScalingGroups.flatMap((asgName) => [
					new cloudwatch.Metric({
						namespace: 'AWS/AutoScaling',
						metricName: 'GroupDesiredCapacity',
						dimensionsMap: {
							AutoScalingGroupName: asgName,
						},
						statistic: 'Average',
						label: `${asgName} Desired`,
						color: cloudwatch.Color.BLUE,
					}),
					new cloudwatch.Metric({
						namespace: 'AWS/AutoScaling',
						metricName: 'GroupInServiceInstances',
						dimensionsMap: {
							AutoScalingGroupName: asgName,
						},
						statistic: 'Average',
						label: `${asgName} In Service`,
						color: cloudwatch.Color.GREEN,
					}),
					new cloudwatch.Metric({
						namespace: 'AWS/AutoScaling',
						metricName: 'GroupTotalInstances',
						dimensionsMap: {
							AutoScalingGroupName: asgName,
						},
						statistic: 'Average',
						label: `${asgName} Total`,
						color: cloudwatch.Color.ORANGE,
					}),
				]),
				width: 12,
				height: 6,
			}),
		)

		// Scaling Activities
		widgets.push(
			new cloudwatch.GraphWidget({
				title: 'Auto Scaling Activities',
				left: this.props.autoScalingGroups.map(
					(asgName) =>
						new cloudwatch.Metric({
							namespace: 'AWS/AutoScaling',
							metricName: 'GroupPendingInstances',
							dimensionsMap: {
								AutoScalingGroupName: asgName,
							},
							statistic: 'Average',
							label: `${asgName} Pending`,
							color: cloudwatch.Color.PURPLE,
						}),
				),
				right: this.props.autoScalingGroups.map(
					(asgName) =>
						new cloudwatch.Metric({
							namespace: 'AWS/AutoScaling',
							metricName: 'GroupTerminatingInstances',
							dimensionsMap: {
								AutoScalingGroupName: asgName,
							},
							statistic: 'Average',
							label: `${asgName} Terminating`,
							color: cloudwatch.Color.RED,
						}),
				),
				width: 12,
				height: 6,
			}),
		)

		// Instance Launch/Termination Rate
		widgets.push(
			new cloudwatch.GraphWidget({
				title: 'Instance Launch/Termination Rate',
				left: this.props.autoScalingGroups.map(
					(asgName) =>
						new cloudwatch.Metric({
							namespace: 'AWS/AutoScaling',
							metricName: 'GroupTotalInstances',
							dimensionsMap: {
								AutoScalingGroupName: asgName,
							},
							statistic: 'Sum',
							label: `${asgName} Changes`,
						}),
				),
				width: 12,
				height: 6,
			}),
		)

		// Auto Scaling Group Health
		widgets.push(
			new cloudwatch.SingleValueWidget({
				title: 'Auto Scaling Group Health',
				metrics: this.props.autoScalingGroups.map(
					(asgName) =>
						new cloudwatch.Metric({
							namespace: 'AWS/AutoScaling',
							metricName: 'GroupInServiceInstances',
							dimensionsMap: {
								AutoScalingGroupName: asgName,
							},
							statistic: 'Average',
							label: `${asgName} Healthy Instances`,
						}),
				),
				width: 12,
				height: 6,
			}),
		)

		// Add all widgets to dashboard
		if (widgets.length > 0) {
			dashboard.addWidgets(...widgets)
		}
	}

	/**
	 * Add operational monitoring widgets
	 */
	private addOperationalWidgets(dashboard: cloudwatch.Dashboard): void {
		const widgets: cloudwatch.IWidget[] = []

		// Log Groups Summary (Text Widget)
		const errorLogGroup = this.logGroups.find((lg) =>
			lg.logGroupName.includes('error'),
		)
		const performanceLogGroup = this.logGroups.find((lg) =>
			lg.logGroupName.includes('performance'),
		)

		if (errorLogGroup || performanceLogGroup) {
			widgets.push(
				new cloudwatch.TextWidget({
					markdown: `
## Log Groups

${errorLogGroup ? `**Error Logs**: [${errorLogGroup.logGroupName}](https://console.aws.amazon.com/cloudwatch/home#logsV2:log-groups/log-group/${encodeURIComponent(errorLogGroup.logGroupName)})` : ''}

${performanceLogGroup ? `**Performance Logs**: [${performanceLogGroup.logGroupName}](https://console.aws.amazon.com/cloudwatch/home#logsV2:log-groups/log-group/${encodeURIComponent(performanceLogGroup.logGroupName)})` : ''}

**Quick Queries**:
- Recent errors: \`fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 100\`
- Performance metrics: \`fields @timestamp, @message | filter @message like /PERFORMANCE/ | sort @timestamp desc | limit 50\`
					`.trim(),
					width: 24,
					height: 6,
				}),
			)
		}

		// Add all widgets to dashboard
		if (widgets.length > 0) {
			dashboard.addWidgets(...widgets)
		}
	}

	/**
	 * Create infrastructure monitoring alarms
	 */
	private createInfrastructureAlarms(): void {
		if (!this.props.ec2Instances || this.props.ec2Instances.length === 0) {
			return
		}

		this.props.ec2Instances.forEach((instance, index) => {
			const instancePrefix = `Instance${index.toString()}`

			// Critical: High CPU utilization
			this.createAlarm({
				id: `${instancePrefix}HighCpuAlarm`,
				alarmName: `${this.resourcePrefix}-${instancePrefix}-high-cpu`,
				metric: new cloudwatch.Metric({
					namespace: 'AWS/EC2',
					metricName: 'CPUUtilization',
					dimensionsMap: {
						InstanceId: instance.instanceId,
					},
					statistic: 'Average',
				}),
				threshold: this.getCpuThresholdForEnvironment(),
				evaluationPeriods: 3,
				comparisonOperator:
					cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
				alarmDescription: `High CPU utilization on ${instance.instanceId}`,
				severity: AlarmSeverity.CRITICAL,
			})

			// Critical: Instance status check failure
			this.createAlarm({
				id: `${instancePrefix}StatusCheckAlarm`,
				alarmName: `${this.resourcePrefix}-${instancePrefix}-status-check`,
				metric: new cloudwatch.Metric({
					namespace: 'AWS/EC2',
					metricName: 'StatusCheckFailed',
					dimensionsMap: {
						InstanceId: instance.instanceId,
					},
					statistic: 'Maximum',
				}),
				threshold: 1,
				evaluationPeriods: 2,
				comparisonOperator:
					cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
				alarmDescription: `Status check failed for ${instance.instanceId}`,
				severity: AlarmSeverity.CRITICAL,
			})

			// Warning: High memory utilization (requires CloudWatch Agent)
			this.createAlarm({
				id: `${instancePrefix}HighMemoryAlarm`,
				alarmName: `${this.resourcePrefix}-${instancePrefix}-high-memory`,
				metric: new cloudwatch.Metric({
					namespace: 'CWAgent',
					metricName: 'mem_used_percent',
					dimensionsMap: {
						InstanceId: instance.instanceId,
					},
					statistic: 'Average',
				}),
				threshold: 85,
				evaluationPeriods: 3,
				comparisonOperator:
					cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
				alarmDescription: `High memory utilization on ${instance.instanceId}`,
				severity: AlarmSeverity.WARNING,
				treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
			})

			// Warning: High disk utilization
			this.createAlarm({
				id: `${instancePrefix}HighDiskAlarm`,
				alarmName: `${this.resourcePrefix}-${instancePrefix}-high-disk`,
				metric: new cloudwatch.Metric({
					namespace: 'CWAgent',
					metricName: 'disk_used_percent',
					dimensionsMap: {
						InstanceId: instance.instanceId,
						device: '/dev/xvda1',
						fstype: 'ext4',
						path: '/',
					},
					statistic: 'Average',
				}),
				threshold: 80,
				evaluationPeriods: 2,
				comparisonOperator:
					cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
				alarmDescription: `High disk utilization on ${instance.instanceId}`,
				severity: AlarmSeverity.WARNING,
				treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
			})
		})

		// ALB-specific alarms
		if (this.props.applicationLoadBalancer) {
			this.createAlbAlarms()
		}
	}

	/**
	 * Create ALB-specific monitoring alarms
	 */
	private createAlbAlarms(): void {
		if (!this.props.applicationLoadBalancer) {
			return
		}

		const alb = this.props.applicationLoadBalancer

		// Critical: High response time
		this.createAlarm({
			id: 'AlbHighResponseTimeAlarm',
			alarmName: `${this.resourcePrefix}-alb-high-response-time`,
			metric: new cloudwatch.Metric({
				namespace: 'AWS/ApplicationELB',
				metricName: 'TargetResponseTime',
				dimensionsMap: {
					LoadBalancer: alb.loadBalancerFullName,
				},
				statistic: 'Average',
			}),
			threshold: this.getResponseTimeThresholdForEnvironment(),
			evaluationPeriods: 2,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			alarmDescription: `High response time for ${alb.loadBalancerName}`,
			severity: AlarmSeverity.CRITICAL,
		})

		// Critical: High 5xx error rate
		this.createAlarm({
			id: 'AlbHigh5xxErrorAlarm',
			alarmName: `${this.resourcePrefix}-alb-high-5xx-errors`,
			metric: new cloudwatch.Metric({
				namespace: 'AWS/ApplicationELB',
				metricName: 'HTTPCode_Target_5XX_Count',
				dimensionsMap: {
					LoadBalancer: alb.loadBalancerFullName,
				},
				statistic: 'Sum',
			}),
			threshold: this.getErrorThresholdForEnvironment(),
			evaluationPeriods: 2,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			alarmDescription: `High 5xx error rate for ${alb.loadBalancerName}`,
			severity: AlarmSeverity.CRITICAL,
		})

		// Warning: High 4xx error rate
		this.createAlarm({
			id: 'AlbHigh4xxErrorAlarm',
			alarmName: `${this.resourcePrefix}-alb-high-4xx-errors`,
			metric: new cloudwatch.Metric({
				namespace: 'AWS/ApplicationELB',
				metricName: 'HTTPCode_Target_4XX_Count',
				dimensionsMap: {
					LoadBalancer: alb.loadBalancerFullName,
				},
				statistic: 'Sum',
			}),
			threshold: this.getErrorThresholdForEnvironment() * 2, // Higher threshold for 4xx
			evaluationPeriods: 3,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			alarmDescription: `High 4xx error rate for ${alb.loadBalancerName}`,
			severity: AlarmSeverity.WARNING,
		})

		// Critical: Unhealthy targets
		if (this.props.targetGroups && this.props.targetGroups.length > 0) {
			this.props.targetGroups.forEach((tg, index) => {
				this.createAlarm({
					id: `AlbUnhealthyTargets${index.toString()}Alarm`,
					alarmName: `${this.resourcePrefix}-alb-unhealthy-targets-${index.toString()}`,
					metric: new cloudwatch.Metric({
						namespace: 'AWS/ApplicationELB',
						metricName: 'UnHealthyHostCount',
						dimensionsMap: {
							TargetGroup: tg.targetGroupFullName,
							LoadBalancer: alb.loadBalancerFullName,
						},
						statistic: 'Average',
					}),
					threshold: 1,
					evaluationPeriods: 2,
					comparisonOperator:
						cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
					alarmDescription: `Unhealthy targets in ${tg.targetGroupName}`,
					severity: AlarmSeverity.CRITICAL,
				})
			})
		}
	}

	/**
	 * Create application-level monitoring alarms
	 */
	private createApplicationAlarms(): void {
		const namespace = this.props.customMetricNamespace ?? 'MacroAI/API'

		// Critical: High error rate
		this.createAlarm({
			id: 'ApplicationHighErrorRateAlarm',
			alarmName: `${this.resourcePrefix}-app-high-error-rate`,
			metric: new cloudwatch.MathExpression({
				expression: '(errors / requests) * 100',
				usingMetrics: {
					errors: new cloudwatch.Metric({
						namespace,
						metricName: 'ErrorCount',
						statistic: 'Sum',
					}),
					requests: new cloudwatch.Metric({
						namespace,
						metricName: 'RequestCount',
						statistic: 'Sum',
					}),
				},
			}),
			threshold: this.getApplicationErrorRateThresholdForEnvironment(),
			evaluationPeriods: 2,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			alarmDescription: 'High application error rate',
			severity: AlarmSeverity.CRITICAL,
		})

		// Warning: Slow response times
		this.createAlarm({
			id: 'ApplicationSlowResponseAlarm',
			alarmName: `${this.resourcePrefix}-app-slow-response`,
			metric: new cloudwatch.Metric({
				namespace,
				metricName: 'RequestDuration',
				statistic: 'Average',
			}),
			threshold: this.getApplicationResponseTimeThresholdForEnvironment(),
			evaluationPeriods: 3,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			alarmDescription: 'Slow application response times',
			severity: AlarmSeverity.WARNING,
		})

		// Critical: Health check failures
		this.createAlarm({
			id: 'ApplicationHealthCheckFailureAlarm',
			alarmName: `${this.resourcePrefix}-app-health-check-failure`,
			metric: new cloudwatch.Metric({
				namespace,
				metricName: 'HealthCheckSuccess',
				statistic: 'Average',
			}),
			threshold: 0.8, // 80% success rate
			evaluationPeriods: 2,
			comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
			alarmDescription: 'Application health check failures',
			severity: AlarmSeverity.CRITICAL,
		})
	}

	/**
	 * Create cost monitoring alarms
	 */
	private createCostMonitoringAlarms(): void {
		// Data transfer cost alarm
		if (this.props.applicationLoadBalancer) {
			this.createAlarm({
				id: 'HighDataTransferAlarm',
				alarmName: `${this.resourcePrefix}-high-data-transfer`,
				metric: new cloudwatch.Metric({
					namespace: 'AWS/ApplicationELB',
					metricName: 'ProcessedBytes',
					dimensionsMap: {
						LoadBalancer:
							this.props.applicationLoadBalancer.loadBalancerFullName,
					},
					statistic: 'Sum',
				}),
				threshold: this.getDataTransferThresholdForEnvironment(),
				evaluationPeriods: 1,
				comparisonOperator:
					cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
				alarmDescription: 'High data transfer costs detected',
				severity: AlarmSeverity.WARNING,
			})
		}

		// Instance running time alarm (for cost control)
		if (this.props.ec2Instances && this.props.ec2Instances.length > 0) {
			this.props.ec2Instances.forEach((instance, index) => {
				this.createAlarm({
					id: `Instance${index.toString()}LongRunningAlarm`,
					alarmName: `${this.resourcePrefix}-instance-${index.toString()}-long-running`,
					metric: new cloudwatch.Metric({
						namespace: 'AWS/EC2',
						metricName: 'StatusCheckPassed',
						dimensionsMap: {
							InstanceId: instance.instanceId,
						},
						statistic: 'Sum',
					}),
					threshold: this.getInstanceRunningHoursThresholdForEnvironment(),
					evaluationPeriods: 1,
					comparisonOperator:
						cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
					alarmDescription: `Instance ${instance.instanceId} running for extended period`,
					severity: AlarmSeverity.INFO,
				})
			})
		}
	}

	/**
	 * Create a CloudWatch alarm with standardized configuration
	 */
	private createAlarm(config: {
		id: string
		alarmName: string
		metric: cloudwatch.IMetric
		threshold: number
		evaluationPeriods: number
		comparisonOperator: cloudwatch.ComparisonOperator
		alarmDescription: string
		severity: AlarmSeverity
		treatMissingData?: cloudwatch.TreatMissingData
	}): cloudwatch.Alarm {
		const alarm = new cloudwatch.Alarm(this, config.id, {
			alarmName: config.alarmName,
			metric: config.metric,
			threshold: config.threshold,
			evaluationPeriods: config.evaluationPeriods,
			comparisonOperator: config.comparisonOperator,
			alarmDescription: config.alarmDescription,
			treatMissingData:
				config.treatMissingData ?? cloudwatch.TreatMissingData.BREACHING,
		})

		// Add appropriate alarm actions based on severity
		const topic = this.getTopicForSeverity(config.severity)
		alarm.addAlarmAction(new cloudwatchActions.SnsAction(topic))
		alarm.addOkAction(new cloudwatchActions.SnsAction(topic))

		// Add tags
		cdk.Tags.of(alarm).add('Environment', this.props.environmentName)
		cdk.Tags.of(alarm).add('Application', this.props.applicationName)
		cdk.Tags.of(alarm).add('Component', 'Monitoring')
		cdk.Tags.of(alarm).add('Severity', config.severity)

		if (this.props.prNumber) {
			cdk.Tags.of(alarm).add('PRNumber', this.props.prNumber.toString())
		}

		return alarm
	}

	/**
	 * Get SNS topic for alarm severity
	 */
	private getTopicForSeverity(severity: AlarmSeverity): sns.Topic {
		switch (severity) {
			case AlarmSeverity.CRITICAL:
				return this.criticalAlertsTopic
			case AlarmSeverity.WARNING:
				return this.warningAlertsTopic
			case AlarmSeverity.INFO:
				return this.infoAlertsTopic
			default:
				return this.warningAlertsTopic
		}
	}

	/**
	 * Get CPU threshold based on environment
	 */
	private getCpuThresholdForEnvironment(): number {
		switch (this.props.environmentName) {
			case 'production':
				return 80 // More conservative for production
			case 'staging':
				return 85
			default:
				return 90 // More lenient for development
		}
	}

	/**
	 * Get response time threshold based on environment (in seconds)
	 */
	private getResponseTimeThresholdForEnvironment(): number {
		switch (this.props.environmentName) {
			case 'production':
				return 2.0 // 2 seconds for production
			case 'staging':
				return 3.0
			default:
				return 5.0 // More lenient for development
		}
	}

	/**
	 * Get error threshold based on environment
	 */
	private getErrorThresholdForEnvironment(): number {
		switch (this.props.environmentName) {
			case 'production':
				return 5 // 5 errors in evaluation period
			case 'staging':
				return 10
			default:
				return 20 // More lenient for development
		}
	}

	/**
	 * Get application error rate threshold based on environment (percentage)
	 */
	private getApplicationErrorRateThresholdForEnvironment(): number {
		switch (this.props.environmentName) {
			case 'production':
				return 2.0 // 2% error rate
			case 'staging':
				return 5.0
			default:
				return 10.0 // More lenient for development
		}
	}

	/**
	 * Get application response time threshold based on environment (milliseconds)
	 */
	private getApplicationResponseTimeThresholdForEnvironment(): number {
		switch (this.props.environmentName) {
			case 'production':
				return 1000 // 1 second
			case 'staging':
				return 2000
			default:
				return 3000 // More lenient for development
		}
	}

	/**
	 * Get data transfer threshold based on environment (bytes)
	 */
	private getDataTransferThresholdForEnvironment(): number {
		switch (this.props.environmentName) {
			case 'production':
				return 10 * 1024 * 1024 * 1024 // 10 GB
			case 'staging':
				return 5 * 1024 * 1024 * 1024 // 5 GB
			default:
				return 1 * 1024 * 1024 * 1024 // 1 GB
		}
	}

	/**
	 * Get instance running hours threshold based on environment
	 */
	private getInstanceRunningHoursThresholdForEnvironment(): number {
		switch (this.props.environmentName) {
			case 'production':
				return 24 * 30 // 30 days (always running is expected)
			case 'staging':
				return 24 * 7 // 7 days
			default:
				return 24 * 2 // 2 days for development/PR environments
		}
	}

	/**
	 * Get monitoring configuration summary for documentation
	 */
	public getMonitoringConfigurationSummary(): string {
		const instanceCount = this.props.ec2Instances?.length ?? 0
		const targetGroupCount = this.props.targetGroups?.length ?? 0
		const hasAlb = !!this.props.applicationLoadBalancer
		const hasCostMonitoring = !!this.props.enableCostMonitoring

		return `
Macro AI CloudWatch Monitoring Configuration Summary:

Environment: ${this.props.environmentName}
Application: ${this.props.applicationName}
${this.props.prNumber ? `PR Number: ${this.props.prNumber.toString()}` : ''}

Dashboard: ${this.dashboard.dashboardName}
- Infrastructure metrics: ${instanceCount} EC2 instances, ${hasAlb ? '1 ALB' : 'No ALB'}
- Application metrics: API performance, health checks, database
- Cost monitoring: ${hasCostMonitoring ? 'Enabled' : 'Disabled'}
- Log groups: ${this.logGroups.length} groups

Notification Topics:
- Critical alerts: ${this.criticalAlertsTopic.topicName}
- Warning alerts: ${this.warningAlertsTopic.topicName}
- Info alerts: ${this.infoAlertsTopic.topicName}

Alarm Thresholds (Environment: ${this.props.environmentName}):
- CPU utilization: ${this.getCpuThresholdForEnvironment()}%
- Response time: ${this.getResponseTimeThresholdForEnvironment()}s
- Error rate: ${this.getApplicationErrorRateThresholdForEnvironment()}%
- Application response time: ${this.getApplicationResponseTimeThresholdForEnvironment()}ms

Monitoring Coverage:
- EC2 instances: ${instanceCount} monitored
- Target groups: ${targetGroupCount} monitored
- Application metrics: Enabled
- Cost tracking: ${hasCostMonitoring ? 'Enabled' : 'Disabled'}
- Log retention: ${this.getLogRetentionForEnvironment()} days
		`.trim()
	}
}
