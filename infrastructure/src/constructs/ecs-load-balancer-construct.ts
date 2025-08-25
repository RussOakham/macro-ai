import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import { Construct } from 'constructs'

export interface EcsLoadBalancerConstructProps {
	/**
	 * VPC where the load balancer will be deployed
	 */
	readonly vpc: ec2.IVpc

	/**
	 * ECS service to attach to the load balancer
	 */
	readonly ecsService: ecs.FargateService

	/**
	 * Environment name for resource naming and tagging
	 * @default 'development'
	 */
	readonly environmentName?: string

	/**
	 * Custom domain configuration for HTTPS endpoints
	 */
	readonly customDomain?: {
		readonly domainName: string
		readonly hostedZoneId: string
		readonly certificateArn?: string
	}

	/**
	 * Container port for health checks
	 * @default 3000
	 */
	readonly containerPort?: number

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

	/**
	 * Enable access logs for the load balancer
	 * @default false (cost optimization)
	 */
	readonly enableAccessLogs?: boolean

	/**
	 * Security group for the load balancer
	 * If not provided, will create a new one
	 */
	readonly securityGroup?: ec2.ISecurityGroup

	/**
	 * Enable deletion protection
	 * @default false (cost optimization for development)
	 */
	readonly deletionProtection?: boolean

	/**
	 * Idle timeout for connections
	 * @default 60 seconds
	 */
	readonly idleTimeout?: cdk.Duration
}

/**
 * ECS Load Balancer Construct for Macro AI Express API
 *
 * This construct provides Application Load Balancer integration with ECS Fargate services:
 * - HTTP and HTTPS listeners with SSL/TLS termination
 * - Target group with health checks
 * - Security group configuration
 * - Access logging and monitoring
 * - Custom domain support with ACM certificates
 */
export class EcsLoadBalancerConstruct extends Construct {
	public readonly loadBalancer: elbv2.ApplicationLoadBalancer
	public readonly targetGroup: elbv2.ApplicationTargetGroup
	public readonly httpListener: elbv2.ApplicationListener
	public readonly httpsListener?: elbv2.ApplicationListener
	public readonly securityGroup: ec2.ISecurityGroup

