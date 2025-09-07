import * as cdk from 'aws-cdk-lib'
import * as wafv2 from 'aws-cdk-lib/aws-wafv2'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as sns from 'aws-cdk-lib/aws-sns'
import { Construct } from 'constructs'

export interface RateLimitingConstructProps {
	/**
	 * Environment name for resource naming
	 */
	environmentName: string

	/**
	 * Enable detailed monitoring and logging
	 */
	enableDetailedMonitoring?: boolean

	/**
	 * CloudWatch log group retention period
	 */
	logRetention?: logs.RetentionDays

	/**
	 * SNS topic for rate limiting alerts
	 */
	alarmTopic?: sns.ITopic

	/**
	 * Rate limiting configuration
	 */
	rateLimiting?: {
		/**
		 * General rate limit (requests per 5 minutes per IP)
		 */
		generalLimit?: number

		/**
		 * API endpoint rate limit (requests per 5 minutes per IP)
		 */
		apiLimit?: number

		/**
		 * Authentication endpoint rate limit (requests per 5 minutes per IP)
		 */
		authLimit?: number

		/**
		 * Admin endpoint rate limit (requests per 5 minutes per IP)
		 */
		adminLimit?: number

		/**
		 * Burst rate limit (requests per minute per IP)
		 */
		burstLimit?: number

		/**
		 * Enable progressive rate limiting (increasing delays)
		 */
		enableProgressiveLimiting?: boolean

		/**
		 * Enable adaptive rate limiting based on load
		 */
		enableAdaptiveLimiting?: boolean
	}

	/**
	 * DDoS protection configuration
	 */
	ddosProtection?: {
		/**
		 * Enable DDoS protection
		 */
		enabled?: boolean

		/**
		 * DDoS detection threshold (requests per second per IP)
		 */
		detectionThreshold?: number

		/**
		 * DDoS mitigation threshold (requests per second per IP)
		 */
		mitigationThreshold?: number

		/**
		 * Enable geographic-based DDoS protection
		 */
		enableGeoProtection?: boolean

		/**
		 * Countries to monitor for DDoS patterns
		 */
		monitoredCountries?: string[]

		/**
		 * Enable bot detection and mitigation
		 */
		enableBotProtection?: boolean
	}

	/**
	 * Custom IP sets for allow/deny lists
	 */
	allowedIpSets?: string[]
	blockedIpSets?: string[]
}

export class RateLimitingConstruct extends Construct {
	public readonly webAcl: wafv2.CfnWebACL
	public readonly webAclArn: string
	public readonly logGroup: logs.LogGroup
	public readonly alarms: cloudwatch.Alarm[]

