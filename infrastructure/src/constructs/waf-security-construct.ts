import * as cdk from 'aws-cdk-lib'
import * as wafv2 from 'aws-cdk-lib/aws-wafv2'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as logs from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'

export interface WafSecurityConstructProps {
	/**
	 * Environment name for resource naming
	 */
	environmentName: string

	/**
	 * Enable detailed monitoring and logging
	 */
	enableDetailedMonitoring?: boolean

	/**
	 * Custom IP sets for allow/deny lists
	 */
	allowedIpSets?: string[]

	/**
	 * Custom IP sets for blocking
	 */
	blockedIpSets?: string[]

	/**
	 * Rate limiting threshold (requests per 5 minutes)
	 */
	rateLimitThreshold?: number

	/**
	 * Enable geo-blocking for specific countries
	 */
	enableGeoBlocking?: boolean

	/**
	 * Countries to block (ISO country codes)
	 */
	blockedCountries?: string[]

	/**
	 * Enable SQL injection protection
	 */
	enableSqlInjectionProtection?: boolean

	/**
	 * Enable XSS protection
	 */
	enableXssProtection?: boolean

	/**
	 * Enable common attack patterns protection
	 */
	enableCommonAttackProtection?: boolean

	/**
	 * CloudWatch log group retention period
	 */
	logRetention?: logs.RetentionDays
}

export class WafSecurityConstruct extends Construct {
	public readonly webAcl: wafv2.CfnWebACL
	public readonly webAclArn: string
	public readonly logGroup: logs.LogGroup
	public readonly alarms: cloudwatch.Alarm[]

