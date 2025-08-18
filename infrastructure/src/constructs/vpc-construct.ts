import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { Construct } from 'constructs'

// Note: TaggingStrategy imports removed as we now use direct cdk.Tags.of() calls to avoid conflicts

export interface VpcConstructProps {
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
	 * Enable NAT Gateway for private subnet internet access
	 * @default true - set to false for preview environments to eliminate NAT Gateway costs (~$2.76/month)
	 */
	readonly enableNatGateway?: boolean

	/**
	 * Enable VPC endpoints for AWS services
	 * @default true - set to false for preview environments to reduce costs and complexity
	 */
	readonly enableVpcEndpoints?: boolean
}

/**
 * VPC Construct for Macro AI EC2-based preview environments
 *
 * Creates a shared VPC infrastructure optimized for cost-efficient PR preview environments.
 * Uses a single VPC with network-level isolation via security groups rather than
 * per-PR VPCs to minimize infrastructure costs.
 *
 * Architecture:
 * - Shared VPC across all PR environments (cost optimization)
 * - Public subnets for EC2 instances (avoids NAT Gateway costs)
 * - Private subnets for future database resources
 * - Single NAT Gateway for cost optimization
 * - DNS resolution enabled for ALB and Parameter Store integration
 */
export class VpcConstruct extends Construct {
	public readonly vpc: ec2.Vpc
	public readonly publicSubnets: ec2.ISubnet[]
	public readonly privateSubnets: ec2.ISubnet[]
	public readonly databaseSubnets: ec2.ISubnet[]
	public readonly internetGateway: ec2.CfnInternetGateway

	constructor(scope: Construct, id: string, props: VpcConstructProps = {}) {
		super(scope, id)

		const {
			enableFlowLogs = false,
			maxAzs = 2,
			enableNatGateway = true,
			enableVpcEndpoints = true,
		} = props

		// Create subnet configuration based on NAT Gateway setting
		const subnetConfiguration = [
			{
				name: 'Public',
				subnetType: ec2.SubnetType.PUBLIC,
				cidrMask: 20, // 4,096 IPs per AZ (8,192 total)
				// EC2 instances placed here for direct internet access
				// Avoids NAT Gateway costs ($45/month per AZ)
			},
		]

		// Only add private subnets if NAT Gateway is enabled
		if (enableNatGateway) {
			subnetConfiguration.push(
				{
					name: 'Private',
					subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
					cidrMask: 20, // 4,096 IPs per AZ (8,192 total)
					// Reserved for future RDS, ElastiCache resources
				},
				{
					name: 'Database',
					subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
					cidrMask: 24, // 256 IPs per AZ (512 total)
					// Isolated subnets for sensitive data stores
				},
			)
		}

		// Create the main VPC with cost-optimized configuration
		this.vpc = new ec2.Vpc(this, 'MacroAiDevelopmentVpc', {
			// Network configuration
			maxAzs, // Multi-AZ for ALB requirement, cost-optimized
			ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'), // 65,536 IP addresses for growth

			subnetConfiguration,

			// DNS configuration for ALB and Parameter Store
			enableDnsHostnames: true,
			enableDnsSupport: true,

			// NAT Gateway configuration - 0 for preview environments to eliminate costs
			natGateways: enableNatGateway ? 1 : 0,

			// Gateway endpoints for cost optimization (free)
			gatewayEndpoints: {
				S3: {
					service: ec2.GatewayVpcEndpointAwsService.S3,
				},
				DynamoDB: {
					service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
				},
			},
		})

		// Store subnet references for easy access
		this.publicSubnets = this.vpc.publicSubnets
		this.privateSubnets = enableNatGateway ? this.vpc.privateSubnets : []
		this.databaseSubnets = enableNatGateway ? this.vpc.isolatedSubnets : []

		// Get reference to the Internet Gateway for tagging
		this.internetGateway = this.vpc.node.findChild('IGW').node
			.defaultChild as ec2.CfnInternetGateway

		// Create VPC endpoints for AWS services (cost optimization)
		// Only create if enabled and NAT Gateway exists (endpoints need private subnets)
		if (enableVpcEndpoints && enableNatGateway) {
			this.createVpcEndpoints()
		}

		// Configure VPC Flow Logs if enabled
		if (enableFlowLogs) {
			this.enableVpcFlowLogs()
		}

		// Apply comprehensive tagging
		this.applyTags()

		// Output VPC information for reference
		this.createOutputs()
	}

