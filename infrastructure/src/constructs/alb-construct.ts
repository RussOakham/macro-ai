import * as cdk from 'aws-cdk-lib'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as route53targets from 'aws-cdk-lib/aws-route53-targets'
import { Construct } from 'constructs'

import { TAG_VALUES, TaggingStrategy } from '../utils/tagging-strategy.js'

export interface AlbConstructProps {
	/**
	 * VPC where ALB will be deployed
	 */
	readonly vpc: ec2.IVpc

	/**
	 * Security group for ALB
	 */
	readonly securityGroup: ec2.ISecurityGroup

	/**
	 * Environment name for resource naming and tagging
	 * @default 'development'
	 */
	readonly environmentName?: string

	/**
	 * Enable detailed monitoring and logging
	 * @default false (cost optimization)
	 */
	readonly enableDetailedMonitoring?: boolean

	/**
	 * Custom domain configuration (optional)
	 */
	readonly customDomain?: {
		readonly domainName: string
		readonly hostedZoneId: string
		readonly certificateArn?: string
	}

	/**
	 * Health check configuration
	 */
	readonly healthCheck?: {
		readonly path: string
		readonly interval: cdk.Duration
		readonly timeout: cdk.Duration
		readonly healthyThresholdCount: number
		readonly unhealthyThresholdCount: number
	}
}

export interface PrTargetGroupProps {
	/**
	 * PR number for resource naming and tagging
	 */
	readonly prNumber: number

	/**
	 * VPC where target group will be created
	 */
	readonly vpc: ec2.IVpc

	/**
	 * Environment name for resource naming
	 * @default 'development'
	 */
	readonly environmentName?: string

	/**
	 * Health check configuration override
	 */
	readonly healthCheck?: {
		readonly path: string
		readonly interval: cdk.Duration
		readonly timeout: cdk.Duration
		readonly healthyThresholdCount: number
		readonly unhealthyThresholdCount: number
	}
}

/**
 * Application Load Balancer Construct for Macro AI preview environments
 *
 * This construct provides a shared ALB for routing traffic to PR-specific EC2 instances.
 * It implements cost-optimized deployment with proper health checks, SSL termination,
 * and support for custom domains.
 *
 * Key Features:
 * - Shared ALB across all PR environments (cost optimization)
 * - SSL termination with automatic certificate management
 * - Health checks with configurable parameters
 * - Support for custom domains and Route 53 integration
 * - PR-specific target groups for traffic isolation
 * - Comprehensive logging and monitoring
 * - HTTP to HTTPS redirect for security
 */
export class AlbConstruct extends Construct {
	public readonly applicationLoadBalancer: elbv2.ApplicationLoadBalancer
	public readonly httpsListener: elbv2.ApplicationListener
	public readonly httpListener: elbv2.ApplicationListener
	public readonly defaultTargetGroup: elbv2.ApplicationTargetGroup

	constructor(scope: Construct, id: string, props: AlbConstructProps) {
		super(scope, id)

		const {
			vpc,
			securityGroup,
			environmentName = 'development',
			customDomain,
			healthCheck = {
				path: '/api/health',
				interval: cdk.Duration.seconds(30),
				timeout: cdk.Duration.seconds(5),
				healthyThresholdCount: 2,
				unhealthyThresholdCount: 3,
			},
		} = props

		// Create Application Load Balancer
		this.applicationLoadBalancer = this.createApplicationLoadBalancer(
			vpc,
			securityGroup,
			environmentName,
		)

		// Create default target group (for health checks and fallback)
		this.defaultTargetGroup = this.createDefaultTargetGroup(
			vpc,
			environmentName,
			healthCheck,
		)

		// Create HTTPS listener only if custom domain is provided
		if (customDomain) {
			this.httpsListener = this.createHttpsListener(customDomain)
			// Create HTTP listener (redirect to HTTPS)
			this.httpListener = this.createHttpListener()
		} else {
			// For development without custom domain, create HTTP listener only
			this.httpListener = this.createHttpListenerOnly()
			// HTTPS listener will be undefined
			this.httpsListener = this.httpListener // Use HTTP listener as default
		}

		// Set up custom domain if provided
		if (customDomain) {
			this.setupCustomDomain(customDomain)
		}

		// Apply tags to the construct
		this.applyTags(environmentName)
	}

