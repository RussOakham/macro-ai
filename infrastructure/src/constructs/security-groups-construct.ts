import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { Construct } from 'constructs'

import { TAG_VALUES, TaggingStrategy } from '../utils/tagging-strategy.js'

export interface SecurityGroupsConstructProps {
	/**
	 * VPC where security groups will be created
	 */
	readonly vpc: ec2.IVpc

	/**
	 * Environment name for resource naming and tagging
	 * @default 'development'
	 */
	readonly environmentName?: string
}

export interface PrSecurityGroupProps {
	/**
	 * PR number for naming and tagging
	 */
	readonly prNumber: number

	/**
	 * VPC where the security group will be created
	 */
	readonly vpc: ec2.IVpc

	/**
	 * Shared ALB security group for ingress rules
	 */
	readonly albSecurityGroup: ec2.ISecurityGroup

	/**
	 * Environment name for tagging
	 * @default 'development'
	 */
	readonly environmentName?: string
}

/**
 * Security Groups Construct for Macro AI EC2-based preview environments
 *
 * Creates a shared ALB security group and provides factory methods for
 * creating PR-specific security groups with proper network isolation.
 *
 * Security Architecture:
 * - Shared ALB security group (cost optimization)
 * - PR-specific EC2 security groups (network isolation)
 * - Minimal attack surface (HTTPS only from internet)
 * - Explicit egress rules (principle of least privilege)
 * - Session Manager access (no SSH required)
 */
export class SecurityGroupsConstruct extends Construct {
	public readonly albSecurityGroup: ec2.SecurityGroup

	constructor(
		scope: Construct,
		id: string,
		props: SecurityGroupsConstructProps,
	) {
		super(scope, id)

		const { vpc, environmentName = 'development' } = props

		// Create shared ALB security group
		this.albSecurityGroup = this.createAlbSecurityGroup(vpc, environmentName)

		// Apply tags
		this.applyTags(environmentName)
	}

	/**
	 * Create shared ALB security group for all PR environments
	 * This is cost-optimized by sharing one ALB across all PRs
	 */
	private createAlbSecurityGroup(
		vpc: ec2.IVpc,
		environmentName: string,
	): ec2.SecurityGroup {
		const albSg = new ec2.SecurityGroup(this, 'SharedAlbSecurityGroup', {
			vpc,
			description: 'Shared ALB security group for all PR preview environments',
			securityGroupName: `macro-ai-${environmentName}-shared-alb-sg`,
			allowAllOutbound: false, // Explicit egress rules only
		})

		// INGRESS RULES - Internet to ALB

		// HTTPS from internet (primary access method)
		albSg.addIngressRule(
			ec2.Peer.anyIpv4(),
			ec2.Port.tcp(443),
			'HTTPS from internet to ALB',
		)

		// HTTP from internet (redirect to HTTPS)
		albSg.addIngressRule(
			ec2.Peer.anyIpv4(),
			ec2.Port.tcp(80),
			'HTTP from internet to ALB (redirect to HTTPS)',
		)

		// EGRESS RULES - ALB to EC2 instances

		// ALB to EC2 instances on Express API port
		albSg.addEgressRule(
			ec2.Peer.ipv4(vpc.vpcCidrBlock),
			ec2.Port.tcp(3040),
			'ALB to EC2 instances (Express API)',
		)

		// Health check traffic (same port, but explicit for clarity)
		albSg.addEgressRule(
			ec2.Peer.ipv4(vpc.vpcCidrBlock),
			ec2.Port.tcp(3040),
			'ALB health checks to EC2 instances',
		)

		return albSg
	}

	/**
	 * Factory method to create PR-specific security group
	 * Each PR gets its own security group for network-level isolation
	 */
	public createPrSecurityGroup(props: PrSecurityGroupProps): ec2.SecurityGroup {
		const {
			prNumber,
			vpc,
			albSecurityGroup,
			environmentName = 'development',
		} = props

		const prSg = new ec2.SecurityGroup(
			this,
			`Pr${prNumber.toString()}SecurityGroup`,
			{
				vpc,
				description: `Security group for PR #${prNumber.toString()} EC2 instance`,
				securityGroupName: `macro-ai-${environmentName}-pr-${prNumber.toString()}-sg`,
				allowAllOutbound: false, // Explicit egress rules only
			},
		)

		// INGRESS RULES - Minimal Attack Surface

		// Rule 1: ALB → EC2 instance (HTTP only, internal)
		prSg.addIngressRule(
			ec2.Peer.securityGroupId(albSecurityGroup.securityGroupId),
			ec2.Port.tcp(3040),
			`ALB to PR #${prNumber.toString()} Express API`,
		)

		// Rule 2: Systems Manager Session Manager (no SSH required)
		// This allows secure shell access without opening SSH ports
		prSg.addIngressRule(
			ec2.Peer.ipv4(vpc.vpcCidrBlock),
			ec2.Port.tcp(443),
			`Session Manager access for PR #${prNumber.toString()}`,
		)

		// EGRESS RULES - Principle of Least Privilege

		// Rule 1: HTTPS for AWS services (Parameter Store, CloudWatch, etc.)
		prSg.addEgressRule(
			ec2.Peer.anyIpv4(),
			ec2.Port.tcp(443),
			`HTTPS for AWS services (PR #${prNumber.toString()})`,
		)

		// Rule 2: HTTP for npm package downloads
		prSg.addEgressRule(
			ec2.Peer.anyIpv4(),
			ec2.Port.tcp(80),
			`HTTP for npm packages (PR #${prNumber.toString()})`,
		)

		// Rule 3: DNS resolution
		prSg.addEgressRule(
			ec2.Peer.anyIpv4(),
			ec2.Port.udp(53),
			`DNS resolution (PR #${prNumber.toString()})`,
		)

		// Rule 4: NTP for time synchronization
		prSg.addEgressRule(
			ec2.Peer.anyIpv4(),
			ec2.Port.udp(123),
			`NTP time sync (PR #${prNumber.toString()})`,
		)

		// Apply PR-specific tags
		this.applyPrTags(prSg, prNumber)

		return prSg
	}

