import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as elbv2targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets'
import { Construct } from 'constructs'

import { AlbConstruct } from './alb-construct.js'
import { Ec2Construct } from './ec2-construct.js'
import { SecurityGroupsConstruct } from './security-groups-construct.js'
import { VpcConstruct } from './vpc-construct.js'

export interface NetworkingConstructProps {
	/**
	 * Environment name for resource naming and tagging
	 * @default 'development'
	 */
	readonly environmentName?: string

	/**
	 * Enable VPC Flow Logs for network monitoring
	 * @default false (cost optimization for development)
	 */
	readonly enableFlowLogs?: boolean

	/**
	 * Number of Availability Zones to use
	 * @default 2 (minimum for ALB, cost-optimized)
	 */
	readonly maxAzs?: number

	/**
	 * Enable detailed monitoring and logging
	 * @default false (cost optimization)
	 */
	readonly enableDetailedMonitoring?: boolean

	/**
	 * Parameter Store prefix for EC2 configuration
	 * Required for EC2 construct integration
	 */
	readonly parameterStorePrefix?: string

	/**
	 * Enable NAT Gateway for private subnet internet access
	 * @default true - set to false for preview environments to eliminate NAT Gateway costs (~$2.76/month)
	 */
	readonly enableNatGateway?: boolean

	/**
	 * Enable VPC endpoints for AWS services
	 * @default true - set to false for preview environments to reduce costs and complexity
	 */
	readonly enableVpcEndpoints?: boolean

	/**
	 * Enable ALB (Application Load Balancer) integration
	 * @default true (required for EC2-based preview environments)
	 */
	readonly enableAlb?: boolean

	/**
	 * Custom domain configuration for ALB
	 */
	readonly customDomain?: {
		readonly domainName: string
		readonly hostedZoneId: string
		readonly certificateArn?: string
	}

	/**
	 * Deployment ID to force instance replacement on every deployment
	 * This ensures fresh instances with latest application code
	 * @default current timestamp
	 */
	readonly deploymentId?: string
}

/**
 * Comprehensive Networking Construct for Macro AI EC2-based preview environments
 *
 * This construct combines VPC and Security Groups to provide a complete
 * networking foundation for PR preview environments. It implements the
 * cost-optimized shared infrastructure pattern with network-level isolation.
 *
 * Key Features:
 * - Shared VPC across all PR environments (cost optimization)
 * - Network-level isolation via security groups
 * - Public subnets for EC2 instances (avoids NAT Gateway costs)
 * - Private subnets for future database resources
 * - VPC endpoints for AWS services (reduces NAT Gateway usage)
 * - Comprehensive tagging for cost tracking and cleanup
 */
export class NetworkingConstruct extends Construct {
	public readonly vpc: ec2.Vpc
	public readonly securityGroups: SecurityGroupsConstruct
	public readonly ec2Construct?: Ec2Construct
	public readonly albConstruct?: AlbConstruct
	public readonly publicSubnets: ec2.ISubnet[]
	public readonly privateSubnets: ec2.ISubnet[]
	public readonly databaseSubnets: ec2.ISubnet[]

	// Convenience properties for common access patterns
	public readonly albSecurityGroup: ec2.ISecurityGroup
	public readonly vpcId: string
	public readonly vpcCidrBlock: string

	constructor(
		scope: Construct,
		id: string,
		props: NetworkingConstructProps = {},
	) {
		super(scope, id)

		const {
			environmentName = 'development',
			enableFlowLogs = false,
			maxAzs = 2,
			enableDetailedMonitoring = false,
			parameterStorePrefix,
			enableAlb = true,
			customDomain,
			deploymentId = new Date().toISOString(),
			enableNatGateway = true,
			enableVpcEndpoints = true,
		} = props

		// Create VPC infrastructure
		const vpcConstruct = new VpcConstruct(this, 'Vpc', {
			environmentName,
			enableFlowLogs,
			maxAzs,
			enableNatGateway,
			enableVpcEndpoints,
		})

		this.vpc = vpcConstruct.vpc
		this.publicSubnets = vpcConstruct.publicSubnets
		this.privateSubnets = vpcConstruct.privateSubnets
		this.databaseSubnets = vpcConstruct.databaseSubnets

		// Create security groups
		this.securityGroups = new SecurityGroupsConstruct(this, 'SecurityGroups', {
			vpc: this.vpc,
			environmentName,
		})

		// Create EC2 construct if parameter store prefix is provided
		if (parameterStorePrefix) {
			this.ec2Construct = new Ec2Construct(this, 'Ec2', {
				vpc: this.vpc,
				securityGroup: this.securityGroups.albSecurityGroup, // Default to ALB security group
				environmentName,
				parameterStorePrefix,
				enableDetailedMonitoring,
				deploymentId,
			})
		}

		// Create ALB construct if enabled
		if (enableAlb) {
			this.albConstruct = new AlbConstruct(this, 'Alb', {
				vpc: this.vpc,
				securityGroup: this.securityGroups.albSecurityGroup,
				environmentName,
				enableDetailedMonitoring,
				customDomain,
			})
		}

		// Convenience properties
		this.albSecurityGroup = this.securityGroups.albSecurityGroup
		this.vpcId = this.vpc.vpcId
		this.vpcCidrBlock = this.vpc.vpcCidrBlock

		// Create additional monitoring if enabled
		if (enableDetailedMonitoring) {
			this.enableDetailedMonitoring()
		}

		// Create comprehensive outputs
		this.createOutputs()

		// Apply networking-level tags
		this.applyTags()
	}