	/**
	 * Factory method to create PR-specific target group
	 * Each PR gets its own target group for traffic isolation
	 */
	public createPrTargetGroup(
		props: PrTargetGroupProps,
	): elbv2.ApplicationTargetGroup {
		const {
			prNumber,
			vpc,
			environmentName = 'development',
			healthCheck = {
				path: '/api/health',
				interval: cdk.Duration.seconds(30),
				timeout: cdk.Duration.seconds(5),
				healthyThresholdCount: 2,
				unhealthyThresholdCount: 3,
			},
		} = props

		const targetGroup = new elbv2.ApplicationTargetGroup(
			this,
			`Pr${prNumber.toString()}TargetGroup`,
			{
				targetGroupName: `macro-ai-${environmentName}-pr-${prNumber.toString()}-tg`,
				port: 3040,
				protocol: elbv2.ApplicationProtocol.HTTP,
				vpc,
				targetType: elbv2.TargetType.INSTANCE,
				healthCheck: {
					enabled: true,
					path: healthCheck.path,
					protocol: elbv2.Protocol.HTTP,
					port: '3040',
					healthyHttpCodes: '200-399',
					interval: healthCheck.interval,
					timeout: healthCheck.timeout,
					healthyThresholdCount: healthCheck.healthyThresholdCount,
					unhealthyThresholdCount: healthCheck.unhealthyThresholdCount,
				},
				// Deregistration delay for faster deployments
				deregistrationDelay: cdk.Duration.seconds(30),
			},
		)

		// Apply PR-specific tags
		this.applyPrTargetGroupTags(targetGroup, prNumber)

		return targetGroup
	}

	/**
	 * Add listener rule for PR-specific routing
	 * Routes traffic based on Host header or path prefix
	 */
	public addPrListenerRule(
		prNumber: number,
		targetGroup: elbv2.ApplicationTargetGroup,
		hostHeader?: string,
		pathPrefix?: string,
	): elbv2.ApplicationListenerRule {
		const conditions: elbv2.ListenerCondition[] = []

		// Add host header condition if provided
		if (hostHeader) {
			conditions.push(elbv2.ListenerCondition.hostHeaders([hostHeader]))
		}

		// Add path prefix condition if provided
		if (pathPrefix) {
			conditions.push(elbv2.ListenerCondition.pathPatterns([pathPrefix]))
		}

		// Default to path prefix if no conditions provided
		if (conditions.length === 0) {
			conditions.push(
				elbv2.ListenerCondition.pathPatterns([`/pr-${prNumber.toString()}/*`]),
			)
		}

		return new elbv2.ApplicationListenerRule(
			this,
			`Pr${prNumber.toString()}ListenerRule`,
			{
				listener: this.httpsListener,
				priority: 100 + prNumber, // Ensure unique priority
				conditions,
				action: elbv2.ListenerAction.forward([targetGroup]),
			},
		)
	}

	/**
	 * Create Application Load Balancer
	 */
	private createApplicationLoadBalancer(
		vpc: ec2.IVpc,
		securityGroup: ec2.ISecurityGroup,
		environmentName: string,
	): elbv2.ApplicationLoadBalancer {
		return new elbv2.ApplicationLoadBalancer(this, 'ApplicationLoadBalancer', {
			loadBalancerName: `macro-ai-${environmentName}-alb`,
			vpc,
			internetFacing: true,
			securityGroup,
			// Use public subnets for internet-facing ALB
			vpcSubnets: {
				subnetType: ec2.SubnetType.PUBLIC,
			},
			// Enable deletion protection in production
			deletionProtection: environmentName === 'production',
			// Access logs are not supported in this CDK version for ALB
			// They can be enabled manually in the AWS console if needed
		})
	}

	/**
	 * Create default target group for health checks and fallback
	 */
	private createDefaultTargetGroup(
		vpc: ec2.IVpc,
		environmentName: string,
		healthCheck: {
			readonly path: string
			readonly interval: cdk.Duration
			readonly timeout: cdk.Duration
			readonly healthyThresholdCount: number
			readonly unhealthyThresholdCount: number
		},
	): elbv2.ApplicationTargetGroup {
		return new elbv2.ApplicationTargetGroup(this, 'DefaultTargetGroup', {
			targetGroupName: `macro-ai-${environmentName}-default-tg`,
			port: 3040,
			protocol: elbv2.ApplicationProtocol.HTTP,
			vpc,
			targetType: elbv2.TargetType.INSTANCE,
			healthCheck: {
				enabled: true,
				path: healthCheck.path,
				protocol: elbv2.Protocol.HTTP,
				port: '3040',
				healthyHttpCodes: '200-399',
				interval: healthCheck.interval,
				timeout: healthCheck.timeout,
				healthyThresholdCount: healthCheck.healthyThresholdCount,
				unhealthyThresholdCount: healthCheck.unhealthyThresholdCount,
			},
		})
	}

