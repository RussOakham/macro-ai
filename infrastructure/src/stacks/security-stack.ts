import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as sns from 'aws-cdk-lib/aws-sns'
import { Construct } from 'constructs'
import { WafSecurityConstruct } from '../constructs/waf-security-construct'
import { SecurityHeadersConstruct } from '../constructs/security-headers-construct'
import { SslCertificateConstruct } from '../constructs/ssl-certificate-construct'
import { HttpsEnforcementConstruct } from '../constructs/https-enforcement-construct'
import { RateLimitingConstruct } from '../constructs/rate-limiting-construct'
import { DDoSProtectionConstruct } from '../constructs/ddos-protection-construct'
import { SecurityMonitoringConstruct } from '../constructs/security-monitoring-construct'

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

	/**
	 * SSL certificate configuration
	 */
	sslCertificate?: {
		domainName: string
		subjectAlternativeNames?: string[]
		enableDnsValidation?: boolean
		alertDaysBeforeExpiration?: number
	}

	/**
	 * HTTPS enforcement configuration
	 */
	httpsEnforcement?: {
		enableHttpRedirect?: boolean
		httpPort?: number
		httpsPort?: number
		sslPolicy?: elbv2.SslPolicy
		enableDetailedMonitoring?: boolean
	}
}

export class SecurityStack extends cdk.Stack {
	public readonly wafConstruct?: WafSecurityConstruct
	public readonly securityHeadersConstruct?: SecurityHeadersConstruct
	public readonly sslCertificateConstruct?: SslCertificateConstruct
	public readonly httpsEnforcementConstruct?: HttpsEnforcementConstruct
	public readonly rateLimitingConstruct?: RateLimitingConstruct
	public readonly ddosProtectionConstruct?: DDoSProtectionConstruct
	public readonly securityMonitoringConstruct?: SecurityMonitoringConstruct
	public readonly securityAlarmTopic: sns.Topic
	public readonly webAclArn?: string
	public readonly certificateArn?: string