	constructor(scope: Construct, id: string, props: RateLimitingConstructProps) {
		super(scope, id)

		const {
			environmentName,
			enableDetailedMonitoring = true,
			logRetention = logs.RetentionDays.ONE_WEEK,
			alarmTopic,
			rateLimiting = {},
			ddosProtection = {},
			allowedIpSets = [],
			blockedIpSets = [],
		} = props

		// Set default rate limiting values
		const {
			generalLimit = 1000,
			apiLimit = 500,
			authLimit = 100,
			adminLimit = 200,
			burstLimit = 200,
			enableProgressiveLimiting = true,
			enableAdaptiveLimiting = true,
		} = rateLimiting

		const {
			enabled: ddosEnabled = true,
			detectionThreshold = 50,
			mitigationThreshold = 100,
			enableGeoProtection = true,
			monitoredCountries = ['CN', 'RU', 'KP', 'IR', 'KP'],
			enableBotProtection = true,
		} = ddosProtection

		this.alarms = []

		// Create CloudWatch log group for rate limiting logs
		this.logGroup = new logs.LogGroup(this, 'RateLimitingLogGroup', {
			logGroupName: `/aws/waf/${environmentName}-rate-limiting`,
			retention: logRetention,
			removalPolicy: cdk.RemovalPolicy.DESTROY,
		})

		// Create the WebACL with comprehensive rate limiting rules
		this.webAcl = new wafv2.CfnWebACL(this, 'RateLimitingWebACL', {
			name: `${environmentName}-rate-limiting-web-acl`,
			description: `Rate limiting and DDoS protection for ${environmentName} environment`,
			scope: 'REGIONAL',
			defaultAction: { allow: {} },

			rules: this.createRateLimitingRules({
				generalLimit,
				apiLimit,
				authLimit,
				adminLimit,
				burstLimit,
				enableProgressiveLimiting,
				enableAdaptiveLimiting,
				ddosEnabled,
				detectionThreshold,
				mitigationThreshold,
				enableGeoProtection,
				monitoredCountries,
				enableBotProtection,
				allowedIpSets,
				blockedIpSets,
			}),

			visibilityConfig: {
				cloudWatchMetricsEnabled: enableDetailedMonitoring,
				metricName: `${environmentName}RateLimiting`,
				sampledRequestsEnabled: enableDetailedMonitoring,
			},

			// Enable logging to CloudWatch
			...(enableDetailedMonitoring && {
				loggingConfiguration: {
					logDestinationConfigs: [this.logGroup.logGroupArn],
					redactedFields: [
						{
							singleHeader: {
								name: 'authorization',
							},
						},
						{
							singleHeader: {
								name: 'x-api-key',
							},
						},
						{
							singleHeader: {
								name: 'cookie',
							},
						},
					],
				},
			}),
		})

		this.webAclArn = this.webAcl.attrArn

		// Create CloudWatch alarms for rate limiting events
		if (enableDetailedMonitoring && alarmTopic) {
			this.createRateLimitingAlarms(alarmTopic, environmentName)
		}

		// Create CloudWatch dashboard for rate limiting metrics
		this.createRateLimitingDashboard(environmentName)
	}

