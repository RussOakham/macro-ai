import * as cdk from 'aws-cdk-lib'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import { Construct } from 'constructs'

export interface HttpsEnforcementConstructProps {
	/**
	 * Environment name for resource naming
	 */
	environmentName: string

	/**
	 * Application Load Balancer to configure
	 */
	loadBalancer: elbv2.IApplicationLoadBalancer

	/**
	 * SSL certificate for HTTPS termination
	 */
	certificate: acm.ICertificate

	/**
	 * Target group for HTTP traffic (will be redirected to HTTPS)
	 */
	httpTargetGroup?: elbv2.ITargetGroup

	/**
	 * Target group for HTTPS traffic
	 */
	httpsTargetGroup?: elbv2.ITargetGroup

	/**
	 * Enable HTTP to HTTPS redirect
	 */
	enableHttpRedirect?: boolean

	/**
	 * HTTP port (default: 80)
	 */
	httpPort?: number

	/**
	 * HTTPS port (default: 443)
	 */
	httpsPort?: number

	/**
	 * SSL policy for HTTPS listener
	 */
	sslPolicy?: string

	/**
	 * Health check configuration
	 */
	healthCheck?: {
		path: string
		interval: cdk.Duration
		timeout: cdk.Duration
		healthyThresholdCount: number
		unhealthyThresholdCount: number
	}

	/**
	 * Enable detailed monitoring
	 */
	enableDetailedMonitoring?: boolean
}

export class HttpsEnforcementConstruct extends Construct {
	public readonly httpsListener: elbv2.ApplicationListener
	public readonly httpListener?: elbv2.ApplicationListener
	public readonly httpsTargetGroup: elbv2.ApplicationTargetGroup
	public readonly httpTargetGroup?: elbv2.ApplicationTargetGroup
	public readonly alarms: cloudwatch.Alarm[]

	constructor(
		scope: Construct,
		id: string,
		props: HttpsEnforcementConstructProps,
	) {
		super(scope, id)

		const {
			environmentName,
			loadBalancer,
			certificate,
			httpTargetGroup: providedHttpTargetGroup,
			httpsTargetGroup: providedHttpsTargetGroup,
			enableHttpRedirect = true,
			httpPort = 80,
			httpsPort = 443,
			sslPolicy = 'ELBSecurityPolicy-TLS13-1-2-2021-06',
			enableDetailedMonitoring = true,
		} = props

		this.alarms = []

		// Create target groups if not provided
		this.httpsTargetGroup =
			providedHttpsTargetGroup || this.createHttpsTargetGroup(props)

		if (enableHttpRedirect) {
			this.httpTargetGroup =
				providedHttpTargetGroup || this.createHttpTargetGroup(props)
		}

		// Create HTTPS listener
		this.httpsListener = this.createHttpsListener(
			loadBalancer,
			certificate,
			this.httpsTargetGroup,
			httpsPort,
			sslPolicy,
		)

		// Create HTTP listener with redirect (if enabled)
		if (enableHttpRedirect) {
			this.httpListener = this.createHttpRedirectListener(
				loadBalancer,
				this.httpTargetGroup!,
				httpPort,
			)
		}

		// Create monitoring and alarms
		if (enableDetailedMonitoring) {
			this.createMonitoringAlarms(environmentName)
		}

		// Create outputs
		this.createOutputs(environmentName)
	}

	private createHttpsTargetGroup(
		props: HttpsEnforcementConstructProps,
	): elbv2.ApplicationTargetGroup {
		const { healthCheck } = props

		return new elbv2.ApplicationTargetGroup(this, 'HttpsTargetGroup', {
			targetGroupName: `${props.environmentName}-https-targets`,
			protocol: elbv2.ApplicationProtocol.HTTP,
			port: 3040, // Application port
			vpc: props.loadBalancer.vpc,
			healthCheck: healthCheck
				? {
						path: healthCheck.path,
						interval: healthCheck.interval,
						timeout: healthCheck.timeout,
						healthyThresholdCount: healthCheck.healthyThresholdCount,
						unhealthyThresholdCount: healthCheck.unhealthyThresholdCount,
					}
				: {
						path: '/api/health',
						interval: cdk.Duration.seconds(30),
						timeout: cdk.Duration.seconds(5),
						healthyThresholdCount: 3,
						unhealthyThresholdCount: 2,
					},
			targetType: elbv2.TargetType.IP, // For Fargate
		})
	}

	private createHttpTargetGroup(
		props: HttpsEnforcementConstructProps,
	): elbv2.ApplicationTargetGroup {
		return new elbv2.ApplicationTargetGroup(this, 'HttpTargetGroup', {
			targetGroupName: `${props.environmentName}-http-redirect-targets`,
			protocol: elbv2.ApplicationProtocol.HTTP,
			port: 3040,
			vpc: props.loadBalancer.vpc,
			targetType: elbv2.TargetType.IP,
		})
	}

	private createHttpsListener(
		loadBalancer: elbv2.IApplicationLoadBalancer,
		certificate: acm.ICertificate,
		targetGroup: elbv2.IApplicationTargetGroup,
		httpsPort: number,
		sslPolicy: string,
	): elbv2.ApplicationListener {
		const listener = new elbv2.ApplicationListener(this, 'HttpsListener', {
			loadBalancer,
			port: httpsPort,
			protocol: elbv2.ApplicationProtocol.HTTPS,
			certificates: [certificate],
			sslPolicy,
			defaultAction: elbv2.ListenerAction.forward([targetGroup]),
		})

		// Add default action to forward to target group
		return listener
	}