	constructor(
		scope: Construct,
		id: string,
		props: EcsLoadBalancerConstructProps,
	) {
		super(scope, id)

		const {
			vpc,
			ecsService,
			environmentName = 'development',
			customDomain,
			containerPort = 3000,
			healthCheck = {
				path: '/api/health',
				interval: cdk.Duration.seconds(30),
				timeout: cdk.Duration.seconds(5),
				healthyThresholdCount: 2,
				unhealthyThresholdCount: 3,
			},

			securityGroup: providedSecurityGroup,
			deletionProtection = false,
			idleTimeout = cdk.Duration.seconds(60),
		} = props

		// Create or use provided security group
		this.securityGroup =
			providedSecurityGroup ??
			new ec2.SecurityGroup(this, 'LoadBalancerSecurityGroup', {
				vpc,
				description: `ALB Security Group for ${environmentName}`,
				allowAllOutbound: true,
			})

		// Allow HTTP and HTTPS inbound
		this.securityGroup.addIngressRule(
			ec2.Peer.anyIpv4(),
			ec2.Port.tcp(80),
			'Allow HTTP inbound',
		)
		this.securityGroup.addIngressRule(
			ec2.Peer.anyIpv4(),
			ec2.Port.tcp(443),
			'Allow HTTPS inbound',
		)

		// Create Application Load Balancer
		this.loadBalancer = new elbv2.ApplicationLoadBalancer(
			this,
			'LoadBalancer',
			{
				vpc,
				internetFacing: true,
				securityGroup: this.securityGroup,
				vpcSubnets: {
					subnetType: ec2.SubnetType.PUBLIC,
				},
				loadBalancerName: `macro-ai-${environmentName}-alb`,
				idleTimeout,
				deletionProtection,
			},
		)

		// Create target group for ECS service
		this.targetGroup = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
			vpc,
			port: containerPort,
			protocol: elbv2.ApplicationProtocol.HTTP,
			targetType: elbv2.TargetType.IP,
			targetGroupName: `macro-ai-${environmentName}-tg`,
			healthCheck: {
				enabled: true,
				path: healthCheck.path,
				protocol: elbv2.Protocol.HTTP,
				healthyHttpCodes: '200',
				interval: healthCheck.interval,
				timeout: healthCheck.timeout,
				healthyThresholdCount: healthCheck.healthyThresholdCount,
				unhealthyThresholdCount: healthCheck.unhealthyThresholdCount,
			},
		})

		// Attach ECS service to target group
		this.targetGroup.addTarget(ecsService)

		// Create HTTP listener (port 80)
		this.httpListener = this.loadBalancer.addListener('HttpListener', {
			port: 80,
			protocol: elbv2.ApplicationProtocol.HTTP,
			defaultAction: elbv2.ListenerAction.forward([this.targetGroup]),
		})

		// Create HTTPS listener if custom domain is provided AND we have a certificate
		if (customDomain?.certificateArn) {
			// Redirect HTTP to HTTPS
			this.httpListener.addAction('RedirectToHttps', {
				priority: 1,
				conditions: [elbv2.ListenerCondition.pathPatterns(['/*'])],
				action: elbv2.ListenerAction.redirect({
					protocol: 'HTTPS',
					port: '443',
					permanent: true,
				}),
			})

			// Create HTTPS listener (port 443) with certificate
			this.httpsListener = this.loadBalancer.addListener('HttpsListener', {
				port: 443,
				protocol: elbv2.ApplicationProtocol.HTTPS,
				certificates: [
					elbv2.ListenerCertificate.fromArn(customDomain.certificateArn),
				],
				defaultAction: elbv2.ListenerAction.forward([this.targetGroup]),
			})
		} else if (customDomain?.certificateArn === undefined) {
			// Log warning that HTTPS is not available without certificate
			console.warn(
				`Custom domain ${customDomain?.domainName ?? 'undefined'} provided but no certificate ARN. HTTPS listener will not be created.`,
			)
			console.warn(
				'To enable HTTPS, provide certificateArn in customDomain configuration.',
			)
		}

		// Add tags for resource identification
		cdk.Tags.of(this.loadBalancer).add('Component', 'LoadBalancer')
		cdk.Tags.of(this.loadBalancer).add('Environment', environmentName)
		cdk.Tags.of(this.targetGroup).add('Component', 'TargetGroup')
		cdk.Tags.of(this.targetGroup).add('Environment', environmentName)
	}

	/**
	 * Get the load balancer DNS name
	 */
	public get loadBalancerDnsName(): string {
		return this.loadBalancer.loadBalancerDnsName
	}

	/**
	 * Get the load balancer ARN
	 */
	public get loadBalancerArn(): string {
		return this.loadBalancer.loadBalancerArn
	}

	/**
	 * Get the target group ARN
	 */
	public get targetGroupArn(): string {
		return this.targetGroup.targetGroupArn
	}

	/**
	 * Get the HTTP listener ARN
	 */
	public get httpListenerArn(): string {
		return this.httpListener.listenerArn
	}

	/**
	 * Get the HTTPS listener ARN (if available)
	 */
	public get httpsListenerArn(): string | undefined {
		return this.httpsListener?.listenerArn
	}

	/**
	 * Get the service URL (HTTP or HTTPS based on custom domain)
	 */
	public get serviceUrl(): string {
		const protocol = this.httpsListener ? 'https' : 'http'
		return `${protocol}://${this.loadBalancerDnsName}`
	}

	/**
	 * Get the health check URL
	 */
	public get healthCheckUrl(): string {
		return `${this.serviceUrl}/health`
	}
}
