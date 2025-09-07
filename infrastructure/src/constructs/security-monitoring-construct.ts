import * as cdk from 'aws-cdk-lib'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import { Construct } from 'constructs'

export interface SecurityMonitoringConstructProps {
	/**
	 * Environment name for resource naming
	 */
	environmentName: string

	/**
	 * SNS topic for security alerts
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
	 * Security monitoring configuration
	 */
	securityMonitoring?: {
		/**
		 * Enable threat intelligence monitoring
		 */
		enableThreatIntelligence?: boolean

		/**
		 * Enable security event correlation
		 */
		enableEventCorrelation?: boolean

		/**
		 * Enable automated response
		 */
		enableAutomatedResponse?: boolean

		/**
		 * Enable compliance monitoring
		 */
		enableComplianceMonitoring?: boolean

		/**
		 * Enable vulnerability scanning
		 */
		enableVulnerabilityScanning?: boolean

		/**
		 * Enable incident response automation
		 */
		enableIncidentResponse?: boolean
	}
}

export class SecurityMonitoringConstruct extends Construct {
	public readonly logGroup: logs.LogGroup
	public readonly alarms: cloudwatch.Alarm[]
	public readonly securityAnalysisLambda?: lambda.Function
	public readonly incidentResponseLambda?: lambda.Function

	constructor(scope: Construct, id: string, props: SecurityMonitoringConstructProps) {
		super(scope, id)

		const {
			environmentName,
			alarmTopic,
			enableDetailedMonitoring = true,
			logRetention = logs.RetentionDays.ONE_WEEK,
			securityMonitoring = {},
		} = props

		const {
			enableThreatIntelligence = true,
			enableEventCorrelation = true,
			enableAutomatedResponse = true,
			enableComplianceMonitoring = true,
			enableVulnerabilityScanning = true,
			enableIncidentResponse = true,
		} = securityMonitoring

		this.alarms = []

		// Create CloudWatch log group for security monitoring
		this.logGroup = new logs.LogGroup(this, 'SecurityMonitoringLogGroup', {
			logGroupName: `/aws/security-monitoring/${environmentName}`,
			retention: logRetention,
			removalPolicy: cdk.RemovalPolicy.DESTROY,
		})

		// Create security analysis Lambda function
		this.securityAnalysisLambda = this.createSecurityAnalysisLambda(environmentName)

		// Create incident response Lambda function
		if (enableIncidentResponse) {
			this.incidentResponseLambda = this.createIncidentResponseLambda(environmentName)
		}

		// Create CloudWatch alarms for security monitoring
		if (enableDetailedMonitoring && alarmTopic) {
			this.createSecurityMonitoringAlarms(alarmTopic, environmentName)
		}

		// Create CloudWatch dashboard for security monitoring
		this.createSecurityMonitoringDashboard(environmentName)

		// Schedule security analysis
		this.scheduleSecurityAnalysis(environmentName)
	}