	constructor(scope: Construct, id: string, props: WafSecurityConstructProps) {
		super(scope, id)

		const {
			environmentName,
			enableDetailedMonitoring = true,
			rateLimitThreshold = 2000,
			enableGeoBlocking = false,
			blockedCountries = ['CN', 'RU', 'KP'], // Default blocked countries
			enableSqlInjectionProtection = true,
			enableXssProtection = true,
			enableCommonAttackProtection = true,
			logRetention = logs.RetentionDays.ONE_WEEK,
		} = props

		this.alarms = []

		// Create CloudWatch log group for WAF logs
		this.logGroup = new logs.LogGroup(this, 'WafLogGroup', {
			logGroupName: `/aws/waf/${environmentName}`,
			retention: logRetention,
			removalPolicy: cdk.RemovalPolicy.DESTROY,
		})

		// Create the WebACL with comprehensive rules
		this.webAcl = new wafv2.CfnWebACL(this, 'WebACL', {
			name: `${environmentName}-web-acl`,
			description: `Web Application Firewall for ${environmentName} environment`,
			scope: 'REGIONAL', // Use REGIONAL for ALB integration
			defaultAction: { allow: {} },

			rules: this.createWafRules({
				rateLimitThreshold,
				enableGeoBlocking,
				blockedCountries,
				enableSqlInjectionProtection,
				enableXssProtection,
				enableCommonAttackProtection,
			}),

			visibilityConfig: {
				cloudWatchMetricsEnabled: enableDetailedMonitoring,
				metricName: `${environmentName}WebACL`,
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
					],
				},
			}),
		})

		this.webAclArn = this.webAcl.attrArn

		// Create monitoring dashboard
		if (enableDetailedMonitoring) {
			this.createMonitoringDashboard(environmentName)
		}

		// Create alarms for security events
		if (enableDetailedMonitoring) {
			this.createSecurityAlarms(environmentName)
		}
	}

	private createWafRules(options: {
		rateLimitThreshold: number
		enableGeoBlocking: boolean
		blockedCountries: string[]
		enableSqlInjectionProtection: boolean
		enableXssProtection: boolean
		enableCommonAttackProtection: boolean
	}): wafv2.CfnWebACL.RuleProperty[] {
		const rules: wafv2.CfnWebACL.RuleProperty[] = []

		let priority = 1

		// AWS Managed Rules - Common Rule Set
		if (options.enableCommonAttackProtection) {
			rules.push({
				name: 'AWSManagedRulesCommonRuleSet',
				priority,
				statement: {
					managedRuleGroupStatement: {
						vendorName: 'AWS',
						name: 'AWSManagedRulesCommonRuleSet',
					},
				},
				overrideAction: { none: {} },
				visibilityConfig: {
					sampledRequestsEnabled: true,
					cloudWatchMetricsEnabled: true,
					metricName: 'AWSManagedRulesCommonRuleSet',
				},
			})
			priority++
		}

		// AWS Managed Rules - Known Bad Inputs
		rules.push({
			name: 'AWSManagedRulesKnownBadInputsRuleSet',
			priority,
			statement: {
				managedRuleGroupStatement: {
					vendorName: 'AWS',
					name: 'AWSManagedRulesKnownBadInputsRuleSet',
				},
			},
			overrideAction: { none: {} },
			visibilityConfig: {
				sampledRequestsEnabled: true,
				cloudWatchMetricsEnabled: true,
				metricName: 'AWSManagedRulesKnownBadInputsRuleSet',
			},
		})
		priority++

		// SQL Injection Protection
		if (options.enableSqlInjectionProtection) {
			rules.push({
				name: 'AWSManagedRulesSQLiRuleSet',
				priority,
				statement: {
					managedRuleGroupStatement: {
						vendorName: 'AWS',
						name: 'AWSManagedRulesSQLiRuleSet',
					},
				},
				overrideAction: { none: {} },
				visibilityConfig: {
					sampledRequestsEnabled: true,
					cloudWatchMetricsEnabled: true,
					metricName: 'AWSManagedRulesSQLiRuleSet',
				},
			})
			priority++
		}

		// XSS Protection
		if (options.enableXssProtection) {
			rules.push({
				name: 'AWSManagedRulesXSSRuleSet',
				priority,
				statement: {
					managedRuleGroupStatement: {
						vendorName: 'AWS',
						name: 'AWSManagedRulesXSSRuleSet',
					},
				},
				overrideAction: { none: {} },
				visibilityConfig: {
					sampledRequestsEnabled: true,
					cloudWatchMetricsEnabled: true,
					metricName: 'AWSManagedRulesXSSRuleSet',
				},
			})
			priority++
		}

		// Geo-blocking rule
		if (options.enableGeoBlocking && options.blockedCountries.length > 0) {
			rules.push({
				name: 'GeoBlockRule',
				priority,
				statement: {
					geoMatchStatement: {
						countryCodes: options.blockedCountries,
					},
				},
				action: { block: {} },
				visibilityConfig: {
					sampledRequestsEnabled: true,
					cloudWatchMetricsEnabled: true,
					metricName: 'GeoBlockRule',
				},
			})
			priority++
		}

		// Rate limiting rule
		rules.push({
			name: 'RateLimitRule',
			priority,
			statement: {
				rateBasedStatement: {
					limit: options.rateLimitThreshold,
					aggregateKeyType: 'IP',
				},
			},
			action: { block: {} },
			visibilityConfig: {
				sampledRequestsEnabled: true,
				cloudWatchMetricsEnabled: true,
				metricName: 'RateLimitRule',
			},
		})
		priority++

		// Block common attack patterns
		rules.push({
			name: 'BlockCommonAttacks',
			priority,
			statement: {
				orStatement: {
					statements: [
						// Block requests with suspicious headers
						{
							byteMatchStatement: {
								fieldToMatch: {
									singleHeader: {
										name: 'user-agent',
									},
								},
								positionalConstraint: 'CONTAINS',
								searchString: 'sqlmap',
								textTransformations: [
									{
										priority: 0,
										type: 'LOWERCASE',
									},
								],
							},
						},
						// Block directory traversal attempts
						{
							byteMatchStatement: {
								fieldToMatch: {
									uriPath: {},
								},
								positionalConstraint: 'CONTAINS',
								searchString: '../',
								textTransformations: [
									{
										priority: 0,
										type: 'URL_DECODE',
									},
								],
							},
						},
						// Block suspicious query parameters
						{
							byteMatchStatement: {
								fieldToMatch: {
									queryString: {},
								},
								positionalConstraint: 'CONTAINS',
								searchString: '<script',
								textTransformations: [
									{
										priority: 0,
										type: 'LOWERCASE',
									},
									{
										priority: 1,
										type: 'HTML_ENTITY_DECODE',
									},
								],
							},
						},
					],
				},
			},
			action: { block: {} },
			visibilityConfig: {
				sampledRequestsEnabled: true,
				cloudWatchMetricsEnabled: true,
				metricName: 'BlockCommonAttacks',
			},
		})

		return rules
	}

	private createMonitoringDashboard(environmentName: string): void {
		const dashboard = new cloudwatch.Dashboard(this, 'WafDashboard', {
			dashboardName: `${environmentName}-waf-monitoring`,
		})

		// WAF Blocked Requests Metric
		const blockedRequestsMetric = new cloudwatch.Metric({
			namespace: 'AWS/WAFV2',
			metricName: 'BlockedRequests',
			dimensionsMap: {
				WebACL: this.webAcl.name!,
				Region: cdk.Stack.of(this).region,
			},
			statistic: 'Sum',
		})

		// WAF Allowed Requests Metric
		const allowedRequestsMetric = new cloudwatch.Metric({
			namespace: 'AWS/WAFV2',
			metricName: 'AllowedRequests',
			dimensionsMap: {
				WebACL: this.webAcl.name!,
				Region: cdk.Stack.of(this).region,
			},
			statistic: 'Sum',
		})

		// Create widgets
		const blockedRequestsWidget = new cloudwatch.GraphWidget({
			title: 'WAF Blocked Requests',
			width: 12,
			height: 6,
			left: [blockedRequestsMetric],
		})

		const allowedRequestsWidget = new cloudwatch.GraphWidget({
			title: 'WAF Allowed Requests',
			width: 12,
			height: 6,
			right: [allowedRequestsMetric],
		})

		const ruleMetricsWidget = new cloudwatch.GraphWidget({
			title: 'WAF Rule Metrics',
			width: 24,
			height: 8,
			left: [
				new cloudwatch.Metric({
					namespace: 'AWS/WAFV2',
					metricName: 'CountedRequests',
					dimensionsMap: {
						WebACL: this.webAcl.name!,
						Rule: 'RateLimitRule',
						Region: cdk.Stack.of(this).region,
					},
					statistic: 'Sum',
				}),
			],
		})

		dashboard.addWidgets(
			blockedRequestsWidget,
			allowedRequestsWidget,
			ruleMetricsWidget,
		)
	}

	private createSecurityAlarms(environmentName: string): void {
		// High number of blocked requests alarm
		const highBlockedRequestsAlarm = new cloudwatch.Alarm(
			this,
			'HighBlockedRequestsAlarm',
			{
				alarmName: `${environmentName}-waf-high-blocked-requests`,
				alarmDescription: 'High number of blocked requests detected by WAF',
				metric: new cloudwatch.Metric({
					namespace: 'AWS/WAFV2',
					metricName: 'BlockedRequests',
					dimensionsMap: {
						WebACL: this.webAcl.name!,
						Region: cdk.Stack.of(this).region,
					},
					statistic: 'Sum',
				}),
				threshold: 100,
				evaluationPeriods: 5,
				comparisonOperator:
					cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
				treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
			},
		)

		// Rate limiting triggered alarm
		const rateLimitAlarm = new cloudwatch.Alarm(this, 'RateLimitAlarm', {
			alarmName: `${environmentName}-waf-rate-limit-triggered`,
			alarmDescription: 'Rate limiting has been triggered',
			metric: new cloudwatch.Metric({
				namespace: 'AWS/WAFV2',
				metricName: 'CountedRequests',
				dimensionsMap: {
					WebACL: this.webAcl.name!,
					Rule: 'RateLimitRule',
					Region: cdk.Stack.of(this).region,
				},
				statistic: 'Sum',
			}),
			threshold: 50,
			evaluationPeriods: 3,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		})

		// SQL Injection attempts alarm
		const sqlInjectionAlarm = new cloudwatch.Alarm(this, 'SqlInjectionAlarm', {
			alarmName: `${environmentName}-waf-sql-injection-attempts`,
			alarmDescription: 'SQL injection attempts detected',
			metric: new cloudwatch.Metric({
				namespace: 'AWS/WAFV2',
				metricName: 'CountedRequests',
				dimensionsMap: {
					WebACL: this.webAcl.name!,
					Rule: 'AWSManagedRulesSQLiRuleSet',
					Region: cdk.Stack.of(this).region,
				},
				statistic: 'Sum',
			}),
			threshold: 10,
			evaluationPeriods: 5,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		})

		this.alarms.push(
			highBlockedRequestsAlarm,
			rateLimitAlarm,
			sqlInjectionAlarm,
		)
	}

	/**
	 * Associate this WebACL with a resource (ALB, CloudFront, etc.)
	 */
	public associateWithResource(resourceArn: string): void {
		new wafv2.CfnWebACLAssociation(this, 'WebACLAssociation', {
			resourceArn,
			webAclArn: this.webAclArn,
		})
	}

	/**
	 * Get the WebACL ARN for external associations
	 */
	public getWebAclArn(): string {
		return this.webAclArn
	}

	/**
	 * Get the CloudWatch log group for WAF logs
	 */
	public getLogGroup(): logs.LogGroup {
		return this.logGroup
	}
}
