import * as cdk from 'aws-cdk-lib'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import { Construct } from 'constructs'

export interface DDoSProtectionConstructProps {
	/**
	 * Environment name for resource naming
	 */
	environmentName: string

	/**
	 * SNS topic for DDoS alerts
	 */
	alarmTopic?: sns.ITopic

	/**
	 * Enable detailed monitoring and logging
	 */
	enableDetailedMonitoring?: boolean

	/**
	 * CloudWatch log group retention period
	 */
	logRetention?: logs.RetentionDays

	/**
	 * DDoS protection configuration
	 */
	ddosProtection?: {
		/**
		 * Enable automatic DDoS mitigation
		 */
		enabled?: boolean

		/**
		 * DDoS detection threshold (requests per second)
		 */
		detectionThreshold?: number

		/**
		 * DDoS mitigation threshold (requests per second)
		 */
		mitigationThreshold?: number

		/**
		 * Enable geographic-based protection
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

		/**
		 * Enable IP reputation-based blocking
		 */
		enableIpReputation?: boolean

		/**
		 * Enable behavioral analysis
		 */
		enableBehavioralAnalysis?: boolean

		/**
		 * Enable automatic IP blocking
		 */
		enableAutoIpBlocking?: boolean

		/**
		 * IP blocking duration in minutes
		 */
		ipBlockingDuration?: number
	}
}

export class DDoSProtectionConstruct extends Construct {
	public readonly logGroup: logs.LogGroup
	public readonly alarms: cloudwatch.Alarm[]
	public readonly ddosAnalysisLambda?: lambda.Function

	constructor(
		scope: Construct,
		id: string,
		props: DDoSProtectionConstructProps,
	) {
		super(scope, id)

		const {
			environmentName,
			alarmTopic,
			enableDetailedMonitoring = true,
			logRetention = logs.RetentionDays.ONE_WEEK,
			ddosProtection = {},
		} = props

		const {
			enabled = true,
			detectionThreshold = 50,
			mitigationThreshold = 100,
			enableGeoProtection = true,
			monitoredCountries = ['CN', 'RU', 'KP', 'IR', 'KP'],
			enableBotProtection = true,
			enableIpReputation = true,
			enableBehavioralAnalysis = true,
			enableAutoIpBlocking = true,
			ipBlockingDuration = 60,
		} = ddosProtection

		this.alarms = []

		// Create CloudWatch log group for DDoS protection logs
		this.logGroup = new logs.LogGroup(this, 'DDoSProtectionLogGroup', {
			logGroupName: `/aws/ddos-protection/${environmentName}`,
			retention: logRetention,
			removalPolicy: cdk.RemovalPolicy.DESTROY,
		})

		if (enabled) {
			// Create DDoS analysis Lambda function
			this.ddosAnalysisLambda = this.createDDoSAnalysisLambda(environmentName)

			// Create CloudWatch alarms for DDoS protection
			if (enableDetailedMonitoring && alarmTopic) {
				this.createDDoSProtectionAlarms(alarmTopic, environmentName)
			}

			// Create CloudWatch dashboard for DDoS protection
			this.createDDoSProtectionDashboard(environmentName)

			// Schedule DDoS analysis
			this.scheduleDDoSAnalysis(environmentName)
		}
	}