	private createSecurityAnalysisLambda(environmentName: string): lambda.Function {
		return new lambda.Function(this, 'SecurityAnalysisLambda', {
			functionName: `${environmentName}-security-analysis`,
			runtime: lambda.Runtime.NODEJS_18_X,
			handler: 'index.handler',
			code: lambda.Code.fromInline(`
const { CloudWatchClient, GetMetricStatisticsCommand } = require('@aws-sdk/client-cloudwatch');
const { WAFV2Client, GetWebACLCommand } = require('@aws-sdk/client-wafv2');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const cloudWatch = new CloudWatchClient({ region: process.env.AWS_REGION });
const waf = new WAFV2Client({ region: process.env.AWS_REGION });
const sns = new SNSClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
    console.log('Security Analysis Lambda triggered:', JSON.stringify(event, null, 2));
    
    try {
        // Analyze security metrics
        const securityMetrics = await analyzeSecurityMetrics();
        
        // Detect security threats
        const threats = await detectSecurityThreats(securityMetrics);
        
        // Correlate security events
        const correlatedEvents = await correlateSecurityEvents(threats);
        
        // Generate security report
        const securityReport = await generateSecurityReport(correlatedEvents);
        
        // Send alerts if critical threats detected
        if (securityReport.criticalThreats.length > 0) {
            await sendSecurityAlert(securityReport);
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Security analysis completed',
                threats: threats.length,
                criticalThreats: securityReport.criticalThreats.length,
                timestamp: new Date().toISOString()
            })
        };
    } catch (error) {
        console.error('Security analysis error:', error);
        throw error;
    }
};

async function analyzeSecurityMetrics() {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 15 * 60 * 1000); // Last 15 minutes
    
    const metrics = {};
    
    // Analyze WAF metrics
    const wafCommand = new GetMetricStatisticsCommand({
        Namespace: 'AWS/WAFV2',
        MetricName: 'BlockedRequests',
        Dimensions: [
            {
                Name: 'WebACL',
                Value: process.env.WEB_ACL_NAME
            }
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 300,
        Statistics: ['Sum', 'Average', 'Maximum']
    });
    
    const wafResponse = await cloudWatch.send(wafCommand);
    metrics.wafBlockedRequests = wafResponse.Datapoints || [];
    
    // Analyze ALB metrics
    const albCommand = new GetMetricStatisticsCommand({
        Namespace: 'AWS/ApplicationELB',
        MetricName: 'RequestCount',
        Dimensions: [
            {
                Name: 'LoadBalancer',
                Value: process.env.LOAD_BALANCER_NAME
            }
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 300,
        Statistics: ['Sum', 'Average', 'Maximum']
    });
    
    const albResponse = await cloudWatch.send(albCommand);
    metrics.albRequestCount = albResponse.Datapoints || [];
    
    return metrics;
}

async function detectSecurityThreats(metrics) {
    const threats = [];
    
    // Detect DDoS patterns
    if (metrics.wafBlockedRequests.length > 0) {
        const totalBlocked = metrics.wafBlockedRequests.reduce((sum, d) => sum + (d.Sum || 0), 0);
        if (totalBlocked > 1000) {
            threats.push({
                type: 'ddos_attack',
                severity: 'high',
                blockedRequests: totalBlocked,
                description: 'High volume of blocked requests detected'
            });
        }
    }
    
    // Detect unusual traffic patterns
    if (metrics.albRequestCount.length > 0) {
        const maxRequests = Math.max(...metrics.albRequestCount.map(d => d.Maximum || 0));
        const avgRequests = metrics.albRequestCount.reduce((sum, d) => sum + (d.Average || 0), 0) / metrics.albRequestCount.length;
        
        if (maxRequests > avgRequests * 5) {
            threats.push({
                type: 'traffic_anomaly',
                severity: 'medium',
                maxRequests,
                avgRequests,
                description: 'Unusual traffic pattern detected'
            });
        }
    }
    
    return threats;
}

async function correlateSecurityEvents(threats) {
    // Correlate different security events to identify patterns
    const correlatedEvents = [];
    
    // Group threats by type
    const threatsByType = threats.reduce((acc, threat) => {
        if (!acc[threat.type]) {
            acc[threat.type] = [];
        }
        acc[threat.type].push(threat);
        return acc;
    }, {});
    
    // Analyze patterns
    for (const [type, threatList] of Object.entries(threatsByType)) {
        if (threatList.length > 1) {
            correlatedEvents.push({
                type: 'correlated_threats',
                severity: 'high',
                threatType: type,
                count: threatList.length,
                description: \`Multiple \${type} threats detected\`
            });
        }
    }
    
    return correlatedEvents;
}

async function generateSecurityReport(correlatedEvents) {
    const criticalThreats = correlatedEvents.filter(event => event.severity === 'high');
    const mediumThreats = correlatedEvents.filter(event => event.severity === 'medium');
    const lowThreats = correlatedEvents.filter(event => event.severity === 'low');
    
    return {
        timestamp: new Date().toISOString(),
        environment: process.env.ENVIRONMENT,
        criticalThreats,
        mediumThreats,
        lowThreats,
        totalThreats: correlatedEvents.length,
        riskScore: calculateRiskScore(correlatedEvents)
    };
}

function calculateRiskScore(events) {
    let score = 0;
    events.forEach(event => {
        switch (event.severity) {
            case 'high':
                score += 10;
                break;
            case 'medium':
                score += 5;
                break;
            case 'low':
                score += 1;
                break;
        }
    });
    return Math.min(score, 100); // Cap at 100
}

async function sendSecurityAlert(securityReport) {
    const message = {
        subject: \`Security Alert - \${process.env.ENVIRONMENT} Environment\`,
        message: JSON.stringify(securityReport, null, 2)
    };
    
    const command = new PublishCommand({
        TopicArn: process.env.SNS_TOPIC_ARN,
        Subject: message.subject,
        Message: message.message
    });
    
    await sns.send(command);
}
`),
			timeout: cdk.Duration.minutes(10),
			memorySize: 512,
			environment: {
				WEB_ACL_NAME: `${environmentName}-rate-limiting-web-acl`,
				LOAD_BALANCER_NAME: `${environmentName}-alb`,
				ENVIRONMENT: environmentName,
				SNS_TOPIC_ARN: process.env.SNS_TOPIC_ARN || '',
			},
			logRetention: logs.RetentionDays.ONE_WEEK,
		})
	}