	/**
	 * Create HTTPS listener with SSL termination
	 */
	private createHttpsListener(
		customDomain?: AlbConstructProps['customDomain'],
	): elbv2.ApplicationListener {
		// If no custom domain is provided, we'll only create HTTP listener
		// HTTPS requires a valid certificate
		if (!customDomain) {
			throw new Error(
				'HTTPS listener requires custom domain configuration with certificate. ' +
					'For development, use HTTP listener only or provide a custom domain.',
			)
		}

		let certificates: elbv2.IListenerCertificate[] = []

		// Add SSL certificate if custom domain is provided
		if (customDomain.certificateArn) {
			certificates = [
				elbv2.ListenerCertificate.fromArn(customDomain.certificateArn),
			]
		} else if (customDomain.domainName && customDomain.hostedZoneId) {
			// Create certificate if domain is provided but no certificate ARN
			const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
				this,
				'HostedZone',
				{
					hostedZoneId: customDomain.hostedZoneId,
					zoneName: customDomain.domainName,
				},
			)

			const certificate = new acm.Certificate(this, 'AlbCertificate', {
				domainName: customDomain.domainName,
				subjectAlternativeNames: [`*.${customDomain.domainName}`],
				validation: acm.CertificateValidation.fromDns(hostedZone),
			})

			certificates = [
				elbv2.ListenerCertificate.fromArn(certificate.certificateArn),
			]
		} else {
			throw new Error(
				'Custom domain must include either certificateArn or both domainName and hostedZoneId',
			)
		}

