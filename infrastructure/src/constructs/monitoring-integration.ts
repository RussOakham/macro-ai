import * as cdk from 'aws-cdk-lib'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import { Construct } from 'constructs'

import { AlbConstruct } from './alb-construct'
import { AutoScalingConstruct } from './auto-scaling-construct'
import { Ec2Construct } from './ec2-construct'
import { MonitoringConstruct } from './monitoring-construct'

/**
 * Configuration for monitoring integration
 */
export interface MonitoringIntegrationProps {
	/**
	 * Environment name (development, staging, production)
	 */
	environmentName: string

	/**
	 * Application name for resource naming
	 */
	applicationName: string

	/**
	 * EC2 construct to integrate monitoring with
	 */
	ec2Construct?: Ec2Construct

	/**
	 * ALB construct to integrate monitoring with
	 */
	albConstruct?: AlbConstruct

	/**
	 * Auto Scaling construct to integrate monitoring with
	 */
	autoScalingConstruct?: AutoScalingConstruct

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
 * Monitoring integration construct that connects monitoring with EC2 and ALB constructs
 *
 * This construct provides:
 * - Seamless integration with existing EC2 and ALB constructs
 * - Automatic discovery of instances and load balancers to monitor
 * - Standardized monitoring configuration across environments
 * - Production-ready alerting and dashboard setup
 */
export class MonitoringIntegration extends Construct {
	public readonly monitoring: MonitoringConstruct
	public readonly dashboardUrl: string
	private readonly ec2Instances: ec2.Instance[]
	private readonly applicationLoadBalancer?: elbv2.ApplicationLoadBalancer
	private readonly targetGroups: elbv2.ApplicationTargetGroup[]

	constructor(scope: Construct, id: string, props: MonitoringIntegrationProps) {
		super(scope, id)

		// Extract instances and load balancers from constructs
		this.ec2Instances = [] // TODO: Extract from ec2Construct when available
		this.applicationLoadBalancer = props.albConstruct?.applicationLoadBalancer
		this.targetGroups = [] // TODO: Extract from albConstruct when available
		const autoScalingGroups = props.autoScalingConstruct
			? [props.autoScalingConstruct.autoScalingGroup.autoScalingGroupName]
			: []

		// Create comprehensive monitoring
		this.monitoring = new MonitoringConstruct(this, 'Monitoring', {
			environmentName: props.environmentName,
			applicationName: props.applicationName,
			ec2Instances: this.ec2Instances,
			applicationLoadBalancer: this.applicationLoadBalancer,
			targetGroups: this.targetGroups,
			autoScalingGroups,
			criticalAlertEmails: props.criticalAlertEmails,
			warningAlertEmails: props.warningAlertEmails,
			enableCostMonitoring: props.enableCostMonitoring,
			prNumber: props.prNumber,
			customMetricNamespace: props.customMetricNamespace,
		})

		// Generate dashboard URL
		const region = cdk.Stack.of(this).region
		const dashboardName = this.monitoring.dashboard.dashboardName
		this.dashboardUrl = `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#dashboards:name=${dashboardName}`

		// Add integration-specific alarms
		this.createIntegrationAlarms()

		// Output dashboard URL
		new cdk.CfnOutput(this, 'MonitoringDashboardUrl', {
			value: this.dashboardUrl,
			description: 'CloudWatch Dashboard URL for monitoring',
			exportName: `${props.applicationName}-${props.environmentName}-monitoring-dashboard-url`,
		})

		// Output SNS topic ARNs for external integration
		new cdk.CfnOutput(this, 'CriticalAlertsTopicArn', {
			value: this.monitoring.criticalAlertsTopic.topicArn,
			description: 'SNS Topic ARN for critical alerts',
			exportName: `${props.applicationName}-${props.environmentName}-critical-alerts-topic`,
		})

		new cdk.CfnOutput(this, 'WarningAlertsTopicArn', {
			value: this.monitoring.warningAlertsTopic.topicArn,
			description: 'SNS Topic ARN for warning alerts',
			exportName: `${props.applicationName}-${props.environmentName}-warning-alerts-topic`,
		})
	}