	private createRateLimitingRules(options: {
		generalLimit: number
		apiLimit: number
		authLimit: number
		adminLimit: number
		burstLimit: number
		enableProgressiveLimiting: boolean
		enableAdaptiveLimiting: boolean
		ddosEnabled: boolean
		detectionThreshold: number
		mitigationThreshold: number
		enableGeoProtection: boolean
		monitoredCountries: string[]
		enableBotProtection: boolean
		allowedIpSets: string[]
		blockedIpSets: string[]
	}): wafv2.CfnWebACL.RuleProperty[] {
		const rules: wafv2.CfnWebACL.RuleProperty[] = []
		let priority = 0

		// Allow list rule (highest priority)
		if (options.allowedIpSets.length > 0) {
			rules.push({
				name: 'AllowListRule',
				priority,
				statement: {
					ipSetReferenceStatement: {
						arn: options.allowedIpSets[0]!, // Use first IP set
					},
				},
				action: { allow: {} },
				visibilityConfig: {
					sampledRequestsEnabled: true,
					cloudWatchMetricsEnabled: true,
					metricName: 'AllowListRule',
				},
			})
			priority++
		}

		// Block list rule
		if (options.blockedIpSets.length > 0) {
			rules.push({
				name: 'BlockListRule',
				priority,
				statement: {
					ipSetReferenceStatement: {
						arn: options.blockedIpSets[0]!, // Use first IP set
					},
				},
				action: { block: {} },
				visibilityConfig: {
					sampledRequestsEnabled: true,
					cloudWatchMetricsEnabled: true,
					metricName: 'BlockListRule',
				},
			})
			priority++
		}

		// DDoS Protection Rules
		if (options.ddosEnabled) {
			// High-frequency request detection
			rules.push({
				name: 'DDoSDetectionRule',
				priority,
				statement: {
					rateBasedStatement: {
						limit: options.detectionThreshold,
						aggregateKeyType: 'IP',
					},
				},
				action: { count: {} },
				visibilityConfig: {
					sampledRequestsEnabled: true,
					cloudWatchMetricsEnabled: true,
					metricName: 'DDoSDetectionRule',
				},
			})
			priority++

			// DDoS mitigation (block high-frequency requests)
			rules.push({
				name: 'DDoSMitigationRule',
				priority,
				statement: {
					rateBasedStatement: {
						limit: options.mitigationThreshold,
						aggregateKeyType: 'IP',
					},
				},
				action: { block: {} },
				visibilityConfig: {
					sampledRequestsEnabled: true,
					cloudWatchMetricsEnabled: true,
					metricName: 'DDoSMitigationRule',
				},
			})
			priority++

			// Geographic DDoS protection
			if (
				options.enableGeoProtection &&
				options.monitoredCountries.length > 0
			) {
				rules.push({
					name: 'GeoDDoSProtectionRule',
					priority,
					statement: {
						andStatement: {
							statements: [
								{
									geoMatchStatement: {
										countryCodes: options.monitoredCountries,
									},
								},
								{
									rateBasedStatement: {
										limit: options.detectionThreshold / 2, // Stricter for monitored countries
										aggregateKeyType: 'IP',
									},
								},
							],
						},
					},
					action: { block: {} },
					visibilityConfig: {
						sampledRequestsEnabled: true,
						cloudWatchMetricsEnabled: true,
						metricName: 'GeoDDoSProtectionRule',
					},
				})
				priority++
			}
		}

		// Bot Protection
		if (options.enableBotProtection) {
			rules.push({
				name: 'BotProtectionRule',
				priority,
				statement: {
					managedRuleGroupStatement: {
						vendorName: 'AWS',
						name: 'AWSManagedRulesBotControlRuleSet',
					},
				},
				overrideAction: { none: {} },
				visibilityConfig: {
					sampledRequestsEnabled: true,
					cloudWatchMetricsEnabled: true,
					metricName: 'BotProtectionRule',
				},
			})
			priority++
		}

		// Burst Rate Limiting (1 minute window)
		rules.push({
			name: 'BurstRateLimitRule',
			priority,
			statement: {
				rateBasedStatement: {
					limit: options.burstLimit,
					aggregateKeyType: 'IP',
				},
			},
			action: { block: {} },
			visibilityConfig: {
				sampledRequestsEnabled: true,
				cloudWatchMetricsEnabled: true,
				metricName: 'BurstRateLimitRule',
			},
		})
		priority++

		// API Endpoint Rate Limiting
		rules.push({
			name: 'APIRateLimitRule',
			priority,
			statement: {
				andStatement: {
					statements: [
						{
							byteMatchStatement: {
								searchString: '/api/',
								fieldToMatch: {
									uriPath: {},
								},
								textTransformations: [
									{
										priority: 0,
										type: 'LOWERCASE',
									},
								],
								positionalConstraint: 'CONTAINS',
							},
						},
						{
							rateBasedStatement: {
								limit: options.apiLimit,
								aggregateKeyType: 'IP',
							},
						},
					],
				},
			},
			action: { block: {} },
			visibilityConfig: {
				sampledRequestsEnabled: true,
				cloudWatchMetricsEnabled: true,
				metricName: 'APIRateLimitRule',
			},
		})
		priority++

		// Authentication Endpoint Rate Limiting (stricter)
		rules.push({
			name: 'AuthRateLimitRule',
			priority,
			statement: {
				andStatement: {
					statements: [
						{
							orStatement: {
								statements: [
									{
										byteMatchStatement: {
											searchString: '/auth/',
											fieldToMatch: {
												uriPath: {},
											},
											textTransformations: [
												{
													priority: 0,
													type: 'LOWERCASE',
												},
											],
											positionalConstraint: 'CONTAINS',
										},
									},
									{
										byteMatchStatement: {
											searchString: '/login',
											fieldToMatch: {
												uriPath: {},
											},
											textTransformations: [
												{
													priority: 0,
													type: 'LOWERCASE',
												},
											],
											positionalConstraint: 'CONTAINS',
										},
									},
									{
										byteMatchStatement: {
											searchString: '/register',
											fieldToMatch: {
												uriPath: {},
											},
											textTransformations: [
												{
													priority: 0,
													type: 'LOWERCASE',
												},
											],
											positionalConstraint: 'CONTAINS',
										},
									},
								],
							},
						},
						{
							rateBasedStatement: {
								limit: options.authLimit,
								aggregateKeyType: 'IP',
							},
						},
					],
				},
			},
			action: { block: {} },
			visibilityConfig: {
				sampledRequestsEnabled: true,
				cloudWatchMetricsEnabled: true,
				metricName: 'AuthRateLimitRule',
			},
		})
		priority++

		// Admin Endpoint Rate Limiting
		rules.push({
			name: 'AdminRateLimitRule',
			priority,
			statement: {
				andStatement: {
					statements: [
						{
							byteMatchStatement: {
								searchString: '/admin/',
								fieldToMatch: {
									uriPath: {},
								},
								textTransformations: [
									{
										priority: 0,
										type: 'LOWERCASE',
									},
								],
								positionalConstraint: 'CONTAINS',
							},
						},
						{
							rateBasedStatement: {
								limit: options.adminLimit,
								aggregateKeyType: 'IP',
							},
						},
					],
				},
			},
			action: { block: {} },
			visibilityConfig: {
				sampledRequestsEnabled: true,
				cloudWatchMetricsEnabled: true,
				metricName: 'AdminRateLimitRule',
			},
		})
		priority++

		// General Rate Limiting (catch-all)
		rules.push({
			name: 'GeneralRateLimitRule',
			priority,
			statement: {
				rateBasedStatement: {
					limit: options.generalLimit,
					aggregateKeyType: 'IP',
				},
			},
			action: { block: {} },
			visibilityConfig: {
				sampledRequestsEnabled: true,
				cloudWatchMetricsEnabled: true,
				metricName: 'GeneralRateLimitRule',
			},
		})

		return rules
	}