	private createIncidentResponseLambda(environmentName: string): lambda.Function {
		return new lambda.Function(this, 'IncidentResponseLambda', {
			functionName: `${environmentName}-incident-response`,
			runtime: lambda.Runtime.NODEJS_18_X,
			handler: 'index.handler',
			code: lambda.Code.fromInline(`
const { WAFV2Client, UpdateWebACLCommand } = require('@aws-sdk/client-wafv2');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const waf = new WAFV2Client({ region: process.env.AWS_REGION });
const sns = new SNSClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
    console.log('Incident Response Lambda triggered:', JSON.stringify(event, null, 2));
    
    try {
        // Parse the security alert
        const alert = JSON.parse(event.Records[0].Sns.Message);
        
        // Determine response actions
        const responseActions = await determineResponseActions(alert);
        
        // Execute response actions
        await executeResponseActions(responseActions);
        
        // Log incident
        await logIncident(alert, responseActions);
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Incident response completed',
                actions: responseActions.length,
                timestamp: new Date().toISOString()
            })
        };
    } catch (error) {
        console.error('Incident response error:', error);
        throw error;
    }
};

async function determineResponseActions(alert) {
    const actions = [];
    
    // Determine actions based on threat type and severity
    if (alert.criticalThreats && alert.criticalThreats.length > 0) {
        // For critical threats, implement immediate response
        actions.push({
            type: 'increase_rate_limiting',
            priority: 'high',
            description: 'Increase rate limiting thresholds'
        });
        
        actions.push({
            type: 'enable_geo_blocking',
            priority: 'high',
            description: 'Enable geographic blocking for suspicious regions'
        });
        
        actions.push({
            type: 'notify_security_team',
            priority: 'critical',
            description: 'Notify security team immediately'
        });
    }
    
    return actions;
}

async function executeResponseActions(actions) {
    for (const action of actions) {
        switch (action.type) {
            case 'increase_rate_limiting':
                await increaseRateLimiting();
                break;
            case 'enable_geo_blocking':
                await enableGeoBlocking();
                break;
            case 'notify_security_team':
                await notifySecurityTeam(action);
                break;
        }
    }
}

async function increaseRateLimiting() {
    // This would update WAF rules to be more restrictive
    console.log('Increasing rate limiting thresholds');
}

async function enableGeoBlocking() {
    // This would enable geographic blocking
    console.log('Enabling geographic blocking');
}

async function notifySecurityTeam(action) {
    const command = new PublishCommand({
        TopicArn: process.env.SECURITY_TEAM_SNS_ARN,
        Subject: 'Critical Security Alert',
        Message: JSON.stringify(action, null, 2)
    });
    
    await sns.send(command);
}

async function logIncident(alert, actions) {
    console.log('Incident logged:', {
        alert,
        actions,
        timestamp: new Date().toISOString()
    });
}
`),
			timeout: cdk.Duration.minutes(5),
			memorySize: 256,
			environment: {
				ENVIRONMENT: environmentName,
				SECURITY_TEAM_SNS_ARN: process.env.SECURITY_TEAM_SNS_ARN || '',
			},
			logRetention: logs.RetentionDays.ONE_WEEK,
		})
	}