	/**
	 * Factory method to create PR-specific security group
	 * Delegates to the SecurityGroupsConstruct for consistency
	 */
	public createPrSecurityGroup(prNumber: number): ec2.SecurityGroup {
		return this.securityGroups.createPrSecurityGroup({
			prNumber,
			vpc: this.vpc,
			albSecurityGroup: this.albSecurityGroup,
			environmentName: this.getEnvironmentName(),
		})
	}

	/**
	 * Factory method to create PR-specific EC2 instance
	 * Creates both security group and EC2 instance for the PR
	 */
	public createPrInstance(
		prNumber: number,
		parameterStorePrefix: string,
	): ec2.Instance | undefined {
		if (!this.ec2Construct) {
			throw new Error(
				'EC2 construct not initialized. Provide parameterStorePrefix in NetworkingConstructProps.',
			)
		}

		// Create PR-specific security group
		const prSecurityGroup = this.createPrSecurityGroup(prNumber)

		// Create PR-specific EC2 instance
		return this.ec2Construct.createPrInstance({
			prNumber,
			vpc: this.vpc,
			securityGroup: prSecurityGroup,
			parameterStorePrefix,
			environmentName: this.getEnvironmentName(),
		})
	}

	/**
	 * Factory method to create complete PR environment
	 * Creates EC2 instance, target group, and ALB listener rule
	 */
	public createPrEnvironment(
		prNumber: number,
		parameterStorePrefix: string,
		hostHeader?: string,
		pathPrefix?: string,
	):
		| {
				instance: ec2.Instance
				targetGroup: elbv2.ApplicationTargetGroup
				listenerRule: elbv2.ApplicationListenerRule
		  }
		| undefined {
		if (!this.ec2Construct || !this.albConstruct) {
			throw new Error(
				'Both EC2 and ALB constructs must be initialized. ' +
					'Provide parameterStorePrefix and ensure enableAlb is true.',
			)
		}

		// Create PR-specific EC2 instance
		const instance = this.createPrInstance(prNumber, parameterStorePrefix)
		if (!instance) {
			throw new Error('Failed to create PR instance')
		}

		// Create PR-specific target group
		const targetGroup = this.albConstruct.createPrTargetGroup({
			prNumber,
			vpc: this.vpc,
			environmentName: this.getEnvironmentName(),
		})

		// Register EC2 instance with target group
		targetGroup.addTarget(new elbv2targets.InstanceTarget(instance))

		// Create listener rule for routing
		const listenerRule = this.albConstruct.addPrListenerRule(
			prNumber,
			targetGroup,
			hostHeader,
			pathPrefix,
		)

		return {
			instance,
			targetGroup,
			listenerRule,
		}
	}

	/**
	 * Get subnet configuration for ALB deployment
	 * ALB requires subnets in at least 2 AZs
	 */
	public getAlbSubnetSelection(): ec2.SubnetSelection {
		return {
			subnets: this.publicSubnets,
		}
	}

	/**
	 * Get subnet configuration for EC2 instances
	 * EC2 instances are placed in public subnets for cost optimization
	 */
	public getEc2SubnetSelection(): ec2.SubnetSelection {
		return {
			subnets: this.publicSubnets,
		}
	}

	/**
	 * Get subnet configuration for database resources (future use)
	 */
	public getDatabaseSubnetSelection(): ec2.SubnetSelection {
		return {
			subnets: this.databaseSubnets,
		}
	}

	/**
	 * Get availability zones used by this VPC
	 */
	public getAvailabilityZones(): string[] {
		return this.vpc.availabilityZones
	}

	/**
	 * Check if the VPC has sufficient subnets for ALB deployment
	 */
	public validateAlbRequirements(): boolean {
		const hasMultipleAzs = this.vpc.availabilityZones.length >= 2
		const hasPublicSubnets = this.publicSubnets.length >= 2

		if (!hasMultipleAzs || !hasPublicSubnets) {
			throw new Error(
				`ALB requires subnets in at least 2 AZs. Current: ${this.vpc.availabilityZones.length.toString()} AZs, ${this.publicSubnets.length.toString()} public subnets`,
			)
		}

		return true
	}

