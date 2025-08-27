import * as cdk from 'aws-cdk-lib'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as targets from 'aws-cdk-lib/aws-route53-targets'
import { Construct } from 'constructs'

import { EnvironmentConfigConstruct } from './environment-config-construct.js'

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
		/**
		 * API subdomain to use (e.g., 'pr-56-api')
		 * @default derived from environmentName
		 */
		readonly apiSubdomain?: string
		/**
		 * Whether to create frontend subdomain DNS record
		 * @default true (for backward compatibility)
		 */
		readonly createFrontendSubdomain?: boolean
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

	/**
	 * Environment configuration for CORS and other settings
	 */
	readonly environmentConfig?: EnvironmentConfigConstruct
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

		// Create HTTPS listener if custom domain is provided
		if (customDomain?.domainName) {
			// Create or use existing certificate
			let certificate: acm.ICertificate

			if (customDomain.certificateArn) {
				// Use existing certificate
				certificate = acm.Certificate.fromCertificateArn(
					this,
					'ExistingCertificate',
					customDomain.certificateArn,
				)
			} else {
				// Create new certificate for the domain and wildcard subdomains
				certificate = new acm.Certificate(this, 'DomainCertificate', {
					domainName: customDomain.domainName,
					subjectAlternativeNames: [`*.${customDomain.domainName}`],
					validation: acm.CertificateValidation.fromDns(
						route53.HostedZone.fromHostedZoneAttributes(
							this,
							'CertificateHostedZone',
							{
								hostedZoneId: customDomain.hostedZoneId,
								zoneName: customDomain.domainName,
							},
						),
					),
				})

				console.log(
					`✅ Created new ACM certificate for ${customDomain.domainName} and *.${customDomain.domainName}`,
				)
			}

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
				certificates: [certificate],
				defaultAction: elbv2.ListenerAction.forward([this.targetGroup]),
			})

			// Add CORS headers using listener attributes
			// This approach works with CDK 2.212.0 and follows AWS best practices
			// For CORS, we can only set ONE origin in Access-Control-Allow-Origin
			// Use the frontend origin since that's what needs to access the API
			// Don't use Parameter Store value as it may contain multiple origins or wrong format
			const corsOrigin = `https://pr-${environmentName.replace('pr-', '')}.macro-ai.russoakham.dev`

			// Create CfnListener to add CORS headers as listener attributes
			const cfnListener = this.httpsListener.node
				.defaultChild as elbv2.CfnListener
			cfnListener.addPropertyOverride('ListenerAttributes', [
				{
					Key: 'routing.http.response.access_control_allow_origin.header_value',
					Value: corsOrigin,
				},
				{
					Key: 'routing.http.response.access_control_allow_methods.header_value',
					Value: 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
				},
				{
					Key: 'routing.http.response.access_control_allow_headers.header_value',
					Value:
						'Content-Type, Authorization, X-Requested-With, Accept, Origin',
				},
				{
					Key: 'routing.http.response.access_control_allow_credentials.header_value',
					Value: 'true',
				},
				{
					Key: 'routing.http.response.access_control_expose_headers.header_value',
					Value:
						'Content-Length, X-Requested-With, X-Total-Count, X-Page-Count',
				},
				{
					Key: 'routing.http.response.access_control_max_age.header_value',
					Value: '86400',
				},
			])

			console.log(
				`✅ Added CORS headers via listener attributes for ${environmentName}`,
			)

			// Create DNS records for custom domain if configured
			if (customDomain.domainName && environmentName.startsWith('pr-')) {
				// Extract PR number from environment name (e.g., "pr-56" -> "56")
				const prNumber = environmentName.replace('pr-', '')

				// Import the hosted zone
				const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
					this,
					'CustomDomainHostedZone',
					{
						hostedZoneId: customDomain.hostedZoneId,
						zoneName: customDomain.domainName,
					},
				)

				// Create A record for API subdomain pointing to load balancer
				const apiSubdomainName =
					customDomain.apiSubdomain ?? `pr-${prNumber}-api`
				const apiSubdomain = `${apiSubdomainName}.${customDomain.domainName}`
				new route53.ARecord(this, 'ApiSubdomainRecord', {
					zone: hostedZone,
					recordName: apiSubdomainName,
					target: route53.RecordTarget.fromAlias(
						new targets.LoadBalancerTarget(this.loadBalancer),
					),
					ttl: cdk.Duration.minutes(5),
				})

				console.log(
					`✅ Created DNS record for API subdomain: ${apiSubdomain} -> ${this.loadBalancer.loadBalancerDnsName}`,
				)

				// Create A record for frontend subdomain pointing to load balancer (optional)
				if (customDomain.createFrontendSubdomain !== false) {
					const frontendSubdomain = `pr-${prNumber}.${customDomain.domainName}`
					new route53.ARecord(this, 'FrontendSubdomainRecord', {
						zone: hostedZone,
						recordName: `pr-${prNumber}`,
						target: route53.RecordTarget.fromAlias(
							new targets.LoadBalancerTarget(this.loadBalancer),
						),
						ttl: cdk.Duration.minutes(5),
					})

					console.log(
						`✅ Created DNS record for frontend subdomain: ${frontendSubdomain} -> ${this.loadBalancer.loadBalancerDnsName}`,
					)
				} else {
					console.log(
						`ℹ️ Skipping frontend subdomain creation - leaving pr-${prNumber}.${customDomain.domainName} available for CloudFront`,
					)
				}
			}
		} else {
			// No custom domain configured - HTTP only
			console.log(
				'ℹ️ No custom domain configured - load balancer will be HTTP only',
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