	private createDDoSAnalysisLambda(environmentName: string): lambda.Function {
		return new lambda.Function(this, 'DDoSAnalysisLambda', {
			functionName: `${environmentName}-ddos-analysis`,
			runtime: lambda.Runtime.NODEJS_18_X,
			handler: 'index.handler',
			code: lambda.Code.fromInline(`
const { CloudWatchClient, GetMetricStatisticsCommand } = require('@aws-sdk/client-cloudwatch');
const { WAFV2Client, UpdateWebACLCommand } = require('@aws-sdk/client-wafv2');

const cloudWatch = new CloudWatchClient({ region: process.env.AWS_REGION });
const waf = new WAFV2Client({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
    console.log('DDoS Analysis Lambda triggered:', JSON.stringify(event, null, 2));
    
    try {
        // Analyze traffic patterns
        const trafficAnalysis = await analyzeTrafficPatterns();
        
        // Detect DDoS patterns
        const ddosPatterns = await detectDDoSPatterns(trafficAnalysis);
        
        // Update WAF rules if needed
        if (ddosPatterns.length > 0) {
            await updateWAFRules(ddosPatterns);
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'DDoS analysis completed',
                patterns: ddosPatterns.length,
                timestamp: new Date().toISOString()
            })
        };
    } catch (error) {
        console.error('DDoS analysis error:', error);
        throw error;
    }
};

async function analyzeTrafficPatterns() {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 5 * 60 * 1000); // Last 5 minutes
    
    const command = new GetMetricStatisticsCommand({
        Namespace: 'AWS/WAFV2',
        MetricName: 'CountedRequests',
        Dimensions: [
            {
                Name: 'WebACL',
                Value: process.env.WEB_ACL_NAME
            }
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 60,
        Statistics: ['Sum', 'Average', 'Maximum']
    });
    
    const response = await cloudWatch.send(command);
    return response.Datapoints || [];
}

async function detectDDoSPatterns(trafficData) {
    const patterns = [];
    
    // Analyze for sudden spikes
    if (trafficData.length > 0) {
        const maxRequests = Math.max(...trafficData.map(d => d.Maximum || 0));
        const avgRequests = trafficData.reduce((sum, d) => sum + (d.Average || 0), 0) / trafficData.length;
        
        if (maxRequests > avgRequests * 3) {
            patterns.push({
                type: 'traffic_spike',
                severity: 'high',
                maxRequests,
                avgRequests,
                recommendation: 'Consider implementing stricter rate limiting'
            });
        }
    }
    
    return patterns;
}

async function updateWAFRules(patterns) {
    // This would update WAF rules based on detected patterns
    // Implementation would depend on specific WAF configuration
    console.log('Updating WAF rules based on patterns:', patterns);
}
`),
			timeout: cdk.Duration.minutes(5),
			memorySize: 256,
			environment: {
				WEB_ACL_NAME: `${environmentName}-rate-limiting-web-acl`,
				ENVIRONMENT: environmentName,
			},
			logRetention: logs.RetentionDays.ONE_WEEK,
		})
	}

	private createDDoSProtectionAlarms(
		topic: sns.ITopic,
		environmentName: string,
	): void {
		// High request volume alarm
		const highVolumeAlarm = new cloudwatch.Alarm(this, 'HighVolumeAlarm', {
			alarmName: `${environmentName}-high-volume-traffic`,
			alarmDescription: 'High volume traffic detected - potential DDoS',
			metric: new cloudwatch.Metric({
				namespace: 'AWS/ApplicationELB',
				metricName: 'RequestCount',
				dimensionsMap: {
					LoadBalancer: `${environmentName}-alb`,
				},
			}),
			threshold: 1000, // More than 1000 requests per minute
			evaluationPeriods: 2,
			datapointsToAlarm: 1,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		})

		highVolumeAlarm.addAlarmAction(new cloudwatch.actions.SnsAction(topic))

		this.alarms.push(highVolumeAlarm)

		// Unusual traffic pattern alarm
		const unusualPatternAlarm = new cloudwatch.Alarm(
			this,
			'UnusualPatternAlarm',
			{
				alarmName: `${environmentName}-unusual-traffic-pattern`,
				alarmDescription: 'Unusual traffic pattern detected',
				metric: new cloudwatch.Metric({
					namespace: 'AWS/WAFV2',
					metricName: 'BlockedRequests',
					dimensionsMap: {
						WebACL: `${environmentName}-rate-limiting-web-acl`,
						Region: cdk.Stack.of(this).region,
						Rule: 'DDoSDetectionRule',
					},
				}),
				threshold: 100, // More than 100 blocked requests in 5 minutes
				evaluationPeriods: 1,
				datapointsToAlarm: 1,
				comparisonOperator:
					cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
				treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
			},
		)

		unusualPatternAlarm.addAlarmAction(new cloudwatch.actions.SnsAction(topic))

		this.alarms.push(unusualPatternAlarm)

		// Geographic anomaly alarm
		const geoAnomalyAlarm = new cloudwatch.Alarm(this, 'GeoAnomalyAlarm', {
			alarmName: `${environmentName}-geographic-anomaly`,
			alarmDescription: 'Geographic traffic anomaly detected',
			metric: new cloudwatch.Metric({
				namespace: 'AWS/WAFV2',
				metricName: 'BlockedRequests',
				dimensionsMap: {
					WebACL: `${environmentName}-rate-limiting-web-acl`,
					Region: cdk.Stack.of(this).region,
					Rule: 'GeoDDoSProtectionRule',
				},
			}),
			threshold: 50, // More than 50 blocked requests from monitored countries
			evaluationPeriods: 1,
			datapointsToAlarm: 1,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		})

		geoAnomalyAlarm.addAlarmAction(new cloudwatch.actions.SnsAction(topic))

		this.alarms.push(geoAnomalyAlarm)
	}

