import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { Construct } from 'constructs'

import { AlbConstruct } from '../src/constructs/alb-construct.ts'
import { Ec2Construct } from '../src/constructs/ec2-construct.ts'
import { MonitoringIntegration } from '../src/constructs/monitoring-integration.ts'
import { VpcConstruct } from '../src/constructs/vpc-construct.ts'

/**
 * Example stack demonstrating Phase 4 CloudWatch monitoring integration
 *
 * This example shows how to:
 * 1. Create EC2 and ALB infrastructure
 * 2. Integrate comprehensive CloudWatch monitoring
 * 3. Configure environment-specific alerting
 * 4. Enable cost monitoring and optimization
 */
export class MonitoringIntegrationExampleStack extends cdk.Stack {
	public readonly monitoring: MonitoringIntegration
	public readonly dashboardUrl: string

	constructor(scope: Construct, id: string, props?: cdk.StackProps) {
		super(scope, id, props)

		// Environment configuration
		const environmentName =
			this.node.tryGetContext('environment') || 'development'
		const applicationName = 'macro-ai'
		const prNumber = this.node.tryGetContext('prNumber')

		// Create VPC infrastructure
		const vpcConstruct = new VpcConstruct(this, 'Vpc', {
			environmentName,
			enableFlowLogs: environmentName === 'production',
			maxAzs: environmentName === 'production' ? 3 : 2,
		})

		// Create security group for EC2 instances
		const ec2SecurityGroup = new ec2.SecurityGroup(this, 'Ec2SecurityGroup', {
			vpc: vpcConstruct.vpc,
			description: `Security group for ${applicationName} EC2 instances`,
			allowAllOutbound: true,
		})

		// Allow HTTP traffic from ALB
		ec2SecurityGroup.addIngressRule(
			ec2.Peer.anyIpv4(),
			ec2.Port.tcp(3030),
			'Allow HTTP traffic from ALB',
		)

		// Create EC2 infrastructure
		const ec2Construct = new Ec2Construct(this, 'Ec2', {
			vpc: vpcConstruct.vpc,
			securityGroup: ec2SecurityGroup,
			environmentName,
			instanceType:
				environmentName === 'production'
					? ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL)
					: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
			parameterStorePrefix: `/macro-ai/${environmentName}`,
			enableDetailedMonitoring: environmentName === 'production',
		})

		// Create ALB infrastructure
		const albConstruct = new AlbConstruct(this, 'Alb', {
			vpc: vpcConstruct.vpc,
			environmentName,
			applicationName,
			certificateArn: this.getSSLCertificateArn(environmentName),
			enableAccessLogs: environmentName === 'production',
		})

		// Enable monitoring integration on constructs
		ec2Construct.enableComprehensiveMonitoring({
			enableCostMonitoring: true,
			customMetricNamespace: `${applicationName}/API`,
		})

		// Create comprehensive monitoring integration
		this.monitoring = new MonitoringIntegration(this, 'Monitoring', {
			environmentName,
			applicationName,
			ec2Construct,
			albConstruct,
			criticalAlertEmails: this.getCriticalAlertEmails(environmentName),
			warningAlertEmails: this.getWarningAlertEmails(environmentName),
			enableCostMonitoring: true,
			prNumber,
			customMetricNamespace: `${applicationName}/API`,
		})

		this.dashboardUrl = this.monitoring.dashboardUrl

		// Create additional outputs for operational use
		new cdk.CfnOutput(this, 'MonitoringConfigurationSummary', {
			value: this.monitoring.getMonitoringConfigurationSummary(),
			description: 'Comprehensive monitoring configuration summary',
		})

		// Environment-specific configurations
		this.configureEnvironmentSpecificMonitoring(environmentName)

		// Add stack-level tags for cost tracking
		cdk.Tags.of(this).add('Environment', environmentName)
		cdk.Tags.of(this).add('Application', applicationName)
		cdk.Tags.of(this).add('Phase', 'Phase4-Monitoring')
		cdk.Tags.of(this).add('MonitoringEnabled', 'true')

		if (prNumber) {
			cdk.Tags.of(this).add('PRNumber', prNumber.toString())
		}
	}

	/**
	 * Get SSL certificate ARN based on environment
	 */
	private getSSLCertificateArn(environmentName: string): string | undefined {
		// In a real implementation, this would return the appropriate certificate ARN
		// based on the environment (e.g., from Parameter Store or context)
		switch (environmentName) {
			case 'production':
				return this.node.tryGetContext('productionCertificateArn')
			case 'staging':
				return this.node.tryGetContext('stagingCertificateArn')
			default:
				return undefined // Development environments might not need SSL
		}
	}

	/**
	 * Get critical alert email addresses based on environment
	 */
	private getCriticalAlertEmails(environmentName: string): string[] {
		const emails: string[] = []

		// Always include the primary alert email
		const primaryEmail = this.node.tryGetContext('primaryAlertEmail')
		if (primaryEmail) {
			emails.push(primaryEmail)
		}

		// Add environment-specific emails
		switch (environmentName) {
			case 'production':
				const prodEmails = this.node.tryGetContext('productionAlertEmails')
				if (prodEmails) {
					emails.push(...prodEmails)
				}
				break
			case 'staging':
				const stagingEmails = this.node.tryGetContext('stagingAlertEmails')
				if (stagingEmails) {
					emails.push(...stagingEmails)
				}
				break
		}

		return emails
	}

	/**
	 * Get warning alert email addresses based on environment
	 */
	private getWarningAlertEmails(environmentName: string): string[] {
		// Warning emails might be a subset of critical emails
		// or include additional team members for non-critical issues
		const criticalEmails = this.getCriticalAlertEmails(environmentName)
		const warningEmails = [...criticalEmails]

		// Add additional warning-only emails
		const additionalWarningEmails =
			this.node.tryGetContext('warningAlertEmails')
		if (additionalWarningEmails) {
			warningEmails.push(...additionalWarningEmails)
		}

		return warningEmails
	}

	/**
	 * Configure environment-specific monitoring settings
	 */
	private configureEnvironmentSpecificMonitoring(
		environmentName: string,
	): void {
		switch (environmentName) {
			case 'production':
				// Production-specific monitoring configuration
				this.monitoring.enableEnhancedMonitoring(['ec2', 'alb', 'application'])
				break
			case 'staging':
				// Staging-specific monitoring configuration
				this.monitoring.enableEnhancedMonitoring(['ec2', 'alb'])
				break
			default:
				// Development/PR-specific monitoring configuration
				// Basic monitoring is sufficient for development environments
				break
		}
	}

	/**
	 * Get monitoring summary for documentation
	 */
	public getMonitoringSummary(): string {
		return this.monitoring.generateMonitoringSummary()
	}
}

/**
 * Example CDK app demonstrating monitoring integration
 */
export class MonitoringIntegrationExampleApp extends cdk.App {
	constructor() {
		super()

		// Create stack with monitoring integration
		const stack = new MonitoringIntegrationExampleStack(
			this,
			'MacroAiMonitoringExample',
			{
				env: {
					account: process.env.CDK_DEFAULT_ACCOUNT,
					region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
				},
				description:
					'Phase 4 CloudWatch monitoring integration example for Macro AI',
			},
		)

		// Output monitoring summary
		console.log('\n' + '='.repeat(80))
		console.log('PHASE 4 MONITORING INTEGRATION EXAMPLE')
		console.log('='.repeat(80))
		console.log(stack.getMonitoringSummary())
		console.log('='.repeat(80) + '\n')
	}
}

// Example usage:
// const app = new MonitoringIntegrationExampleApp()
// app.synth()