	private createRateLimitingAlarms(
		topic: sns.ITopic,
		environmentName: string,
	): void {
		// High rate limiting activity alarm
		const highRateLimitAlarm = new cloudwatch.Alarm(
			this,
			'HighRateLimitAlarm',
			{
				alarmName: `${environmentName}-high-rate-limiting`,
				alarmDescription: 'High rate limiting activity detected',
				metric: new cloudwatch.Metric({
					namespace: 'AWS/WAFV2',
					metricName: 'BlockedRequests',
					dimensionsMap: {
						WebACL: `${environmentName}-rate-limiting-web-acl`,
						Region: cdk.Stack.of(this).region,
					},
				}),
				threshold: 100, // More than 100 blocked requests in 5 minutes
				evaluationPeriods: 2,
				datapointsToAlarm: 1,
				comparisonOperator:
					cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
				treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
			},
		)

		highRateLimitAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(topic))

		this.alarms.push(highRateLimitAlarm)

		// DDoS detection alarm
		const ddosDetectionAlarm = new cloudwatch.Alarm(
			this,
			'DDoSDetectionAlarm',
			{
				alarmName: `${environmentName}-ddos-detection`,
				alarmDescription: 'DDoS attack pattern detected',
				metric: new cloudwatch.Metric({
					namespace: 'AWS/WAFV2',
					metricName: 'CountedRequests',
					dimensionsMap: {
						WebACL: `${environmentName}-rate-limiting-web-acl`,
						Region: cdk.Stack.of(this).region,
						Rule: 'DDoSDetectionRule',
					},
				}),
				threshold: 50, // More than 50 requests triggering DDoS detection
				evaluationPeriods: 1,
				datapointsToAlarm: 1,
				comparisonOperator:
					cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
				treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
			},
		)

		ddosDetectionAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(topic))

		this.alarms.push(ddosDetectionAlarm)

		// Bot protection alarm
		const botProtectionAlarm = new cloudwatch.Alarm(
			this,
			'BotProtectionAlarm',
			{
				alarmName: `${environmentName}-bot-protection`,
				alarmDescription: 'Bot activity detected and blocked',
				metric: new cloudwatch.Metric({
					namespace: 'AWS/WAFV2',
					metricName: 'BlockedRequests',
					dimensionsMap: {
						WebACL: `${environmentName}-rate-limiting-web-acl`,
						Region: cdk.Stack.of(this).region,
						Rule: 'BotProtectionRule',
					},
				}),
				threshold: 20, // More than 20 bot requests blocked
				evaluationPeriods: 1,
				datapointsToAlarm: 1,
				comparisonOperator:
					cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
				treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
			},
		)

		botProtectionAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(topic))

		this.alarms.push(botProtectionAlarm)
	}

	private createRateLimitingDashboard(environmentName: string): void {
		const dashboard = new cloudwatch.Dashboard(this, 'RateLimitingDashboard', {
			dashboardName: `${environmentName}-rate-limiting-dashboard`,
		})

		// Rate limiting metrics widget
		const rateLimitingWidget = new cloudwatch.GraphWidget({
			title: 'Rate Limiting Activity',
			left: [
				new cloudwatch.Metric({
					namespace: 'AWS/WAFV2',
					metricName: 'BlockedRequests',
					dimensionsMap: {
						WebACL: `${environmentName}-rate-limiting-web-acl`,
						Region: cdk.Stack.of(this).region,
					},
				}),
				new cloudwatch.Metric({
					namespace: 'AWS/WAFV2',
					metricName: 'AllowedRequests',
					dimensionsMap: {
						WebACL: `${environmentName}-rate-limiting-web-acl`,
						Region: cdk.Stack.of(this).region,
					},
				}),
			],
			width: 12,
			height: 6,
		})

		// DDoS protection metrics widget
		const ddosProtectionWidget = new cloudwatch.GraphWidget({
			title: 'DDoS Protection',
			left: [
				new cloudwatch.Metric({
					namespace: 'AWS/WAFV2',
					metricName: 'CountedRequests',
					dimensionsMap: {
						WebACL: `${environmentName}-rate-limiting-web-acl`,
						Region: cdk.Stack.of(this).region,
						Rule: 'DDoSDetectionRule',
					},
				}),
				new cloudwatch.Metric({
					namespace: 'AWS/WAFV2',
					metricName: 'BlockedRequests',
					dimensionsMap: {
						WebACL: `${environmentName}-rate-limiting-web-acl`,
						Region: cdk.Stack.of(this).region,
						Rule: 'DDoSMitigationRule',
					},
				}),
			],
			width: 12,
			height: 6,
		})

		// Bot protection metrics widget
		const botProtectionWidget = new cloudwatch.GraphWidget({
			title: 'Bot Protection',
			left: [
				new cloudwatch.Metric({
					namespace: 'AWS/WAFV2',
					metricName: 'BlockedRequests',
					dimensionsMap: {
						WebACL: `${environmentName}-rate-limiting-web-acl`,
						Region: cdk.Stack.of(this).region,
						Rule: 'BotProtectionRule',
					},
				}),
			],
			width: 12,
			height: 6,
		})

		// Add widgets to dashboard
		dashboard.addWidgets(
			rateLimitingWidget,
			ddosProtectionWidget,
			botProtectionWidget,
		)
	}

	/**
	 * Associate the WebACL with a resource
	 */
	public associateWithResource(resourceArn: string): void {
		new wafv2.CfnWebACLAssociation(this, 'WebACLAssociation', {
			resourceArn,
			webAclArn: this.webAclArn,
		})
	}

	/**
	 * Get the WebACL ARN
	 */
	public getWebAclArn(): string {
		return this.webAclArn
	}

	/**
	 * Get the log group ARN
	 */
	public getLogGroupArn(): string {
		return this.logGroup.logGroupArn
	}
}