	private createHttpRedirectListener(
		loadBalancer: elbv2.IApplicationLoadBalancer,
		targetGroup: elbv2.IApplicationTargetGroup,
		httpPort: number,
	): elbv2.ApplicationListener {
		const listener = new elbv2.ApplicationListener(this, 'HttpListener', {
			loadBalancer,
			port: httpPort,
			protocol: elbv2.ApplicationProtocol.HTTP,
			defaultAction: elbv2.ListenerAction.redirect({
				protocol: 'HTTPS',
				port: '443',
				permanent: true, // 301 redirect
			}),
		})

		return listener
	}

	private createMonitoringAlarms(environmentName: string): void {
		// HTTPS listener unhealthy targets alarm
		const unhealthyHostsAlarm = new cloudwatch.Alarm(
			this,
			'UnhealthyHostsAlarm',
			{
				alarmName: `${environmentName}-https-unhealthy-hosts`,
				alarmDescription:
					'High number of unhealthy targets in HTTPS target group',
				metric: new cloudwatch.Metric({
					namespace: 'AWS/ApplicationELB',
					metricName: 'UnHealthyHostCount',
					dimensionsMap: {
						LoadBalancer:
							this.httpsTargetGroup.loadBalancerAttached
								?.loadBalancerFullName || '',
						TargetGroup: this.httpsTargetGroup.targetGroupFullName,
					},
					statistic: 'Maximum',
				}),
				threshold: 1,
				evaluationPeriods: 3,
				comparisonOperator:
					cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
				treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
			},
		)

		// SSL handshake errors alarm
		const sslHandshakeErrorsAlarm = new cloudwatch.Alarm(
			this,
			'SslHandshakeErrorsAlarm',
			{
				alarmName: `${environmentName}-ssl-handshake-errors`,
				alarmDescription: 'SSL/TLS handshake errors detected',
				metric: new cloudwatch.Metric({
					namespace: 'AWS/ApplicationELB',
					metricName: 'ClientTLSNegotiationErrorCount',
					dimensionsMap: {
						LoadBalancer:
							this.httpsTargetGroup.loadBalancerAttached
								?.loadBalancerFullName || '',
					},
					statistic: 'Sum',
				}),
				threshold: 10,
				evaluationPeriods: 5,
				comparisonOperator:
					cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
				treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
			},
		)

		// HTTP to HTTPS redirect rate alarm
		const redirectRateAlarm = new cloudwatch.Alarm(this, 'RedirectRateAlarm', {
			alarmName: `${environmentName}-http-redirect-rate`,
			alarmDescription:
				'High rate of HTTP to HTTPS redirects (possible security scanning)',
			metric: new cloudwatch.Metric({
				namespace: 'AWS/ApplicationELB',
				metricName: 'HTTP_Redirect_Count',
				dimensionsMap: {
					LoadBalancer:
						this.httpsTargetGroup.loadBalancerAttached?.loadBalancerFullName ||
						'',
				},
				statistic: 'Sum',
			}),
			threshold: 1000,
			evaluationPeriods: 5,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		})

		this.alarms.push(
			unhealthyHostsAlarm,
			sslHandshakeErrorsAlarm,
			redirectRateAlarm,
		)
	}

	private createOutputs(environmentName: string): void {
		new cdk.CfnOutput(this, 'HttpsListenerArn', {
			value: this.httpsListener.listenerArn,
			description: 'HTTPS Application Listener ARN',
			exportName: `${environmentName}-https-listener-arn`,
		})

		if (this.httpListener) {
			new cdk.CfnOutput(this, 'HttpListenerArn', {
				value: this.httpListener.listenerArn,
				description: 'HTTP Application Listener ARN',
				exportName: `${environmentName}-http-listener-arn`,
			})
		}

		new cdk.CfnOutput(this, 'HttpsTargetGroupArn', {
			value: this.httpsTargetGroup.targetGroupArn,
			description: 'HTTPS Target Group ARN',
			exportName: `${environmentName}-https-target-group-arn`,
		})

		if (this.httpTargetGroup) {
			new cdk.CfnOutput(this, 'HttpTargetGroupArn', {
				value: this.httpTargetGroup.targetGroupArn,
				description: 'HTTP Redirect Target Group ARN',
				exportName: `${environmentName}-http-target-group-arn`,
			})
		}

		new cdk.CfnOutput(this, 'HttpsPort', {
			value: this.httpsListener.connections.defaultPort?.toString() || '443',
			description: 'HTTPS listener port',
			exportName: `${environmentName}-https-port`,
		})

		new cdk.CfnOutput(this, 'HttpRedirectEnabled', {
			value: this.httpListener ? 'true' : 'false',
			description: 'HTTP to HTTPS redirect enabled',
			exportName: `${environmentName}-http-redirect-enabled`,
		})
	}

	/**
	 * Get the HTTPS listener for external use
	 */
	public getHttpsListener(): elbv2.ApplicationListener {
		return this.httpsListener
	}

	/**
	 * Get the HTTP listener for external use
	 */
	public getHttpListener(): elbv2.ApplicationListener | undefined {
		return this.httpListener
	}

	/**
	 * Get the HTTPS target group for external use
	 */
	public getHttpsTargetGroup(): elbv2.ApplicationTargetGroup {
		return this.httpsTargetGroup
	}

	/**
	 * Get the HTTP target group for external use
	 */
	public getHttpTargetGroup(): elbv2.ApplicationTargetGroup | undefined {
		return this.httpTargetGroup
	}

	/**
	 * Add custom listener rules for advanced routing
	 */
	public addListenerRule(
		id: string,
		priority: number,
		conditions: elbv2.ListenerCondition[],
		action: elbv2.ListenerAction,
	): elbv2.ApplicationListenerRule {
		return new elbv2.ApplicationListenerRule(this, id, {
			listener: this.httpsListener,
			priority,
			conditions,
			action,
		})
	}
}
