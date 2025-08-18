import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { Construct } from 'constructs'

import { AlbConstruct } from '../src/constructs/alb-construct.ts'
import { AutoScalingConstruct } from '../src/constructs/auto-scaling-construct.ts'
import { Ec2Construct } from '../src/constructs/ec2-construct.ts'
import { MonitoringIntegration } from '../src/constructs/monitoring-integration.ts'
import { VpcConstruct } from '../src/constructs/vpc-construct.ts'

/**
 * Example stack demonstrating Phase 4 Auto Scaling Groups with Dynamic Scaling Policies
 *
 * This example shows how to:
 * 1. Create EC2 infrastructure with launch templates
 * 2. Implement Auto Scaling Groups with dynamic scaling policies
 * 3. Integrate comprehensive monitoring with auto-scaling metrics
 * 4. Configure environment-specific scaling thresholds
 * 5. Set up automated alerting for scaling events
 */
export class AutoScalingIntegrationExampleStack extends cdk.Stack {
	public readonly autoScaling: AutoScalingConstruct
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

		// Create EC2 infrastructure with launch template
		const ec2Construct = new Ec2Construct(this, 'Ec2', {
			vpc: vpcConstruct.vpc,
			securityGroup: ec2SecurityGroup,
			environmentName,
			instanceType: this.getInstanceTypeForEnvironment(environmentName),
			parameterStorePrefix: `/macro-ai/${environmentName}`,
			enableDetailedMonitoring: environmentName === 'production',
			// Auto scaling configuration
			autoScaling: {
				minCapacity: this.getMinCapacityForEnvironment(environmentName),
				maxCapacity: this.getMaxCapacityForEnvironment(environmentName),
				desiredCapacity: this.getDesiredCapacityForEnvironment(environmentName),
				targetCpuUtilization: this.getCpuTargetForEnvironment(environmentName),
				targetRequestCountPerInstance:
					this.getRequestCountTargetForEnvironment(environmentName),
			},
		})

		// Create ALB infrastructure
		const albConstruct = new AlbConstruct(this, 'Alb', {
			vpc: vpcConstruct.vpc,
			environmentName,
			applicationName,
			certificateArn: this.getSSLCertificateArn(environmentName),
			enableAccessLogs: environmentName === 'production',
		})

		// Create Auto Scaling Group with dynamic scaling policies
		this.autoScaling = new AutoScalingConstruct(this, 'AutoScaling', {
			vpc: vpcConstruct.vpc,
			launchTemplate: ec2Construct.launchTemplate,
			environmentName,
			applicationName,
			targetGroups: albConstruct.targetGroups,
			autoScaling: {
				minCapacity: this.getMinCapacityForEnvironment(environmentName),
				maxCapacity: this.getMaxCapacityForEnvironment(environmentName),
				desiredCapacity: this.getDesiredCapacityForEnvironment(environmentName),
				targetCpuUtilization: this.getCpuTargetForEnvironment(environmentName),
				targetMemoryUtilization:
					this.getMemoryTargetForEnvironment(environmentName),
				targetRequestCountPerInstance:
					this.getRequestCountTargetForEnvironment(environmentName),
				scaleOutCooldown:
					this.getScaleOutCooldownForEnvironment(environmentName),
				scaleInCooldown: this.getScaleInCooldownForEnvironment(environmentName),
			},
			enableDetailedMonitoring: environmentName === 'production',
			customMetricNamespace: `${applicationName}/API`,
			healthCheckGracePeriod:
				this.getHealthCheckGracePeriodForEnvironment(environmentName),
		})

		// Create comprehensive monitoring integration with auto-scaling
		this.monitoring = new MonitoringIntegration(this, 'Monitoring', {
			environmentName,
			applicationName,
			ec2Construct,
			albConstruct,
			autoScalingConstruct: this.autoScaling,
			criticalAlertEmails: this.getCriticalAlertEmails(environmentName),
			warningAlertEmails: this.getWarningAlertEmails(environmentName),
			enableCostMonitoring: true,
			prNumber,
			customMetricNamespace: `${applicationName}/API`,
		})

		this.dashboardUrl = this.monitoring.dashboardUrl

		// Create outputs for operational use
		new cdk.CfnOutput(this, 'AutoScalingGroupName', {
			value: this.autoScaling.autoScalingGroup.autoScalingGroupName,
			description: 'Auto Scaling Group name for operational procedures',
			exportName: `${applicationName}-${environmentName}-asg-name`,
		})