	constructor(scope: Construct, id: string, props: SecurityStackProps) {
		super(scope, id, props)

		const {
			environmentName,
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			vpc,
			loadBalancer,
			cloudFrontDistribution,
			hostedZone,
			enableWaf = true,
			enableSecurityHeaders = true,
			enableSslEnforcement = true,
			rateLimitThreshold = 2000,
			enableGeoBlocking = environmentName === 'production',
			blockedCountries = ['CN', 'RU', 'KP'],
			sslCertificate,
			httpsEnforcement,
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

				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const distributionConfig = cfnDistribution.distributionConfig as any
				if (distributionConfig?.defaultCacheBehavior) {
					distributionConfig.defaultCacheBehavior.lambdaFunctionAssociations = [
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
		if (sslCertificate && hostedZone) {
			this.sslCertificateConstruct = new SslCertificateConstruct(
				this,
				'SslCertificate',
				{
					environmentName,
					domainName: sslCertificate.domainName,
					subjectAlternativeNames: sslCertificate.subjectAlternativeNames,
					hostedZone,
					enableDnsValidation: sslCertificate.enableDnsValidation ?? true,
					alertDaysBeforeExpiration:
						sslCertificate.alertDaysBeforeExpiration ?? 30,
				},
			)

			this.certificateArn = this.sslCertificateConstruct.getCertificateArn()
		}

		// HTTPS Enforcement
		if (enableSslEnforcement && loadBalancer && this.sslCertificateConstruct) {
			this.httpsEnforcementConstruct = new HttpsEnforcementConstruct(
				this,
				'HttpsEnforcement',
				{
					environmentName,
					loadBalancer,
					certificate: this.sslCertificateConstruct.getCertificate(),
					enableHttpRedirect: httpsEnforcement?.enableHttpRedirect ?? true,
					httpPort: httpsEnforcement?.httpPort ?? 80,
					httpsPort: httpsEnforcement?.httpsPort ?? 443,
					sslPolicy:
						httpsEnforcement?.sslPolicy ?? elbv2.SslPolicy.RECOMMENDED_TLS,
					enableDetailedMonitoring:
						httpsEnforcement?.enableDetailedMonitoring ?? true,
					healthCheck: {
						path: '/api/health',
						interval: cdk.Duration.seconds(30),
						timeout: cdk.Duration.seconds(5),
						healthyThresholdCount: 3,
						unhealthyThresholdCount: 2,
					},
				},
			)
		} else if (enableSslEnforcement && loadBalancer) {
			// Fallback SSL enforcement without custom certificate
			this.configureSslEnforcement(loadBalancer)
		}

		// Create shared SNS topic for security alerts
		this.securityAlarmTopic = new sns.Topic(this, 'SecurityAlarmTopic', {
			topicName: `${environmentName}-security-alerts`,
			displayName: `${environmentName} Security Alerts`,
		})

		// Create rate limiting construct
		this.rateLimitingConstruct = new RateLimitingConstruct(
			this,
			'RateLimiting',
			{
				environmentName,
				enableDetailedMonitoring: true,
				alarmTopic: this.securityAlarmTopic,
				rateLimiting: {
					generalLimit: 1000, // 1000 requests per 5 minutes per IP
					apiLimit: 500, // 500 API requests per 5 minutes per IP
					authLimit: 100, // 100 auth requests per 5 minutes per IP
					adminLimit: 200, // 200 admin requests per 5 minutes per IP
					burstLimit: 200, // 200 requests per minute per IP
					enableProgressiveLimiting: true,
					enableAdaptiveLimiting: true,
				},
				ddosProtection: {
					enabled: true,
					detectionThreshold: 50, // 50 requests per second per IP
					mitigationThreshold: 100, // 100 requests per second per IP
					enableGeoProtection: true,
					monitoredCountries: ['CN', 'RU', 'KP', 'IR', 'KP'],
					enableBotProtection: true,
				},
			},
		)

		// Associate rate limiting WebACL with Application Load Balancer
		if (loadBalancer) {
			this.rateLimitingConstruct.associateWithResource(
				loadBalancer.loadBalancerArn,
			)
		}

		// Create DDoS protection construct
		this.ddosProtectionConstruct = new DDoSProtectionConstruct(
			this,
			'DDoSProtection',
			{
				environmentName,
				alarmTopic: this.securityAlarmTopic,
				enableDetailedMonitoring: true,
				ddosProtection: {
					enabled: true,
					detectionThreshold: 50,
					mitigationThreshold: 100,
					enableGeoProtection: true,
					monitoredCountries: ['CN', 'RU', 'KP', 'IR', 'KP'],
					enableBotProtection: true,
					enableIpReputation: true,
					enableBehavioralAnalysis: true,
					enableAutoIpBlocking: true,
					ipBlockingDuration: 60,
				},
			},
		)

		// Create security monitoring construct
		this.securityMonitoringConstruct = new SecurityMonitoringConstruct(
			this,
			'SecurityMonitoring',
			{
				environmentName,
				alarmTopic: this.securityAlarmTopic,
				enableDetailedMonitoring: true,
				securityMonitoring: {
					enableThreatIntelligence: true,
					enableEventCorrelation: true,
					enableAutomatedResponse: true,
					enableComplianceMonitoring: true,
					enableVulnerabilityScanning: true,
					enableIncidentResponse: true,
				},
			},
		)

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

		// SSL Certificate outputs
		if (this.sslCertificateConstruct) {
			new cdk.CfnOutput(this, 'SslCertificateArn', {
				value: this.sslCertificateConstruct.getCertificateArn(),
				description: 'SSL Certificate ARN',
				exportName: `${environmentName}-ssl-certificate-arn`,
			})
		}

		// HTTPS Enforcement outputs
		if (this.httpsEnforcementConstruct) {
			new cdk.CfnOutput(this, 'HttpsListenerArn', {
				value: this.httpsEnforcementConstruct.getHttpsListener().listenerArn,
				description: 'HTTPS Application Listener ARN',
				exportName: `${environmentName}-https-listener-arn`,
			})

			new cdk.CfnOutput(this, 'HttpsTargetGroupArn', {
				value:
					this.httpsEnforcementConstruct.getHttpsTargetGroup().targetGroupArn,
				description: 'HTTPS Target Group ARN',
				exportName: `${environmentName}-https-target-group-arn`,
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

		// Rate limiting outputs
		if (this.rateLimitingConstruct) {
			new cdk.CfnOutput(this, 'RateLimitingWebAclArn', {
				value: this.rateLimitingConstruct.getWebAclArn(),
				description: 'Rate limiting WebACL ARN',
				exportName: `${environmentName}-rate-limiting-web-acl-arn`,
			})

			new cdk.CfnOutput(this, 'RateLimitingLogGroupArn', {
				value: this.rateLimitingConstruct.getLogGroupArn(),
				description: 'Rate limiting log group ARN',
				exportName: `${environmentName}-rate-limiting-log-group-arn`,
			})
		}

		// DDoS protection outputs
		if (this.ddosProtectionConstruct) {
			new cdk.CfnOutput(this, 'DDoSProtectionLogGroupArn', {
				value: this.ddosProtectionConstruct.getLogGroupArn(),
				description: 'DDoS protection log group ARN',
				exportName: `${environmentName}-ddos-protection-log-group-arn`,
			})

			if (this.ddosProtectionConstruct.getDDoSAnalysisLambdaArn()) {
				new cdk.CfnOutput(this, 'DDoSAnalysisLambdaArn', {
					value: this.ddosProtectionConstruct.getDDoSAnalysisLambdaArn()!,
					description: 'DDoS analysis Lambda function ARN',
					exportName: `${environmentName}-ddos-analysis-lambda-arn`,
				})
			}
		}

		// Security monitoring outputs
		if (this.securityMonitoringConstruct) {
			new cdk.CfnOutput(this, 'SecurityMonitoringLogGroupArn', {
				value: this.securityMonitoringConstruct.getLogGroupArn(),
				description: 'Security monitoring log group ARN',
				exportName: `${environmentName}-security-monitoring-log-group-arn`,
			})

			if (this.securityMonitoringConstruct.getSecurityAnalysisLambdaArn()) {
				new cdk.CfnOutput(this, 'SecurityAnalysisLambdaArn', {
					value:
						this.securityMonitoringConstruct.getSecurityAnalysisLambdaArn()!,
					description: 'Security analysis Lambda function ARN',
					exportName: `${environmentName}-security-analysis-lambda-arn`,
				})
			}

			if (this.securityMonitoringConstruct.getIncidentResponseLambdaArn()) {
				new cdk.CfnOutput(this, 'IncidentResponseLambdaArn', {
					value:
						this.securityMonitoringConstruct.getIncidentResponseLambdaArn()!,
					description: 'Incident response Lambda function ARN',
					exportName: `${environmentName}-incident-response-lambda-arn`,
				})
			}
		}

		// Security alarm topic output
		new cdk.CfnOutput(this, 'SecurityAlarmTopicArn', {
			value: this.securityAlarmTopic.topicArn,
			description: 'Security alarm SNS topic ARN',
			exportName: `${environmentName}-security-alarm-topic-arn`,
		})
	}
}