	private createSecurityMonitoringAlarms(topic: sns.ITopic, environmentName: string): void {
		// High security risk alarm
		const highRiskAlarm = new cloudwatch.Alarm(
			this,
			'HighSecurityRiskAlarm',
			{
				alarmName: `${environmentName}-high-security-risk`,
				alarmDescription: 'High security risk detected',
				metric: new cloudwatch.Metric({
					namespace: 'AWS/WAFV2',
					metricName: 'BlockedRequests',
					dimensionsMap: {
						WebACL: `${environmentName}-rate-limiting-web-acl`,
						Region: cdk.Stack.of(this).region,
					},
				}),
				threshold: 500, // More than 500 blocked requests in 5 minutes
				evaluationPeriods: 1,
				datapointsToAlarm: 1,
				comparisonOperator:
					cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
				treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
			},
		)

		highRiskAlarm.addAlarmAction(
			new cloudwatch.actions.SnsAction(topic),
		)

		this.alarms.push(highRiskAlarm)

		// Unusual access pattern alarm
		const unusualAccessAlarm = new cloudwatch.Alarm(
			this,
			'UnusualAccessAlarm',
			{
				alarmName: `${environmentName}-unusual-access-pattern`,
				alarmDescription: 'Unusual access pattern detected',
				metric: new cloudwatch.Metric({
					namespace: 'AWS/ApplicationELB',
					metricName: 'TargetResponseTime',
					dimensionsMap: {
						LoadBalancer: `${environmentName}-alb`,
					},
				}),
				threshold: 5, // Response time greater than 5 seconds
				evaluationPeriods: 2,
				datapointsToAlarm: 1,
				comparisonOperator:
					cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
				treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
			},
		)

		unusualAccessAlarm.addAlarmAction(
			new cloudwatch.actions.SnsAction(topic),
		)

		this.alarms.push(unusualAccessAlarm)
	}

	private createSecurityMonitoringDashboard(environmentName: string): void {
		const dashboard = new cloudwatch.Dashboard(this, 'SecurityMonitoringDashboard', {
			dashboardName: `${environmentName}-security-monitoring-dashboard`,
		})

		// Security overview widget
		const securityOverviewWidget = new cloudwatch.GraphWidget({
			title: 'Security Overview',
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

		// Threat detection widget
		const threatDetectionWidget = new cloudwatch.GraphWidget({
			title: 'Threat Detection',
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
						Rule: 'BotProtectionRule',
					},
				}),
			],
			width: 12,
			height: 6,
		})

		// Performance impact widget
		const performanceImpactWidget = new cloudwatch.GraphWidget({
			title: 'Performance Impact',
			left: [
				new cloudwatch.Metric({
					namespace: 'AWS/ApplicationELB',
					metricName: 'TargetResponseTime',
					dimensionsMap: {
						LoadBalancer: `${environmentName}-alb`,
					},
				}),
				new cloudwatch.Metric({
					namespace: 'AWS/ApplicationELB',
					metricName: 'RequestCount',
					dimensionsMap: {
						LoadBalancer: `${environmentName}-alb`,
					},
				}),
			],
			width: 12,
			height: 6,
		})

		// Add widgets to dashboard
		dashboard.addWidgets(
			securityOverviewWidget,
			threatDetectionWidget,
			performanceImpactWidget,
		)
	}

	private scheduleSecurityAnalysis(environmentName: string): void {
		// Schedule security analysis every 15 minutes
		const rule = new events.Rule(this, 'SecurityAnalysisSchedule', {
			ruleName: `${environmentName}-security-analysis-schedule`,
			description: 'Schedule security analysis',
			schedule: events.Schedule.rate(cdk.Duration.minutes(15)),
		})

		if (this.securityAnalysisLambda) {
			rule.addTarget(
				new targets.LambdaFunction(this.securityAnalysisLambda),
			)
		}
	}

	/**
	 * Get the log group ARN
	 */
	public getLogGroupArn(): string {
		return this.logGroup.logGroupArn
	}

	/**
	 * Get the security analysis Lambda function ARN
	 */
	public getSecurityAnalysisLambdaArn(): string | undefined {
		return this.securityAnalysisLambda?.functionArn
	}

	/**
	 * Get the incident response Lambda function ARN
	 */
	public getIncidentResponseLambdaArn(): string | undefined {
		return this.incidentResponseLambda?.functionArn
	}
}