	/**
	 * Enable detailed monitoring for networking components
	 */
	private enableDetailedMonitoring(): void {
		// Create CloudWatch dashboard for networking metrics
		const dashboard = new cdk.aws_cloudwatch.Dashboard(
			this,
			'NetworkingDashboard',
			{
				dashboardName: `MacroAI-${this.getEnvironmentName()}-Networking`,
				defaultInterval: cdk.Duration.hours(1),
			},
		)

		// Add VPC metrics widget
		dashboard.addWidgets(
			new cdk.aws_cloudwatch.GraphWidget({
				title: 'VPC Network Traffic',
				left: [
					new cdk.aws_cloudwatch.Metric({
						namespace: 'AWS/VPC',
						metricName: 'PacketsDropped',
						dimensionsMap: {
							VpcId: this.vpcId,
						},
						statistic: 'Sum',
					}),
				],
				width: 12,
				height: 6,
			}),
		)

		// Create CloudWatch alarms for network issues
		new cdk.aws_cloudwatch.Alarm(this, 'HighPacketDropRate', {
			metric: new cdk.aws_cloudwatch.Metric({
				namespace: 'AWS/VPC',
				metricName: 'PacketsDropped',
				dimensionsMap: {
					VpcId: this.vpcId,
				},
				statistic: 'Sum',
			}),
			threshold: 100,
			evaluationPeriods: 2,
			alarmDescription: 'High packet drop rate detected in VPC',
		})
	}

	/**
	 * Apply comprehensive tagging for cost tracking and resource management
	 * Note: Avoid duplicate tag keys that might conflict with stack-level tags
	 */
	private applyTags(): void {
		const tags = {
			SubComponent: 'Networking',
			SubPurpose: 'SharedInfrastructure',
			ConstructManagedBy: 'NetworkingConstruct',
			NetworkType: 'VPC-Infrastructure',
		}

		// Apply tags to the entire construct and all child resources
		Object.entries(tags).forEach(([key, value]) => {
			cdk.Tags.of(this).add(key, value)
		})
		// Note: Project, Environment, Component, Purpose, CostCenter are inherited from stack level
	}

	/**
	 * Get environment name from constructor props or default
	 */
	private getEnvironmentName(): string {
		return 'development' // Default for now, could be enhanced to read from props
	}

	/**
	 * Create comprehensive CloudFormation outputs
	 */
	private createOutputs(): void {
		// VPC outputs
		new cdk.CfnOutput(this, 'NetworkingVpcId', {
			value: this.vpcId,
			description: 'VPC ID for Macro AI networking infrastructure',
			exportName: 'MacroAI-Networking-VpcId',
		})

		new cdk.CfnOutput(this, 'NetworkingVpcCidr', {
			value: this.vpcCidrBlock,
			description: 'VPC CIDR block',
			exportName: 'MacroAI-Networking-VpcCidr',
		})

		// Subnet outputs
		new cdk.CfnOutput(this, 'NetworkingPublicSubnets', {
			value: this.publicSubnets.map((subnet) => subnet.subnetId).join(','),
			description: 'Public subnet IDs for ALB and EC2 instances',
			exportName: 'MacroAI-Networking-PublicSubnets',
		})

		new cdk.CfnOutput(this, 'NetworkingPrivateSubnets', {
			value: this.privateSubnets.map((subnet) => subnet.subnetId).join(','),
			description: 'Private subnet IDs for future database resources',
			exportName: 'MacroAI-Networking-PrivateSubnets',
		})

		// Security group outputs
		new cdk.CfnOutput(this, 'NetworkingAlbSecurityGroup', {
			value: this.albSecurityGroup.securityGroupId,
			description: 'Shared ALB security group ID',
			exportName: 'MacroAI-Networking-AlbSecurityGroup',
		})

		// Availability zone outputs
		new cdk.CfnOutput(this, 'NetworkingAvailabilityZones', {
			value: this.getAvailabilityZones().join(','),
			description: 'Availability zones used by the VPC',
			exportName: 'MacroAI-Networking-AvailabilityZones',
		})
	}

	/**
	 * Generate networking summary for documentation
	 */
	public generateNetworkingSummary(): string {
		return `
Macro AI Networking Infrastructure Summary:

VPC Configuration:
- VPC ID: ${this.vpcId}
- CIDR Block: ${this.vpcCidrBlock}
- Availability Zones: ${this.getAvailabilityZones().join(', ')}

Subnets:
- Public Subnets: ${this.publicSubnets.length.toString()} (for ALB and EC2)
- Private Subnets: ${this.privateSubnets.length.toString()} (for future databases)
- Database Subnets: ${this.databaseSubnets.length.toString()} (isolated)

Security:
- Shared ALB Security Group: ${this.albSecurityGroup.securityGroupId}
- PR-specific security groups created on demand
- Network-level isolation between PR environments

Cost Optimization:
- Single shared VPC across all PR environments
- Public subnets for EC2 (no NAT Gateway costs)
- Single NAT Gateway for private subnet access
- VPC endpoints for AWS services
		`.trim()
	}
}
