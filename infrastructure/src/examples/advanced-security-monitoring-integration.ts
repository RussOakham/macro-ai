import * as cdk from 'aws-cdk-lib'
import * as sns from 'aws-cdk-lib/aws-sns'
import { Construct } from 'constructs'

import { AdvancedSecurityMonitoringConstruct } from '../constructs/advanced-security-monitoring-construct'
import { MonitoringConstruct } from '../constructs/monitoring-construct'

/**
 * Example integration of Advanced Security Monitoring with existing infrastructure
 *
 * This example demonstrates how to integrate the Advanced Security Monitoring
 * construct with existing monitoring infrastructure and configure it for
 * different environments.
 */
export class AdvancedSecurityMonitoringIntegrationExample extends Construct {
	public readonly securityMonitoring: AdvancedSecurityMonitoringConstruct

	constructor(scope: Construct, id: string) {
		super(scope, id)

		// Create SNS topics for security notifications
		const criticalSecurityAlert = new sns.Topic(this, 'CriticalSecurityAlert', {
			topicName: 'macro-ai-production-critical-security-alert',
			displayName: 'Critical Security Alert',
		})

		const securityWarning = new sns.Topic(this, 'SecurityWarning', {
			topicName: 'macro-ai-production-security-warning',
			displayName: 'Security Warning',
		})

		const complianceViolation = new sns.Topic(this, 'ComplianceViolation', {
			topicName: 'macro-ai-production-compliance-violation',
			displayName: 'Compliance Violation',
		})

		const suspiciousActivity = new sns.Topic(this, 'SuspiciousActivity', {
			topicName: 'macro-ai-production-suspicious-activity',
			displayName: 'Suspicious Activity',
		})

		// Create Advanced Security Monitoring construct
		this.securityMonitoring = new AdvancedSecurityMonitoringConstruct(
			this,
			'AdvancedSecurityMonitoring',
			{
				environmentName: 'production',
				applicationName: 'macro-ai',
				securityConfig: {
					enableCloudTrail: true,
					cloudTrailRetentionDays: 90,
					enableVpcFlowLogs: true,
					enableGuardDutyIntegration: true,
					securityEventRetentionDays: 2555, // 7 years
					enableComplianceMonitoring: true,
				},
				securityNotificationTopics: {
					criticalSecurityAlert,
					securityWarning,
					complianceViolation,
					suspiciousActivity,
				},
				vpcId: 'vpc-12345678', // Replace with actual VPC ID
			},
		)

		// Add email subscriptions to SNS topics
		this.addEmailSubscriptions(criticalSecurityAlert, [
			'security-team@company.com',
			'devops-team@company.com',
		])

		this.addEmailSubscriptions(securityWarning, ['security-team@company.com'])

		this.addEmailSubscriptions(complianceViolation, [
			'compliance-team@company.com',
			'security-team@company.com',
		])

		this.addEmailSubscriptions(suspiciousActivity, [
			'security-team@company.com',
		])

		// Output important resources
		new cdk.CfnOutput(this, 'SecurityDashboardUrl', {
			value: `https://console.aws.amazon.com/cloudwatch/home?region=${cdk.Stack.of(this).region}#dashboards:name=${this.securityMonitoring.securityDashboard.dashboardName}`,
			description: 'URL to the Security Monitoring Dashboard',
		})

		new cdk.CfnOutput(this, 'SecurityEventTableName', {
			value: this.securityMonitoring.securityEventTable.tableName,
			description: 'DynamoDB table for security events',
		})

		new cdk.CfnOutput(this, 'SecurityLogGroupName', {
			value: this.securityMonitoring.securityLogGroup.logGroupName,
			description: 'CloudWatch log group for security events',
		})
	}

	/**
	 * Add email subscriptions to SNS topic
	 */
	private addEmailSubscriptions(topic: sns.Topic, emails: string[]): void {
		emails.forEach((email, index) => {
			new sns.Subscription(this, `${topic.node.id}EmailSubscription${index}`, {
				topic,
				protocol: sns.SubscriptionProtocol.EMAIL,
				endpoint: email,
			})
		})
	}
}

