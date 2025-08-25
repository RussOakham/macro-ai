import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'

import { MonitoringConstruct } from './monitoring-construct.js'

export interface MonitoringIntegrationProps {
	/**
	 * Environment name for resource naming and tagging
	 */
	readonly environmentName: string

	/**
	 * Application name for resource naming
	 */
	readonly applicationName?: string

	/**
	 * Enable cost monitoring alerts
	 * @default true
	 */
	readonly enableCostMonitoring?: boolean

	/**
	 * Email addresses for critical alerts
	 */
	readonly criticalAlertEmails?: string[]

	/**
	 * Email addresses for warning alerts
	 */
	readonly warningAlertEmails?: string[]
}

/**
 * Monitoring Integration Construct
 *
 * Provides monitoring and observability integration for the Macro AI infrastructure.
 * This construct combines monitoring, logging, and alerting capabilities.
 */
export class MonitoringIntegration extends Construct {
	public readonly monitoring: MonitoringConstruct

	constructor(scope: Construct, id: string, props: MonitoringIntegrationProps) {
		super(scope, id)

		const {
			environmentName,
			applicationName = 'macro-ai',
			enableCostMonitoring = true,
			criticalAlertEmails,
			warningAlertEmails,
		} = props

		// Create monitoring construct
		this.monitoring = new MonitoringConstruct(this, 'Monitoring', {
			environmentName,
			applicationName,
			enableCostMonitoring,
			criticalAlertEmails,
			warningAlertEmails,
		})

		// Create comprehensive outputs
		this.createOutputs()
	}

	/**
	 * Create CloudFormation outputs for monitoring resources
	 */
	private createOutputs(): void {
		new cdk.CfnOutput(this, 'MonitoringDashboardUrl', {
			value: `https://console.aws.amazon.com/cloudwatch/home?region=${cdk.Stack.of(this).region}#dashboards:name=${this.monitoring.dashboard.dashboardName}`,
			description: 'URL to the monitoring dashboard',
			exportName: `MacroAI-${this.monitoring.dashboard.dashboardName}-MonitoringDashboardUrl`,
		})

		new cdk.CfnOutput(this, 'MonitoringLogGroupName', {
			value:
				this.monitoring.logGroups[0]?.logGroupName ??
				'No log groups configured',
			description: 'CloudWatch log group name for monitoring',
			exportName: `MacroAI-${this.monitoring.dashboard.dashboardName}-MonitoringLogGroupName`,
		})

		new cdk.CfnOutput(this, 'CriticalAlertsTopicArn', {
			value: this.monitoring.criticalAlertsTopic.topicArn,
			description: 'SNS topic ARN for critical alerts',
			exportName: `MacroAI-${this.monitoring.dashboard.dashboardName}-CriticalAlertsTopicArn`,
		})

		new cdk.CfnOutput(this, 'WarningAlertsTopicArn', {
			value: this.monitoring.warningAlertsTopic.topicArn,
			description: 'SNS topic ARN for warning alerts',
			exportName: `MacroAI-${this.monitoring.dashboard.dashboardName}-WarningAlertsTopicArn`,
		})
	}

	/**
	 * Get monitoring summary for documentation
	 */
	public getMonitoringSummary(): string {
		return `
Macro AI Monitoring Infrastructure Summary:

Dashboard: ${this.monitoring.dashboard.dashboardName}
Log Groups: ${this.monitoring.logGroups.length.toString()}
Critical Alerts: ${this.monitoring.criticalAlertsTopic.topicName}
Warning Alerts: ${this.monitoring.warningAlertsTopic.topicName}

Features Enabled:
- Dashboard: Yes
- Alarms: Yes
- Log Aggregation: Yes
- Cost Monitoring: Yes
		`.trim()
	}
}