		new cdk.CfnOutput(this, 'AutoScalingConfigurationSummary', {
			value: this.autoScaling.getAutoScalingConfigurationSummary(),
			description: 'Auto Scaling configuration summary',
		})

		new cdk.CfnOutput(this, 'MonitoringDashboardUrl', {
			value: this.dashboardUrl,
			description: 'CloudWatch Dashboard URL with auto-scaling metrics',
		})

		// Environment-specific configurations
		this.configureEnvironmentSpecificScaling(environmentName)

		// Add stack-level tags
		cdk.Tags.of(this).add('Environment', environmentName)
		cdk.Tags.of(this).add('Application', applicationName)
		cdk.Tags.of(this).add('Phase', 'Phase4-AutoScaling')
		cdk.Tags.of(this).add('AutoScalingEnabled', 'true')

		if (prNumber) {
			cdk.Tags.of(this).add('PRNumber', prNumber.toString())
		}
	}

	/**
	 * Get instance type based on environment
	 */
	private getInstanceTypeForEnvironment(
		environmentName: string,
	): ec2.InstanceType {
		switch (environmentName) {
			case 'production':
				return ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL)
			case 'staging':
				return ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO)
			default:
				return ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.NANO)
		}
	}

	/**
	 * Get minimum capacity based on environment
	 */
	private getMinCapacityForEnvironment(environmentName: string): number {
		switch (environmentName) {
			case 'production':
				return 2 // Always maintain 2 instances for high availability
			case 'staging':
				return 1
			default:
				return 1 // Development/PR environments
		}
	}

	/**
	 * Get maximum capacity based on environment
	 */
	private getMaxCapacityForEnvironment(environmentName: string): number {
		switch (environmentName) {
			case 'production':
				return 10 // Allow scaling up to 10 instances
			case 'staging':
				return 5
			default:
				return 3 // Limit development/PR environments
		}
	}

	/**
	 * Get desired capacity based on environment
	 */
	private getDesiredCapacityForEnvironment(environmentName: string): number {
		switch (environmentName) {
			case 'production':
				return 3 // Start with 3 instances
			case 'staging':
				return 2
			default:
				return 1 // Start with 1 instance for development
		}
	}

	/**
	 * Get CPU target for scaling based on environment
	 */
	private getCpuTargetForEnvironment(environmentName: string): number {
		switch (environmentName) {
			case 'production':
				return 60 // Conservative target for production
			case 'staging':
				return 70
			default:
				return 75 // More lenient for development
		}
	}

	/**
	 * Get memory target for scaling based on environment
	 */
	private getMemoryTargetForEnvironment(environmentName: string): number {
		switch (environmentName) {
			case 'production':
				return 70 // Conservative target for production
			case 'staging':
				return 75
			default:
				return 80 // More lenient for development
		}
	}

	/**
	 * Get request count target per instance based on environment
	 */
	private getRequestCountTargetForEnvironment(environmentName: string): number {
		switch (environmentName) {
			case 'production':
				return 100 // 100 requests per instance per minute
			case 'staging':
				return 150
			default:
				return 200 // Higher threshold for development
		}
	}

	/**
	 * Get scale out cooldown based on environment
	 */
	private getScaleOutCooldownForEnvironment(
		environmentName: string,
	): cdk.Duration {
		switch (environmentName) {
			case 'production':
				return cdk.Duration.minutes(3) // Conservative for production
			case 'staging':
				return cdk.Duration.minutes(2)
			default:
				return cdk.Duration.minutes(1) // Faster for development
		}
	}

	/**
	 * Get scale in cooldown based on environment
	 */
	private getScaleInCooldownForEnvironment(
		environmentName: string,
	): cdk.Duration {
		switch (environmentName) {
			case 'production':
				return cdk.Duration.minutes(10) // Very conservative for production
			case 'staging':
				return cdk.Duration.minutes(5)
			default:
				return cdk.Duration.minutes(3) // Faster for development
		}
	}

	/**
	 * Get health check grace period based on environment
	 */
	private getHealthCheckGracePeriodForEnvironment(
		environmentName: string,
	): cdk.Duration {
		switch (environmentName) {
			case 'production':
				return cdk.Duration.minutes(5) // More time for production instances
			case 'staging':
				return cdk.Duration.minutes(3)
			default:
				return cdk.Duration.minutes(2) // Faster for development
		}
	}

	/**
	 * Get SSL certificate ARN based on environment
	 */
	private getSSLCertificateArn(environmentName: string): string | undefined {
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
		const primaryEmail = this.node.tryGetContext('primaryAlertEmail')
		if (primaryEmail) {
			emails.push(primaryEmail)
		}

		switch (environmentName) {
			case 'production': {
				const prodEmails = this.node.tryGetContext('productionAlertEmails')
				if (prodEmails) {
					emails.push(...prodEmails)
				}
				break
			}
			case 'staging': {
				const stagingEmails = this.node.tryGetContext('stagingAlertEmails')
				if (stagingEmails) {
					emails.push(...stagingEmails)
				}
				break
			}
		}

		return emails
	}

	/**
	 * Get warning alert email addresses based on environment
	 */
	private getWarningAlertEmails(environmentName: string): string[] {
		const criticalEmails = this.getCriticalAlertEmails(environmentName)
		const warningEmails = [...criticalEmails]

		const additionalWarningEmails =
			this.node.tryGetContext('warningAlertEmails')
		if (additionalWarningEmails) {
			warningEmails.push(...additionalWarningEmails)
		}

		return warningEmails
	}

	/**
	 * Configure environment-specific scaling settings
	 */
	private configureEnvironmentSpecificScaling(environmentName: string): void {
		switch (environmentName) {
			case 'production':
				// Production-specific auto-scaling configuration
				this.monitoring.enableEnhancedMonitoring(['ec2', 'alb', 'application'])
				break
			case 'staging':
				// Staging-specific auto-scaling configuration
				this.monitoring.enableEnhancedMonitoring(['ec2', 'alb'])
				break
			default:
				// Development/PR-specific auto-scaling configuration
				// Basic monitoring is sufficient for development environments
				break
		}
	}

	/**
	 * Get auto-scaling summary for documentation
	 */
	public getAutoScalingSummary(): string {
		const environmentName =
			this.node.tryGetContext('environment') || 'development'

		return `
## Phase 4 Auto Scaling Implementation Summary

### Auto Scaling Configuration
${this.autoScaling.getAutoScalingConfigurationSummary()}

### Monitoring Integration
${this.monitoring.getMonitoringConfigurationSummary()}

### Environment-Specific Settings
- **Environment**: ${environmentName}
- **Instance Type**: ${this.getInstanceTypeForEnvironment(environmentName)}
- **Capacity Range**: ${this.getMinCapacityForEnvironment(environmentName)} - ${this.getMaxCapacityForEnvironment(environmentName)} instances
- **CPU Target**: ${this.getCpuTargetForEnvironment(environmentName)}%
- **Memory Target**: ${this.getMemoryTargetForEnvironment(environmentName)}%

### Operational Benefits
- **Dynamic Scaling**: Automatic response to traffic variations
- **Cost Optimization**: Scale down during low traffic periods
- **High Availability**: Maintain minimum capacity for reliability
- **Performance Optimization**: Scale up to maintain response times
- **Comprehensive Monitoring**: Real-time visibility into scaling activities

### Dashboard Access
- **Monitoring Dashboard**: ${this.dashboardUrl}
- **Auto Scaling Group**: ${this.autoScaling.autoScalingGroup.autoScalingGroupName}

This auto-scaling implementation provides production-ready dynamic scaling
with comprehensive monitoring and cost-optimized policies.
		`.trim()
	}
}

/**
 * Example CDK app demonstrating auto-scaling integration
 */
export class AutoScalingIntegrationExampleApp extends cdk.App {
	constructor() {
		super()

		// Create stack with auto-scaling integration
		const stack = new AutoScalingIntegrationExampleStack(
			this,
			'MacroAiAutoScalingExample',
			{
				env: {
					account: process.env.CDK_DEFAULT_ACCOUNT,
					region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
				},
				description:
					'Phase 4 Auto Scaling Groups with Dynamic Scaling Policies for Macro AI',
			},
		)

		// Output auto-scaling summary
		console.log('\n' + '='.repeat(80))
		console.log('PHASE 4 AUTO SCALING IMPLEMENTATION EXAMPLE')
		console.log('='.repeat(80))
		console.log(stack.getAutoScalingSummary())
		console.log('='.repeat(80) + '\n')
	}
}

// Example usage:
// const app = new AutoScalingIntegrationExampleApp()
// app.synth()