	/**
	 * Create VPC endpoints for AWS services to reduce NAT Gateway usage
	 * This optimizes costs by keeping AWS service traffic within the VPC
	 */
	private createVpcEndpoints(): void {
		// SSM Parameter Store endpoint (for configuration access)
		new ec2.InterfaceVpcEndpoint(this, 'SsmEndpoint', {
			vpc: this.vpc,
			service: ec2.InterfaceVpcEndpointAwsService.SSM,
			subnets: {
				subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
			},
			privateDnsEnabled: true,
		})

		// EC2 endpoint (for Systems Manager Session Manager)
		new ec2.InterfaceVpcEndpoint(this, 'Ec2Endpoint', {
			vpc: this.vpc,
			service: ec2.InterfaceVpcEndpointAwsService.EC2,
			subnets: {
				subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
			},
			privateDnsEnabled: true,
		})

		// CloudWatch Logs endpoint (for application logging)
		new ec2.InterfaceVpcEndpoint(this, 'CloudWatchLogsEndpoint', {
			vpc: this.vpc,
			service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
			subnets: {
				subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
			},
			privateDnsEnabled: true,
		})
	}

	/**
	 * Enable VPC Flow Logs for network monitoring and security analysis
	 */
	private enableVpcFlowLogs(): void {
		// Create CloudWatch Log Group for VPC Flow Logs
		const flowLogGroup = new cdk.aws_logs.LogGroup(this, 'VpcFlowLogGroup', {
			logGroupName: `/aws/vpc/flowlogs/${this.vpc.vpcId}`,
			retention: cdk.aws_logs.RetentionDays.ONE_WEEK, // Cost optimization
			removalPolicy: cdk.RemovalPolicy.DESTROY, // Safe for development
		})

		// Create IAM role for VPC Flow Logs
		const flowLogRole = new cdk.aws_iam.Role(this, 'VpcFlowLogRole', {
			assumedBy: new cdk.aws_iam.ServicePrincipal(
				'vpc-flow-logs.amazonaws.com',
			),
			inlinePolicies: {
				FlowLogDeliveryRolePolicy: new cdk.aws_iam.PolicyDocument({
					statements: [
						new cdk.aws_iam.PolicyStatement({
							effect: cdk.aws_iam.Effect.ALLOW,
							actions: [
								'logs:CreateLogGroup',
								'logs:CreateLogStream',
								'logs:PutLogEvents',
								'logs:DescribeLogGroups',
								'logs:DescribeLogStreams',
							],
							resources: [flowLogGroup.logGroupArn],
						}),
					],
				}),
			},
		})

		// Enable VPC Flow Logs
		new ec2.CfnFlowLog(this, 'VpcFlowLog', {
			resourceType: 'VPC',
			resourceId: this.vpc.vpcId,
			trafficType: 'ALL',
			logDestinationType: 'cloud-watch-logs',
			logGroupName: flowLogGroup.logGroupName,
			deliverLogsPermissionArn: flowLogRole.roleArn,
			tags: [
				{
					key: 'Name',
					value: 'MacroAI-VPC-FlowLogs',
				},
			],
		})
	}

	/**
	 * Apply comprehensive tagging for cost tracking and resource management
	 * Note: Avoid duplicate tag keys that might conflict with stack-level tags
	 */
	private applyTags(): void {
		// Apply construct-specific tags that don't conflict with stack-level tags
		cdk.Tags.of(this).add('SubComponent', 'VPC-Networking')
		cdk.Tags.of(this).add('SubPurpose', 'NetworkInfrastructure')
		cdk.Tags.of(this).add('ConstructManagedBy', 'VpcConstruct')
		cdk.Tags.of(this).add('VpcType', 'SharedVPC')
		// Note: Environment, Component, Purpose, CreatedBy are inherited from stack level
	}

	/**
	 * Create CloudFormation outputs for VPC information
	 */
	private createOutputs(): void {
		new cdk.CfnOutput(this, 'VpcId', {
			value: this.vpc.vpcId,
			description: 'VPC ID for Macro AI development environment',
			exportName: 'MacroAI-Development-VpcId',
		})

		new cdk.CfnOutput(this, 'VpcCidr', {
			value: this.vpc.vpcCidrBlock,
			description: 'VPC CIDR block',
			exportName: 'MacroAI-Development-VpcCidr',
		})

		new cdk.CfnOutput(this, 'PublicSubnetIds', {
			value: this.publicSubnets.map((subnet) => subnet.subnetId).join(','),
			description: 'Public subnet IDs (for EC2 instances)',
			exportName: 'MacroAI-Development-PublicSubnetIds',
		})

		new cdk.CfnOutput(this, 'PrivateSubnetIds', {
			value: this.privateSubnets.map((subnet) => subnet.subnetId).join(','),
			description: 'Private subnet IDs (for future database resources)',
			exportName: 'MacroAI-Development-PrivateSubnetIds',
		})
	}

	/**
	 * Get availability zones used by this VPC
	 */
	public getAvailabilityZones(): string[] {
		return this.vpc.availabilityZones
	}

	/**
	 * Get public subnet in a specific AZ (useful for ALB configuration)
	 */
	public getPublicSubnetInAz(az: string): ec2.ISubnet | undefined {
		return this.publicSubnets.find((subnet) => subnet.availabilityZone === az)
	}

	/**
	 * Get private subnet in a specific AZ (useful for database configuration)
	 */
	public getPrivateSubnetInAz(az: string): ec2.ISubnet | undefined {
		return this.privateSubnets.find((subnet) => subnet.availabilityZone === az)
	}
}
