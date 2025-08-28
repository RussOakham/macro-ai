import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { Construct } from 'constructs'

// EC2 construct removed - ECS Fargate only

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
	 * @default true (required for ECS Fargate preview environments)
	 */
	readonly enableAlb?: boolean

	// EC2 support removed - ECS Fargate only

	/**
	 * Custom domain configuration for ALB
	 */
	readonly customDomain?: {
		readonly domainName: string
		readonly hostedZoneId: string
		readonly certificateArn?: string
	}

	/**
	 * Prefix for CloudFormation export names to ensure uniqueness across environments
	 * @default 'MacroAI' - set to stack name for preview environments to avoid export conflicts
	 */
	readonly exportPrefix?: string

	/**
	 * Deployment ID to force instance replacement on every deployment
	 * This ensures fresh instances with latest application code
	 * @default current timestamp
	 */
	readonly deploymentId?: string

	/**
	 * Branch name for deployment tracking
	 */
	readonly branchName?: string

	/**
	 * Custom domain name for CORS configuration
	 */
	readonly customDomainName?: string
}

/**
 * Simplified Networking Construct for Macro AI ECS Fargate preview environments
 *
 * This construct provides basic VPC and networking infrastructure for containerized
 * deployments without legacy EC2 dependencies.
 */
export class NetworkingConstruct extends Construct {
	public readonly vpc: ec2.IVpc
	public readonly publicSubnets: ec2.ISubnet[]
	public readonly privateSubnets: ec2.ISubnet[]
	public readonly databaseSubnets: ec2.ISubnet[]
	// EC2 construct property removed - ECS Fargate only
	public readonly albSecurityGroup: ec2.ISecurityGroup
	public readonly ecsServiceSecurityGroup: ec2.ISecurityGroup
	public readonly vpcId: string
	public readonly vpcCidrBlock: string

	private readonly enableNatGateway: boolean
	private readonly exportPrefix: string
	private readonly environmentName: string

