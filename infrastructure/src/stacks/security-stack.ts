import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import { Construct } from 'constructs'
import { WafSecurityConstruct } from '../constructs/waf-security-construct'
import { SecurityHeadersConstruct } from '../constructs/security-headers-construct'

export interface SecurityStackProps extends cdk.StackProps {
	/**
	 * Environment name
	 */
	environmentName: string

	/**
	 * VPC for security resources
	 */
	vpc: ec2.IVpc

	/**
	 * Application Load Balancer to protect
	 */
	loadBalancer?: elbv2.IApplicationLoadBalancer

	/**
	 * CloudFront distribution for edge security
	 */
	cloudFrontDistribution?: cloudfront.IDistribution

	/**
	 * Hosted zone for DNS configuration
	 */
	hostedZone?: route53.IHostedZone

	/**
	 * SSL certificate for HTTPS
	 */
	certificate?: acm.ICertificate

	/**
	 * Enable WAF protection
	 */
	enableWaf?: boolean

	/**
	 * Enable security headers
	 */
	enableSecurityHeaders?: boolean

	/**
	 * Enable SSL/TLS enforcement
	 */
	enableSslEnforcement?: boolean

	/**
	 * Custom domain name
	 */
	domainName?: string

	/**
	 * Rate limiting threshold
	 */
	rateLimitThreshold?: number

	/**
	 * Enable geo-blocking
	 */
	enableGeoBlocking?: boolean

	/**
	 * Countries to block
	 */
	blockedCountries?: string[]
}

export class SecurityStack extends cdk.Stack {
	public readonly wafConstruct?: WafSecurityConstruct
	public readonly securityHeadersConstruct?: SecurityHeadersConstruct
	public readonly webAclArn?: string

	constructor(scope: Construct, id: string, props: SecurityStackProps) {
		super(scope, id, props)

		const {
			environmentName,
			vpc,
			loadBalancer,
			cloudFrontDistribution,
			enableWaf = true,
			enableSecurityHeaders = true,
			enableSslEnforcement = true,
			rateLimitThreshold = 2000,
			enableGeoBlocking = environmentName === 'production',
			blockedCountries = ['CN', 'RU', 'KP'],
		} = props

		// Create WAF WebACL for regional protection
		if (enableWaf) {
			this.wafConstruct = new WafSecurityConstruct(this, 'WafSecurity', {
				environmentName,
				enableDetailedMonitoring: true,
				rateLimitThreshold,
				enableGeoBlocking,
				blockedCountries,
				enableSqlInjectionProtection: true,
				enableXssProtection: true,
				enableCommonAttackProtection: true,
			})

			this.webAclArn = this.wafConstruct.webAclArn

			// Associate WAF with Application Load Balancer
			if (loadBalancer) {
				this.wafConstruct.associateWithResource(loadBalancer.loadBalancerArn)
			}
		}

		// Create security headers Lambda@Edge function
		if (enableSecurityHeaders) {
			this.securityHeadersConstruct = new SecurityHeadersConstruct(
				this,
				'SecurityHeaders',
				{
					environmentName,
					enableDetailedLogging: true,
					customHeaders: {
						'X-Environment': environmentName,
						'X-Security-Policy': 'MacroAI-Security-v1.0',
					},
					contentSecurityPolicy: this.getContentSecurityPolicy(environmentName),
					corsAllowedOrigins: this.getCorsOrigins(environmentName),
					enableHsts: true,
					hstsMaxAge: 31536000, // 1 year
					enableXFrameOptions: true,
					xFrameOptionsValue: 'DENY',
				},
			)

			// Associate security headers with CloudFront distribution
			if (cloudFrontDistribution) {
				// Add Lambda@Edge function to CloudFront behaviors
				const distribution = cloudFrontDistribution as cloudfront.Distribution

				// Update the default behavior to include security headers
				const cfnDistribution = distribution.node
					.defaultChild as cloudfront.CfnDistribution

				if (cfnDistribution.distributionConfig?.defaultCacheBehavior) {
					cfnDistribution.distributionConfig.defaultCacheBehavior.lambdaFunctionAssociations =
						[
							{
								eventType: 'viewer-response',
								lambdaFunctionARN:
									this.securityHeadersConstruct.getLambdaFunctionArn(),
								includeBody: false,
							},
						]
				}
			}
		}

		// SSL/TLS Configuration
		if (enableSslEnforcement && loadBalancer) {
			this.configureSslEnforcement(loadBalancer)
		}

		// Create CloudWatch dashboard for security monitoring
		this.createSecurityDashboard(environmentName)

		// Output important values
		if (this.webAclArn) {
			new cdk.CfnOutput(this, 'WebAclArn', {
				value: this.webAclArn,
				description: 'WAF WebACL ARN',
				exportName: `${environmentName}-web-acl-arn`,
			})
		}

		if (this.securityHeadersConstruct) {
			new cdk.CfnOutput(this, 'SecurityHeadersFunctionArn', {
				value: this.securityHeadersConstruct.getLambdaFunctionArn(),
				description: 'Security Headers Lambda Function ARN',
				exportName: `${environmentName}-security-headers-arn`,
			})
		}
	}

	private getContentSecurityPolicy(environment: string): string {
		const basePolicy = [
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
			"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
			"font-src 'self' https://fonts.gstatic.com",
			"img-src 'self' data: https: blob:",
			"connect-src 'self'",
			"frame-ancestors 'none'",
			"base-uri 'self'",
			"form-action 'self'",
		]

		// Environment-specific additions
		if (environment === 'development') {
			basePolicy.push(
				"script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:*",
			)
			basePolicy.push("connect-src 'self' http://localhost:* ws://localhost:*")
		} else {
			basePolicy.push(
				"script-src 'self' 'unsafe-inline' https://*.macro-ai.com",
			)
			basePolicy.push(
				"connect-src 'self' https://api.macro-ai.com wss://*.macro-ai.com",
			)
		}

		return basePolicy.join('; ')
	}

	private getCorsOrigins(environment: string): string[] {
		switch (environment) {
			case 'production':
				return ['https://macro-ai.com', 'https://www.macro-ai.com']
			case 'staging':
				return ['https://staging.macro-ai.com']
			case 'development':
				return [
					'http://localhost:3000',
					'http://localhost:5173',
					'https://dev.macro-ai.com',
				]
			default:
				return ['https://macro-ai.com']
		}
	}

	private configureSslEnforcement(
		loadBalancer: elbv2.IApplicationLoadBalancer,
	): void {
		// Get existing listeners
		const listeners = loadBalancer.listeners || []

		// Configure HTTPS listener with security settings
		listeners.forEach((listener) => {
			if (listener.connections) {
				// Ensure SSL policies are configured
				const listenerNode = listener.node.defaultChild as elbv2.CfnListener

				if (listenerNode.protocol === 'HTTPS') {
					// Update SSL policy to use modern TLS
					listenerNode.sslPolicy = 'ELBSecurityPolicy-TLS13-1-2-2021-06'
				}
			}
		})
	}

	private createSecurityDashboard(environmentName: string): void {
		// Create a basic CloudWatch dashboard for security metrics
		// This would include WAF metrics, security headers metrics, etc.
		// Implementation would be similar to other monitoring dashboards in the project

		// For now, just create the dashboard structure
		const dashboardName = `${environmentName}-security-dashboard`

		new cdk.CfnOutput(this, 'SecurityDashboardName', {
			value: dashboardName,
			description: 'Security monitoring dashboard name',
			exportName: `${environmentName}-security-dashboard`,
		})
	}
}