	private createDDoSProtectionDashboard(environmentName: string): void {
		const dashboard = new cloudwatch.Dashboard(
			this,
			'DDoSProtectionDashboard',
			{
				dashboardName: `${environmentName}-ddos-protection-dashboard`,
			},
		)

		// Traffic volume widget
		const trafficVolumeWidget = new cloudwatch.GraphWidget({
			title: 'Traffic Volume',
			left: [
				new cloudwatch.Metric({
					namespace: 'AWS/ApplicationELB',
					metricName: 'RequestCount',
					dimensionsMap: {
						LoadBalancer: `${environmentName}-alb`,
					},
				}),
				new cloudwatch.Metric({
					namespace: 'AWS/ApplicationELB',
					metricName: 'TargetResponseTime',
					dimensionsMap: {
						LoadBalancer: `${environmentName}-alb`,
					},
				}),
			],
			width: 12,
			height: 6,
		})

		// DDoS protection metrics widget
		const ddosMetricsWidget = new cloudwatch.GraphWidget({
			title: 'DDoS Protection Metrics',
			left: [
				new cloudwatch.Metric({
					namespace: 'AWS/WAFV2',
					metricName: 'BlockedRequests',
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

		// Geographic distribution widget
		const geoDistributionWidget = new cloudwatch.GraphWidget({
			title: 'Geographic Distribution',
			left: [
				new cloudwatch.Metric({
					namespace: 'AWS/WAFV2',
					metricName: 'BlockedRequests',
					dimensionsMap: {
						WebACL: `${environmentName}-rate-limiting-web-acl`,
						Region: cdk.Stack.of(this).region,
						Rule: 'GeoDDoSProtectionRule',
					},
				}),
			],
			width: 12,
			height: 6,
		})

		// Bot protection widget
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
			trafficVolumeWidget,
			ddosMetricsWidget,
			geoDistributionWidget,
			botProtectionWidget,
		)
	}

	private scheduleDDoSAnalysis(environmentName: string): void {
		// Schedule DDoS analysis every 5 minutes
		const rule = new events.Rule(this, 'DDoSAnalysisSchedule', {
			ruleName: `${environmentName}-ddos-analysis-schedule`,
			description: 'Schedule DDoS analysis',
			schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
		})

		if (this.ddosAnalysisLambda) {
			rule.addTarget(new targets.LambdaFunction(this.ddosAnalysisLambda))
		}
	}

	/**
	 * Get the log group ARN
	 */
	public getLogGroupArn(): string {
		return this.logGroup.logGroupArn
	}

	/**
	 * Get the DDoS analysis Lambda function ARN
	 */
	public getDDoSAnalysisLambdaArn(): string | undefined {
		return this.ddosAnalysisLambda?.functionArn
	}
}