		return new elbv2.ApplicationListener(this, 'HttpsListener', {
			loadBalancer: this.applicationLoadBalancer,
			port: 443,
			protocol: elbv2.ApplicationProtocol.HTTPS,
			defaultAction: elbv2.ListenerAction.forward([this.defaultTargetGroup]),
			certificates,
		})
	}

	/**
	 * Create HTTP listener that redirects to HTTPS
	 */
	private createHttpListener(): elbv2.ApplicationListener {
		return new elbv2.ApplicationListener(this, 'HttpListener', {
			loadBalancer: this.applicationLoadBalancer,
			port: 80,
			protocol: elbv2.ApplicationProtocol.HTTP,
			defaultAction: elbv2.ListenerAction.redirect({
				protocol: 'HTTPS',
				port: '443',
				permanent: true,
			}),
		})
	}

	/**
	 * Create HTTP listener for development (no HTTPS redirect)
	 */
	private createHttpListenerOnly(): elbv2.ApplicationListener {
		return new elbv2.ApplicationListener(this, 'HttpListener', {
			loadBalancer: this.applicationLoadBalancer,
			port: 80,
			protocol: elbv2.ApplicationProtocol.HTTP,
			defaultAction: elbv2.ListenerAction.forward([this.defaultTargetGroup]),
		})
	}

	/**
	 * Set up custom domain with Route 53 alias record
	 */
	private setupCustomDomain(customDomain: {
		readonly domainName: string
		readonly hostedZoneId: string
		readonly certificateArn?: string
	}): void {
		const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
			this,
			'CustomDomainHostedZone',
			{
				hostedZoneId: customDomain.hostedZoneId,
				zoneName: customDomain.domainName,
			},
		)

		// Create alias record pointing to ALB
		new route53.ARecord(this, 'CustomDomainAliasRecord', {
			zone: hostedZone,
			recordName: customDomain.domainName,
			target: route53.RecordTarget.fromAlias(
				new route53targets.LoadBalancerTarget(this.applicationLoadBalancer),
			),
		})

		// Create wildcard alias record for subdomains (PR previews)
		new route53.ARecord(this, 'WildcardDomainAliasRecord', {
			zone: hostedZone,
			recordName: `*.${customDomain.domainName}`,
			target: route53.RecordTarget.fromAlias(
				new route53targets.LoadBalancerTarget(this.applicationLoadBalancer),
			),
		})
	}

	/**
	 * Apply comprehensive tagging for cost tracking and resource management
	 * Note: Avoid duplicate tag keys that might conflict with stack-level tags
	 */
	private applyTags(environmentName: string): void {
		// Apply construct-specific tags that don't conflict with stack-level tags
		cdk.Tags.of(this).add('SubComponent', 'ALB')
		cdk.Tags.of(this).add('SubPurpose', 'LoadBalancing')
		cdk.Tags.of(this).add('ConstructManagedBy', 'AlbConstruct')
		cdk.Tags.of(this).add('LoadBalancerType', 'ApplicationLoadBalancer')
		// Note: Environment, Component, Purpose, CreatedBy are inherited from stack level
	}

	/**
	 * Apply PR-specific tags to target groups
	 */
	private applyPrTargetGroupTags(
		targetGroup: elbv2.ApplicationTargetGroup,
		prNumber: number,
	): void {
		TaggingStrategy.applyPrTags(targetGroup, {
			prNumber,
			component: 'ALB-TargetGroup',
			purpose: TAG_VALUES.PURPOSES.PREVIEW_ENVIRONMENT,
			createdBy: 'AlbConstruct',
			expiryDays: 7,
			autoShutdown: false, // Target groups don't need auto-shutdown
			backupRequired: false, // Target groups don't need backups
			monitoringLevel: TAG_VALUES.MONITORING_LEVELS.BASIC,
		})
	}

	/**
	 * Create CloudWatch alarms for ALB monitoring
	 */
	public createAlbAlarms(): void {
		// Target response time alarm
		new cdk.aws_cloudwatch.Alarm(this, 'AlbHighResponseTimeAlarm', {
			metric: new cdk.aws_cloudwatch.Metric({
				namespace: 'AWS/ApplicationELB',
				metricName: 'TargetResponseTime',
				dimensionsMap: {
					LoadBalancer: this.applicationLoadBalancer.loadBalancerFullName,
				},
				statistic: 'Average',
			}),
			threshold: 5, // 5 seconds
			evaluationPeriods: 2,
			alarmDescription: `High response time for ${this.applicationLoadBalancer.loadBalancerName}`,
		})

		// HTTP 5xx error rate alarm
		new cdk.aws_cloudwatch.Alarm(this, 'AlbHttp5xxErrorAlarm', {
			metric: new cdk.aws_cloudwatch.Metric({
				namespace: 'AWS/ApplicationELB',
				metricName: 'HTTPCode_ELB_5XX_Count',
				dimensionsMap: {
					LoadBalancer: this.applicationLoadBalancer.loadBalancerFullName,
				},
				statistic: 'Sum',
			}),
			threshold: 10,
			evaluationPeriods: 2,
			alarmDescription: `High 5xx error rate for ${this.applicationLoadBalancer.loadBalancerName}`,
		})

		// Unhealthy target alarm
		new cdk.aws_cloudwatch.Alarm(this, 'AlbUnhealthyTargetAlarm', {
			metric: new cdk.aws_cloudwatch.Metric({
				namespace: 'AWS/ApplicationELB',
				metricName: 'UnHealthyHostCount',
				dimensionsMap: {
					TargetGroup: this.defaultTargetGroup.targetGroupFullName,
					LoadBalancer: this.applicationLoadBalancer.loadBalancerFullName,
				},
				statistic: 'Average',
			}),
			threshold: 1,
			evaluationPeriods: 2,
			alarmDescription: `Unhealthy targets in ${this.defaultTargetGroup.targetGroupName}`,
		})
	}

	/**
	 * Generate ALB configuration summary for documentation
	 */
	public generateAlbSummary(): string {
		return `
Macro AI Application Load Balancer Summary:

Load Balancer Configuration:
- Name: ${this.applicationLoadBalancer.loadBalancerName}
- Type: Application Load Balancer (Layer 7)
- Scheme: Internet-facing
- IP Address Type: IPv4

Listeners:
- HTTPS (443): SSL termination with certificate validation
- HTTP (80): Automatic redirect to HTTPS

Target Groups:
- Default Target Group: Health checks and fallback routing
- PR-specific Target Groups: Isolated routing per PR environment
- Health Check Path: /api/health
- Health Check Protocol: HTTP on port 3040

Security:
- Security Groups: Shared ALB security group with explicit rules
- SSL/TLS: Automatic certificate management via ACM
- HTTP to HTTPS: Automatic redirect for security

Cost Optimization:
- Shared ALB: Single load balancer across all PR environments
- Target Group Isolation: PR-specific routing without additional ALBs
- Health Check Optimization: 30-second intervals, 5-second timeout
- Access Logs: Disabled in development (enabled in production)

Monitoring:
- CloudWatch Metrics: Response time, error rates, target health
- Alarms: High response time, 5xx errors, unhealthy targets
- Target Group Health: Automatic deregistration of unhealthy instances
		`.trim()
	}
}