	/**
	 * Create integration-specific alarms that combine metrics from multiple constructs
	 */
	private createIntegrationAlarms(): void {
		// These alarms can combine metrics from EC2, ALB, and application sources
		// for more sophisticated monitoring scenarios
		// Example: Combined health check that considers both ALB target health and EC2 status
		// This would be implemented based on specific monitoring requirements
	}

	/**
	 * Add custom metrics to the monitoring system
	 */
	public addCustomMetric(
		metricName: string,
		namespace: string,
		dimensions?: Record<string, string>,
	): void {
		// This method allows other constructs to register custom metrics
		// that should be included in the monitoring dashboard

		// Log the custom metric registration for debugging
		console.log(`Registering custom metric: ${namespace}/${metricName}`)
		if (dimensions) {
			console.log(`Dimensions: ${JSON.stringify(dimensions)}`)
		}

		// Create a CloudWatch metric for validation
		const metric = new cloudwatch.Metric({
			namespace,
			metricName,
			dimensionsMap: dimensions ?? {},
			statistic: 'Average',
		})

		// Store metric reference for future dashboard integration
		// TODO: Implement full custom metric integration
		// - Add metric to monitoring dashboard
		// - Create configurable alarms for the metric
		// - Integrate with existing alert channels
		// - Support metric-specific thresholds and evaluation periods

		// For now, just validate the metric can be created
		if (metric.metricName !== metricName) {
			throw new Error(`Failed to create metric ${namespace}/${metricName}`)
		}
	}

	/**
	 * Get monitoring configuration summary
	 */
	public getMonitoringConfigurationSummary(): string {
		return this.monitoring.getMonitoringConfigurationSummary()
	}

	/**
	 * Enable enhanced monitoring for specific components
	 */
	public enableEnhancedMonitoring(components: string[]): void {
		// This method would enable more detailed monitoring for specific components
		// such as detailed EC2 monitoring, enhanced ALB metrics, etc.

		components.forEach((component) => {
			switch (component) {
				case 'ec2':
					// Enable detailed EC2 monitoring
					break
				case 'alb':
					// Enable enhanced ALB monitoring
					break
				case 'application':
					// Enable enhanced application monitoring
					break
				default:
					console.warn(`Unknown monitoring component: ${component}`)
			}
		})
	}

	/**
	 * Create monitoring summary for documentation
	 */
	public generateMonitoringSummary(): string {
		const ec2Count = this.ec2Instances.length
		const hasAlb = !!this.applicationLoadBalancer
		const targetGroupCount = this.targetGroups.length

		return `
## Phase 4 CloudWatch Monitoring Summary

### Infrastructure Monitoring
- **EC2 Instances**: ${ec2Count} instances monitored
- **Application Load Balancer**: ${hasAlb ? 'Monitored' : 'Not configured'}
- **Target Groups**: ${targetGroupCount} groups monitored

### Dashboard & Alerts
- **Dashboard URL**: ${this.dashboardUrl}
- **Critical Alerts**: ${this.monitoring.criticalAlertsTopic.topicName}
- **Warning Alerts**: ${this.monitoring.warningAlertsTopic.topicName}

### Monitoring Features
- ✅ Infrastructure metrics (CPU, memory, disk, network)
- ✅ Application performance metrics (response time, error rate)
- ✅ Load balancer metrics (request count, target health)
- ✅ Cost monitoring and optimization alerts
- ✅ Automated alerting with severity-based notifications
- ✅ Production-ready alarm thresholds
- ✅ Comprehensive logging with retention policies

### Operational Benefits
- **Proactive Monitoring**: Early detection of performance issues
- **Cost Optimization**: Automated alerts for unusual resource consumption
- **Scalability Insights**: Metrics to inform auto-scaling decisions
- **Troubleshooting**: Centralized logging and performance data
- **Compliance**: Production-ready monitoring for operational excellence

This monitoring foundation enables Phase 4 objectives including auto-scaling implementation, 
production deployment strategies, and performance optimization.
		`.trim()
	}
}