/**
 * Environment-specific security monitoring configurations
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class SecurityMonitoringConfigurations {
	/**
	 * Production environment configuration
	 */
	static production() {
		return {
			securityConfig: {
				enableCloudTrail: true,
				cloudTrailRetentionDays: 90,
				enableVpcFlowLogs: true,
				enableGuardDutyIntegration: true,
				securityEventRetentionDays: 2555, // 7 years for compliance
				enableComplianceMonitoring: true,
			},
			alertingThresholds: {
				criticalEvents: 1, // Immediate alert
				highSeverityEvents: 5, // Alert after 5 events in 15 minutes
				complianceViolations: 1, // Immediate alert
			},
		}
	}

	/**
	 * Staging environment configuration
	 */
	static staging() {
		return {
			securityConfig: {
				enableCloudTrail: true,
				cloudTrailRetentionDays: 30,
				enableVpcFlowLogs: true,
				enableGuardDutyIntegration: false, // Optional for staging
				securityEventRetentionDays: 365, // 1 year
				enableComplianceMonitoring: true,
			},
			alertingThresholds: {
				criticalEvents: 2, // Less sensitive
				highSeverityEvents: 10,
				complianceViolations: 3,
			},
		}
	}

	/**
	 * Development environment configuration
	 */
	static development() {
		return {
			securityConfig: {
				enableCloudTrail: false, // Optional for dev
				cloudTrailRetentionDays: 7,
				enableVpcFlowLogs: false, // Optional for dev
				enableGuardDutyIntegration: false,
				securityEventRetentionDays: 30, // 30 days
				enableComplianceMonitoring: false, // Optional for dev
			},
			alertingThresholds: {
				criticalEvents: 5, // Less sensitive
				highSeverityEvents: 20,
				complianceViolations: 10,
			},
		}
	}
}

/**
 * Security monitoring integration with existing monitoring construct
 */
export class SecurityMonitoringIntegration extends Construct {
	constructor(
		scope: Construct,
		id: string,
		props: {
			environmentName: string
			applicationName: string
			existingMonitoring: MonitoringConstruct
			vpcId?: string
		},
	) {
		super(scope, id)

		// Get environment-specific configuration
		const config = this.getEnvironmentConfig(props.environmentName)

		// Create security monitoring
		const securityMonitoring = new AdvancedSecurityMonitoringConstruct(
			this,
			'SecurityMonitoring',
			{
				environmentName: props.environmentName,
				applicationName: props.applicationName,
				securityConfig: config.securityConfig,
				vpcId: props.vpcId,
			},
		)

		// Integrate with existing monitoring
		this.integrateWithExistingMonitoring(
			securityMonitoring,
			props.existingMonitoring,
		)

		// Add security-specific alarms to existing monitoring
		this.addSecurityAlarmsToMonitoring()
	}

	private getEnvironmentConfig(environmentName: string) {
		switch (environmentName) {
			case 'production':
				return SecurityMonitoringConfigurations.production()
			case 'staging':
				return SecurityMonitoringConfigurations.staging()
			case 'development':
				return SecurityMonitoringConfigurations.development()
			default:
				return SecurityMonitoringConfigurations.development()
		}
	}

	private integrateWithExistingMonitoring(
		securityMonitoring: AdvancedSecurityMonitoringConstruct,
		existingMonitoring: MonitoringConstruct,
	): void {
		// Add security dashboard widgets to existing dashboard
		existingMonitoring.dashboard.addWidgets(
			// Security overview widget
			new cdk.aws_cloudwatch.SingleValueWidget({
				title: 'Security Events (24h)',
				metrics: [
					new cdk.aws_cloudwatch.Metric({
						namespace: 'MacroAI/Security',
						metricName: 'SecurityEvent',
						statistic: 'Sum',
						period: cdk.Duration.hours(24),
					}),
				],
				width: 6,
				height: 6,
			}),
		)
	}

	private addSecurityAlarmsToMonitoring(): void {
		// Security alarms are already created in the security monitoring construct
		// This method could be used to add additional integrations if needed
		// Parameters removed as they were unused
	}
}

/**
 * Complete security monitoring stack example
 */
export class SecurityMonitoringStack extends cdk.Stack {
	public readonly securityIntegration: AdvancedSecurityMonitoringIntegrationExample

	constructor(scope: Construct, id: string, props?: cdk.StackProps) {
		super(scope, id, props)

		// Create the security monitoring integration
		const securityIntegration =
			new AdvancedSecurityMonitoringIntegrationExample(
				this,
				'SecurityMonitoringIntegration',
			)

		// Store reference for potential future use
		this.securityIntegration = securityIntegration

		// Add stack-level tags
		cdk.Tags.of(this).add('Component', 'SecurityMonitoring')
		cdk.Tags.of(this).add('Environment', 'production')
		cdk.Tags.of(this).add('Application', 'macro-ai')
	}
}