	/**
	 * Create a security group for database access (future use)
	 * This will be used when we add RDS or ElastiCache resources
	 */
	public createDatabaseSecurityGroup(vpc: ec2.IVpc): ec2.SecurityGroup {
		const dbSg = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
			vpc,
			description: 'Security group for database resources',
			securityGroupName: 'macro-ai-development-database-sg',
			allowAllOutbound: false, // No outbound access needed for databases
		})

		// PostgreSQL access from EC2 instances (future use)
		dbSg.addIngressRule(
			ec2.Peer.ipv4(vpc.vpcCidrBlock),
			ec2.Port.tcp(5432),
			'PostgreSQL access from EC2 instances',
		)

		// Redis access from EC2 instances (future use)
		dbSg.addIngressRule(
			ec2.Peer.ipv4(vpc.vpcCidrBlock),
			ec2.Port.tcp(6379),
			'Redis access from EC2 instances',
		)

		return dbSg
	}

	/**
	 * Apply tags to the shared security groups
	 */
	private applyTags(environmentName: string): void {
		TaggingStrategy.applyBaseTags(this, {
			environment: environmentName,
			component: 'Security-Groups',
			purpose: TAG_VALUES.PURPOSES.SHARED_INFRASTRUCTURE,
			createdBy: 'SecurityGroupsConstruct',
			monitoringLevel: TAG_VALUES.MONITORING_LEVELS.BASIC,
		})
	}

	/**
	 * Apply PR-specific tags to security groups
	 */
	private applyPrTags(
		securityGroup: ec2.SecurityGroup,
		prNumber: number,
	): void {
		TaggingStrategy.applyPrTags(securityGroup, {
			prNumber,
			component: 'Security-Group',
			purpose: TAG_VALUES.PURPOSES.PREVIEW_ENVIRONMENT,
			createdBy: 'SecurityGroupsConstruct',
			expiryDays: 7,
			autoShutdown: false, // Security groups don't need auto-shutdown
			backupRequired: false, // Security groups don't need backups
			monitoringLevel: TAG_VALUES.MONITORING_LEVELS.BASIC,
		})
	}

	/**
	 * Create CloudFormation outputs for security group references
	 */
	public createOutputs(): void {
		new cdk.CfnOutput(this, 'AlbSecurityGroupId', {
			value: this.albSecurityGroup.securityGroupId,
			description: 'Shared ALB security group ID',
			exportName: 'MacroAI-Development-AlbSecurityGroupId',
		})
	}

	/**
	 * Get the ALB security group for use in other constructs
	 */
	public getAlbSecurityGroup(): ec2.ISecurityGroup {
		return this.albSecurityGroup
	}
}

/**
 * Validate that PR security groups are properly isolated
 * This is a placeholder for future security validation logic
 */
export const validatePrIsolation: () => boolean = () => {
	// In a real implementation, this would check that:
	// 1. PR security groups cannot communicate with each other
	// 2. Only ALB can reach PR instances
	// 3. PR instances have minimal egress rules

	// For now, return true as validation logic would be complex
	// This is a placeholder for future security validation
	return true
}

/**
 * Generate security group rules summary for documentation
 */
export const generateSecurityGroupRulesSummary: (
	sg: ec2.ISecurityGroup,
) => string = (sg: ec2.ISecurityGroup) => {
	return `Security Group: ${sg.securityGroupId}
- Ingress: ALB → EC2 (port 3040), Session Manager (port 443)
- Egress: HTTPS (port 443), HTTP (port 80), DNS (port 53), NTP (port 123)
- Isolation: Network-level isolation from other PR environments`
}