	constructor(
		scope: Construct,
		id: string,
		props: NetworkingConstructProps = {},
	) {
		super(scope, id)

		const {
			environmentName = 'development',
			maxAzs = 2,
			enableNatGateway = true,
			exportPrefix = 'MacroAI',
		} = props

		// Store configuration for later use
		this.enableNatGateway = enableNatGateway
		this.exportPrefix = exportPrefix
		this.environmentName = environmentName

		// Create basic VPC infrastructure
		this.vpc = new ec2.Vpc(this, 'Vpc', {
			maxAzs,
			enableDnsHostnames: true,
			enableDnsSupport: true,
			subnetConfiguration: [
				{
					cidrMask: 24,
					name: 'Public',
					subnetType: ec2.SubnetType.PUBLIC,
				},
				{
					cidrMask: 24,
					name: 'Private',
					subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
				},
				{
					cidrMask: 24,
					name: 'Database',
					subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
				},
			],
			natGateways: enableNatGateway ? maxAzs : 0,
		})

		this.publicSubnets = this.vpc.publicSubnets
		this.privateSubnets = this.vpc.privateSubnets
		this.databaseSubnets = this.vpc.isolatedSubnets

		// Create ALB security group
		// SECURITY: ALB only exposes HTTP/HTTPS ports (80/443) to the internet
		// Container port 3040 is NOT exposed here - it's only accessible via the ECS service security group
		this.albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
			vpc: this.vpc,
			description: `ALB Security Group for ${environmentName} - HTTP/HTTPS only`,
			allowAllOutbound: true,
		})

		// Allow HTTP and HTTPS inbound
		this.albSecurityGroup.addIngressRule(
			ec2.Peer.anyIpv4(),
			ec2.Port.tcp(80),
			'Allow HTTP inbound',
		)
		this.albSecurityGroup.addIngressRule(
			ec2.Peer.anyIpv4(),
			ec2.Port.tcp(443),
			'Allow HTTPS inbound',
		)

		// Create ECS service security group
		// SECURITY: This security group is tightly scoped to only allow ALB-to-task ingress
		// Since tasks run in public subnets for cost optimization (no NAT Gateway needed),
		// we must ensure the security group only allows traffic from the ALB on the container port.
		// This prevents direct external access to the ECS tasks while maintaining ALB routing.
		this.ecsServiceSecurityGroup = new ec2.SecurityGroup(
			this,
			'EcsServiceSecurityGroup',
			{
				vpc: this.vpc,
				description: `ECS Service Security Group for ${environmentName} - ALB access only`,
				allowAllOutbound: true,
			},
		)

		// Allow ALB to access ECS service on port 3040
		// This is the ONLY ingress rule - no external access allowed
		this.ecsServiceSecurityGroup.addIngressRule(
			this.albSecurityGroup,
			ec2.Port.tcp(3040),
			'Allow ALB to access ECS service on port 3040 - ALB only, no external access',
		)

		// EC2 construct instantiation removed - ECS Fargate only

		// Convenience properties
		this.vpcId = this.vpc.vpcId
		this.vpcCidrBlock = this.vpc.vpcCidrBlock

		// Create comprehensive outputs
		this.createOutputs()

		// Apply networking-level tags
		this.applyTags()
	}

	/**
	 * Create comprehensive CloudFormation outputs for the networking infrastructure
	 */
	private createOutputs(): void {
		new cdk.CfnOutput(this, 'VpcId', {
			value: this.vpc.vpcId,
			description: 'VPC ID for the networking infrastructure',
			exportName: `${this.exportPrefix}-VpcId`,
		})

		new cdk.CfnOutput(this, 'VpcCidrBlock', {
			value: this.vpc.vpcCidrBlock,
			description: 'VPC CIDR block',
			exportName: `${this.exportPrefix}-VpcCidrBlock`,
		})

		new cdk.CfnOutput(this, 'PublicSubnetIds', {
			value: this.publicSubnets.map((subnet) => subnet.subnetId).join(','),
			description: 'Public subnet IDs',
			exportName: `${this.exportPrefix}-PublicSubnetIds`,
		})

		new cdk.CfnOutput(this, 'PrivateSubnetIds', {
			value: this.privateSubnets.map((subnet) => subnet.subnetId).join(','),
			description: 'Private subnet IDs',
			exportName: `${this.exportPrefix}-PrivateSubnetIds`,
		})

		new cdk.CfnOutput(this, 'DatabaseSubnetIds', {
			value: this.databaseSubnets.map((subnet) => subnet.subnetId).join(','),
			description: 'Database subnet IDs',
			exportName: `${this.exportPrefix}-DatabaseSubnetIds`,
		})

		new cdk.CfnOutput(this, 'AlbSecurityGroupId', {
			value: this.albSecurityGroup.securityGroupId,
			description: 'ALB Security Group ID',
			exportName: `${this.exportPrefix}-AlbSecurityGroupId`,
		})

		new cdk.CfnOutput(this, 'EcsServiceSecurityGroupId', {
			value: this.ecsServiceSecurityGroup.securityGroupId,
			description: 'ECS Service Security Group ID',
			exportName: `${this.exportPrefix}-EcsServiceSecurityGroupId`,
		})

		// EC2 outputs removed - ECS Fargate only
	}

	/**
	 * Apply consistent tagging to all networking resources
	 */
	private applyTags(): void {
		cdk.Tags.of(this).add('Component', 'Networking')
		cdk.Tags.of(this).add('Environment', this.environmentName)
		cdk.Tags.of(this).add('ManagedBy', 'CDK')
	}

	/**
	 * Get the environment name for this construct
	 */
	public getEnvironmentName(): string {
		return this.environmentName
	}

	/**
	 * Validate that ALB requirements are met
	 */
	public validateAlbRequirements(): void {
		if (this.publicSubnets.length < 2) {
			throw new Error(
				'ALB requires at least 2 public subnets across different availability zones',
			)
		}
	}
}
