import * as cdk from 'aws-cdk-lib'
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as sns from 'aws-cdk-lib/aws-sns'
import { Construct } from 'constructs'

export interface AdvancedSecurityMonitoringConstructProps {
	/**
	 * Environment name for resource naming and tagging
	 */
	readonly environmentName: string

	/**
	 * Application name for resource naming
	 */
	readonly applicationName: string

	/**
	 * Security monitoring configuration
	 */
	readonly securityConfig?: {
		/**
		 * Enable CloudTrail logging
		 */
		readonly enableCloudTrail?: boolean

		/**
		 * CloudTrail log retention period
		 */
		readonly cloudTrailRetentionDays?: number

		/**
		 * Enable VPC Flow Logs
		 */
		readonly enableVpcFlowLogs?: boolean

		/**
		 * Enable GuardDuty integration
		 */
		readonly enableGuardDutyIntegration?: boolean

		/**
		 * Security event retention period
		 */
		readonly securityEventRetentionDays?: number

		/**
		 * Enable compliance monitoring
		 */
		readonly enableComplianceMonitoring?: boolean
	}

	/**
	 * SNS topics for security notifications
	 */
	readonly securityNotificationTopics?: {
		readonly criticalSecurityAlert?: sns.Topic
		readonly securityWarning?: sns.Topic
		readonly complianceViolation?: sns.Topic
		readonly suspiciousActivity?: sns.Topic
	}

	/**
	 * VPC ID for VPC Flow Logs (if enabled)
	 */
	readonly vpcId?: string

	/**
	 * Existing CloudWatch log groups to monitor
	 */
	readonly existingLogGroups?: logs.ILogGroup[]
}

/**
 * Security event types
 */
export enum SecurityEventType {
	UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
	PRIVILEGE_ESCALATION = 'PRIVILEGE_ESCALATION',
	SUSPICIOUS_LOGIN = 'SUSPICIOUS_LOGIN',
	DATA_EXFILTRATION = 'DATA_EXFILTRATION',
	MALWARE_DETECTION = 'MALWARE_DETECTION',
	COMPLIANCE_VIOLATION = 'COMPLIANCE_VIOLATION',
	CONFIGURATION_CHANGE = 'CONFIGURATION_CHANGE',
	NETWORK_ANOMALY = 'NETWORK_ANOMALY',
}

/**
 * Security event severity levels
 */
export enum SecuritySeverity {
	CRITICAL = 'CRITICAL',
	HIGH = 'HIGH',
	MEDIUM = 'MEDIUM',
	LOW = 'LOW',
	INFO = 'INFO',
}

/**
 * Security event interface
 */
export interface SecurityEvent {
	readonly eventId: string
	readonly timestamp: string
	readonly eventType: SecurityEventType
	readonly severity: SecuritySeverity
	readonly source: string
	readonly description: string
	readonly metadata?: Record<string, unknown>
	readonly remediation?: {
		readonly automated: boolean
		readonly actions: string[]
		readonly status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
	}
}

/**
 * Advanced Security Monitoring Construct for comprehensive security monitoring and compliance
 *
 * This construct provides:
 * - CloudTrail logging for API activity monitoring
 * - VPC Flow Logs for network traffic analysis
 * - Security event detection and alerting
 * - Compliance monitoring and reporting
 * - Automated security response capabilities
 * - Integration with AWS security services
 */
export class AdvancedSecurityMonitoringConstruct extends Construct {
	public readonly cloudTrail?: cloudtrail.Trail
	public readonly securityEventTable: dynamodb.Table
	public readonly securityEventProcessor: lambda.Function
	public readonly securityAnalyzer: lambda.Function
	public readonly complianceChecker: lambda.Function
	public readonly securityDashboard: cloudwatch.Dashboard
	public readonly securityLogGroup: logs.LogGroup
	public readonly securityEventBucket?: s3.Bucket
	public readonly vpcFlowLogsLogGroup?: logs.LogGroup

	private readonly props: AdvancedSecurityMonitoringConstructProps
	private readonly resourcePrefix: string

	constructor(
		scope: Construct,
		id: string,
		props: AdvancedSecurityMonitoringConstructProps,
	) {
		super(scope, id)

		this.props = props
		this.resourcePrefix = `${props.applicationName}-${props.environmentName}`

		// Create S3 bucket for security logs (if CloudTrail is enabled)
		if (props.securityConfig?.enableCloudTrail) {
			this.securityEventBucket = this.createSecurityEventBucket()
		}

		// Create DynamoDB table for security events
		this.securityEventTable = this.createSecurityEventTable()

		// Create CloudWatch log group for security events
		this.securityLogGroup = this.createSecurityLogGroup()

		// Create Lambda functions for security monitoring
		this.securityEventProcessor = this.createSecurityEventProcessor()
		this.securityAnalyzer = this.createSecurityAnalyzer()
		this.complianceChecker = this.createComplianceChecker()

		// Create CloudTrail (if enabled)
		if (props.securityConfig?.enableCloudTrail && this.securityEventBucket) {
			this.cloudTrail = this.createCloudTrail()
		}

		// Create VPC Flow Logs (if enabled)
		if (props.securityConfig?.enableVpcFlowLogs && props.vpcId) {
			this.createVpcFlowLogs()
		}

		// Create security dashboard
		this.securityDashboard = this.createSecurityDashboard()

		// Create security alarms
		this.createSecurityAlarms()

		// Create EventBridge rules for security events
		this.createSecurityEventRules()

		// Apply tags
		this.applyTags()
	}

	/**
	 * Create S3 bucket for security event storage
	 */
	private createSecurityEventBucket(): s3.Bucket {
		return new s3.Bucket(this, 'SecurityEventBucket', {
			bucketName: `${this.resourcePrefix}-security-events`,
			versioned: true,
			encryption: s3.BucketEncryption.S3_MANAGED,
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
			lifecycleRules: [
				{
					id: 'SecurityEventRetention',
					enabled: true,
					transitions: [
						{
							storageClass: s3.StorageClass.INFREQUENT_ACCESS,
							transitionAfter: cdk.Duration.days(30),
						},
						{
							storageClass: s3.StorageClass.GLACIER,
							transitionAfter: cdk.Duration.days(90),
						},
					],
					expiration: cdk.Duration.days(
						this.props.securityConfig?.securityEventRetentionDays ?? 2555, // 7 years default
					),
				},
			],
			removalPolicy: cdk.RemovalPolicy.RETAIN,
		})
	}

	/**
	 * Create DynamoDB table for security events
	 */
	private createSecurityEventTable(): dynamodb.Table {
		const table = new dynamodb.Table(this, 'SecurityEventTable', {
			tableName: `${this.resourcePrefix}-security-events`,
			partitionKey: {
				name: 'eventId',
				type: dynamodb.AttributeType.STRING,
			},
			sortKey: {
				name: 'timestamp',
				type: dynamodb.AttributeType.STRING,
			},
			billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
			pointInTimeRecovery: true,
			removalPolicy: cdk.RemovalPolicy.RETAIN,
			timeToLiveAttribute: 'ttl',
		})

		// Add GSI for querying by event type and severity
		table.addGlobalSecondaryIndex({
			indexName: 'EventTypeIndex',
			partitionKey: {
				name: 'eventType',
				type: dynamodb.AttributeType.STRING,
			},
			sortKey: {
				name: 'timestamp',
				type: dynamodb.AttributeType.STRING,
			},
		})

		table.addGlobalSecondaryIndex({
			indexName: 'SeverityIndex',
			partitionKey: {
				name: 'severity',
				type: dynamodb.AttributeType.STRING,
			},
			sortKey: {
				name: 'timestamp',
				type: dynamodb.AttributeType.STRING,
			},
		})

		return table
	}

	/**
	 * Create CloudWatch log group for security events
	 */
	private createSecurityLogGroup(): logs.LogGroup {
		return new logs.LogGroup(this, 'SecurityLogGroup', {
			logGroupName: `/aws/security/${this.resourcePrefix}`,
			retention: logs.RetentionDays.ONE_YEAR,
			removalPolicy: cdk.RemovalPolicy.RETAIN,
		})
	}

	/**
	 * Create CloudTrail for API activity monitoring
	 */
	private createCloudTrail(): cloudtrail.Trail {
		if (!this.securityEventBucket) {
			throw new Error('Security event bucket must be created before CloudTrail')
		}

		return new cloudtrail.Trail(this, 'SecurityCloudTrail', {
			trailName: `${this.resourcePrefix}-security-trail`,
			bucket: this.securityEventBucket,
			includeGlobalServiceEvents: true,
			isMultiRegionTrail: true,
			enableFileValidation: true,
			sendToCloudWatchLogs: true,
			cloudWatchLogGroup: this.securityLogGroup,
			managementEvents: cloudtrail.ReadWriteType.ALL,
		})
	}

	/**
	 * Create VPC Flow Logs
	 */
	private createVpcFlowLogs(): void {
		if (!this.props.vpcId) {
			return
		}

		const vpcFlowLogGroup = new logs.LogGroup(this, 'VpcFlowLogGroup', {
			logGroupName: `/aws/vpc/flowlogs/${this.resourcePrefix}`,
			retention: logs.RetentionDays.ONE_MONTH,
			removalPolicy: cdk.RemovalPolicy.RETAIN,
		})

		// Expose the LogGroup as a public property for downstream access
		Object.defineProperty(this, 'vpcFlowLogsLogGroup', {
			value: vpcFlowLogGroup,
			writable: false,
			enumerable: true,
			configurable: false,
		})

		const vpcFlowLogRole = new iam.Role(this, 'VpcFlowLogRole', {
			assumedBy: new iam.ServicePrincipal('vpc-flow-logs.amazonaws.com'),
			managedPolicies: [
				iam.ManagedPolicy.fromAwsManagedPolicyName(
					'service-role/VPCFlowLogsDeliveryRolePolicy',
				),
			],
		})

		new cdk.aws_ec2.CfnFlowLog(this, 'VpcFlowLog', {
			resourceType: 'VPC',
			resourceId: this.props.vpcId,
			trafficType: 'ALL',
			logDestinationType: 'cloud-watch-logs',
			logGroupName: vpcFlowLogGroup.logGroupName,
			deliverLogsPermissionArn: vpcFlowLogRole.roleArn,
			logFormat:
				'${srcaddr} ${dstaddr} ${srcport} ${dstport} ${protocol} ${packets} ${bytes} ${windowstart} ${windowend} ${action}',
		})
	}

	/**
	 * Create security event processor Lambda function
	 */
	private createSecurityEventProcessor(): lambda.Function {
		const role = new iam.Role(this, 'SecurityEventProcessorRole', {
			assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
			managedPolicies: [
				iam.ManagedPolicy.fromAwsManagedPolicyName(
					'service-role/AWSLambdaBasicExecutionRole',
				),
			],
		})

		// Add permissions for DynamoDB operations
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'dynamodb:PutItem',
					'dynamodb:GetItem',
					'dynamodb:UpdateItem',
					'dynamodb:Query',
					'dynamodb:Scan',
				],
				resources: [
					this.securityEventTable.tableArn,
					`${this.securityEventTable.tableArn}/index/*`,
				],
			}),
		)

		// Add permissions for CloudWatch logs
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'logs:CreateLogStream',
					'logs:PutLogEvents',
					'logs:DescribeLogGroups',
					'logs:DescribeLogStreams',
				],
				resources: [this.securityLogGroup.logGroupArn],
			}),
		)

		// Add permissions for CloudWatch metrics
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: ['cloudwatch:PutMetricData'],
				resources: ['*'],
			}),
		)

		return new lambda.Function(this, 'SecurityEventProcessor', {
			functionName: `${this.resourcePrefix}-security-event-processor`,
			runtime: lambda.Runtime.NODEJS_20_X,
			handler: 'index.handler',
			role,
			timeout: cdk.Duration.minutes(5),
			code: lambda.Code.fromInline(this.getSecurityEventProcessorCode()),
			environment: {
				ENVIRONMENT_NAME: this.props.environmentName,
				APPLICATION_NAME: this.props.applicationName,
				SECURITY_EVENT_TABLE: this.securityEventTable.tableName,
				SECURITY_LOG_GROUP: this.securityLogGroup.logGroupName,
			},
		})
	}

	/**
	 * Create security analyzer Lambda function
	 */
	private createSecurityAnalyzer(): lambda.Function {
		const role = new iam.Role(this, 'SecurityAnalyzerRole', {
			assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
			managedPolicies: [
				iam.ManagedPolicy.fromAwsManagedPolicyName(
					'service-role/AWSLambdaBasicExecutionRole',
				),
			],
		})

		// Add permissions for DynamoDB operations
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'dynamodb:Query',
					'dynamodb:Scan',
					'dynamodb:GetItem',
					'dynamodb:UpdateItem',
				],
				resources: [
					this.securityEventTable.tableArn,
					`${this.securityEventTable.tableArn}/index/*`,
				],
			}),
		)

		// Add permissions for CloudWatch metrics
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: ['cloudwatch:PutMetricData', 'cloudwatch:GetMetricStatistics'],
				resources: ['*'],
			}),
		)

		return new lambda.Function(this, 'SecurityAnalyzer', {
			functionName: `${this.resourcePrefix}-security-analyzer`,
			runtime: lambda.Runtime.NODEJS_20_X,
			handler: 'index.handler',
			role,
			timeout: cdk.Duration.minutes(10),
			code: lambda.Code.fromInline(this.getSecurityAnalyzerCode()),
			environment: {
				ENVIRONMENT_NAME: this.props.environmentName,
				APPLICATION_NAME: this.props.applicationName,
				SECURITY_EVENT_TABLE: this.securityEventTable.tableName,
			},
		})
	}

	/**
	 * Create compliance checker Lambda function
	 */
	private createComplianceChecker(): lambda.Function {
		const role = new iam.Role(this, 'ComplianceCheckerRole', {
			assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
			managedPolicies: [
				iam.ManagedPolicy.fromAwsManagedPolicyName(
					'service-role/AWSLambdaBasicExecutionRole',
				),
			],
		})

		// Add permissions for AWS Config and compliance checks
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'config:GetComplianceDetailsByConfigRule',
					'config:GetComplianceDetailsByResource',
					'config:DescribeConfigRules',
					'config:DescribeComplianceByConfigRule',
				],
				resources: ['*'],
			}),
		)

		// Add permissions for DynamoDB operations
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: ['dynamodb:PutItem', 'dynamodb:UpdateItem'],
				resources: [this.securityEventTable.tableArn],
			}),
		)

		// Add permissions for CloudWatch metrics
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: ['cloudwatch:PutMetricData'],
				resources: ['*'],
			}),
		)

		return new lambda.Function(this, 'ComplianceChecker', {
			functionName: `${this.resourcePrefix}-compliance-checker`,
			runtime: lambda.Runtime.NODEJS_20_X,
			handler: 'index.handler',
			role,
			timeout: cdk.Duration.minutes(15),
			code: lambda.Code.fromInline(this.getComplianceCheckerCode()),
			environment: {
				ENVIRONMENT_NAME: this.props.environmentName,
				APPLICATION_NAME: this.props.applicationName,
				SECURITY_EVENT_TABLE: this.securityEventTable.tableName,
			},
		})
	}

	/**
	 * Create security dashboard
	 */
	private createSecurityDashboard(): cloudwatch.Dashboard {
		const dashboard = new cloudwatch.Dashboard(this, 'SecurityDashboard', {
			dashboardName: `${this.resourcePrefix}-security-monitoring`,
			defaultInterval: cdk.Duration.hours(24),
		})

		// Add security overview widgets
		dashboard.addWidgets(
			// Row 1: Security Event Overview
			new cloudwatch.GraphWidget({
				title: 'Security Events by Type',
				left: [
					new cloudwatch.Metric({
						namespace: 'MacroAI/Security',
						metricName: 'SecurityEvent',
						dimensionsMap: {
							Environment: this.props.environmentName,
							Application: this.props.applicationName,
						},
						statistic: 'Sum',
					}),
				],
				width: 12,
				height: 6,
			}),
			new cloudwatch.SingleValueWidget({
				title: 'Critical Security Events (24h)',
				metrics: [
					new cloudwatch.Metric({
						namespace: 'MacroAI/Security',
						metricName: 'SecurityEvent',
						dimensionsMap: {
							Environment: this.props.environmentName,
							Severity: 'CRITICAL',
							Application: this.props.applicationName,
						},
						statistic: 'Sum',
						period: cdk.Duration.hours(24),
					}),
				],
				width: 6,
				height: 6,
			}),
			new cloudwatch.SingleValueWidget({
				title: 'High Severity Events (24h)',
				metrics: [
					new cloudwatch.Metric({
						namespace: 'MacroAI/Security',
						metricName: 'SecurityEvent',
						dimensionsMap: {
							Environment: this.props.environmentName,
							Severity: 'HIGH',
							Application: this.props.applicationName,
						},
						statistic: 'Sum',
						period: cdk.Duration.hours(24),
					}),
				],
				width: 6,
				height: 6,
			}),
		)

		// Row 2: Security Event Distribution
		dashboard.addWidgets(
			new cloudwatch.GraphWidget({
				title: 'Security Events by Severity',
				left: [
					new cloudwatch.Metric({
						namespace: 'MacroAI/Security',
						metricName: 'SecurityEvent',
						dimensionsMap: {
							Environment: this.props.environmentName,
							Severity: 'CRITICAL',
							Application: this.props.applicationName,
						},
						statistic: 'Sum',
						label: 'Critical',
					}),
					new cloudwatch.Metric({
						namespace: 'MacroAI/Security',
						metricName: 'SecurityEvent',
						dimensionsMap: {
							Environment: this.props.environmentName,
							Severity: 'HIGH',
							Application: this.props.applicationName,
						},
						statistic: 'Sum',
						label: 'High',
					}),
					new cloudwatch.Metric({
						namespace: 'MacroAI/Security',
						metricName: 'SecurityEvent',
						dimensionsMap: {
							Environment: this.props.environmentName,
							Severity: 'MEDIUM',
							Application: this.props.applicationName,
						},
						statistic: 'Sum',
						label: 'Medium',
					}),
				],
				width: 24,
				height: 6,
			}),
		)

		return dashboard
	}

	/**
	 * Create security alarms
	 */
	private createSecurityAlarms(): void {
		// Critical security events alarm
		new cloudwatch.Alarm(this, 'CriticalSecurityEventsAlarm', {
			alarmName: `${this.resourcePrefix}-critical-security-events`,
			alarmDescription: 'Critical security events detected',
			metric: new cloudwatch.Metric({
				namespace: 'MacroAI/Security',
				metricName: 'SecurityEvent',
				dimensionsMap: {
					Environment: this.props.environmentName,
					Severity: 'CRITICAL',
					Application: this.props.applicationName,
				},
				statistic: 'Sum',
				period: cdk.Duration.minutes(5),
			}),
			threshold: 1,
			comparisonOperator:
				cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
			evaluationPeriods: 1,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		})

		// High severity events alarm
		new cloudwatch.Alarm(this, 'HighSeverityEventsAlarm', {
			alarmName: `${this.resourcePrefix}-high-severity-events`,
			alarmDescription: 'High severity security events detected',
			metric: new cloudwatch.Metric({
				namespace: 'MacroAI/Security',
				metricName: 'SecurityEvent',
				dimensionsMap: {
					Environment: this.props.environmentName,
					Severity: 'HIGH',
					Application: this.props.applicationName,
				},
				statistic: 'Sum',
				period: cdk.Duration.minutes(15),
			}),
			threshold: 5,
			comparisonOperator:
				cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
			evaluationPeriods: 1,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		})

		// Compliance violations alarm
		new cloudwatch.Alarm(this, 'ComplianceViolationsAlarm', {
			alarmName: `${this.resourcePrefix}-compliance-violations`,
			alarmDescription: 'Compliance violations detected',
			metric: new cloudwatch.Metric({
				namespace: 'MacroAI/Security',
				metricName: 'ComplianceViolation',
				dimensionsMap: {
					Environment: this.props.environmentName,
					Application: this.props.applicationName,
				},
				statistic: 'Sum',
				period: cdk.Duration.hours(1),
			}),
			threshold: 1,
			comparisonOperator:
				cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
			evaluationPeriods: 1,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		})
	}

	/**
	 * Create EventBridge rules for security events
	 */
	private createSecurityEventRules(): void {
		// CloudTrail security events rule
		if (this.cloudTrail) {
			const cloudTrailRule = new events.Rule(this, 'CloudTrailSecurityRule', {
				ruleName: `${this.resourcePrefix}-cloudtrail-security`,
				description: 'Process CloudTrail security events',
				eventPattern: {
					source: ['aws.cloudtrail'],
					detailType: ['AWS API Call via CloudTrail'],
					detail: {
						eventSource: ['iam.amazonaws.com', 'sts.amazonaws.com'],
						eventName: [
							'CreateUser',
							'DeleteUser',
							'AttachUserPolicy',
							'DetachUserPolicy',
							'CreateRole',
							'DeleteRole',
							'AssumeRole',
						],
					},
				},
			})

			cloudTrailRule.addTarget(
				new targets.LambdaFunction(this.securityEventProcessor),
			)
		}

		// VPC Flow Logs security events rule
		if (this.props.securityConfig?.enableVpcFlowLogs) {
			const vpcFlowRule = new events.Rule(this, 'VpcFlowSecurityRule', {
				ruleName: `${this.resourcePrefix}-vpc-flow-security`,
				description: 'Process VPC Flow Logs security events',
				eventPattern: {
					source: ['aws.vpc-flow-logs'],
					detailType: ['VPC Flow Logs'],
				},
			})

			vpcFlowRule.addTarget(
				new targets.LambdaFunction(this.securityEventProcessor),
			)
		}

		// Schedule compliance checker
		const complianceRule = new events.Rule(this, 'ComplianceCheckRule', {
			ruleName: `${this.resourcePrefix}-compliance-check`,
			description: 'Run compliance checks periodically',
			schedule: events.Schedule.rate(cdk.Duration.hours(6)),
		})

		complianceRule.addTarget(new targets.LambdaFunction(this.complianceChecker))

		// Schedule security analyzer
		const analyzerRule = new events.Rule(this, 'SecurityAnalyzerRule', {
			ruleName: `${this.resourcePrefix}-security-analyzer`,
			description: 'Run security analysis periodically',
			schedule: events.Schedule.rate(cdk.Duration.hours(1)),
		})

		analyzerRule.addTarget(new targets.LambdaFunction(this.securityAnalyzer))
	}

	/**
	 * Apply comprehensive tagging
	 */
	private applyTags(): void {
		cdk.Tags.of(this).add('Environment', this.props.environmentName)
		cdk.Tags.of(this).add('Application', this.props.applicationName)
		cdk.Tags.of(this).add('Component', 'AdvancedSecurityMonitoring')
		cdk.Tags.of(this).add('Purpose', 'SecurityMonitoring')
		cdk.Tags.of(this).add('ManagedBy', 'AdvancedSecurityMonitoringConstruct')
	}

	/**
	 * Get security event processor Lambda code
	 */
	private getSecurityEventProcessorCode(): string {
		return `
const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB();
const cloudwatchLogs = new AWS.CloudWatchLogs();
const cloudwatch = new AWS.CloudWatch();

exports.handler = async (event) => {
    console.log('Security event processor:', JSON.stringify(event, null, 2));

    try {
        // Process different types of security events
        let securityEvent;

        if (event.source === 'aws.cloudtrail') {
            securityEvent = await processCloudTrailEvent(event);
        } else if (event.source === 'aws.vpc-flow-logs') {
            securityEvent = await processVpcFlowEvent(event);
        } else if (event.securityEvent) {
            securityEvent = event.securityEvent;
        } else {
            securityEvent = await processGenericSecurityEvent(event);
        }

        if (!securityEvent) {
            console.log('No security event to process');
            return { statusCode: 200, message: 'No security event to process' };
        }

        // Record security event in DynamoDB
        await recordSecurityEvent(securityEvent);

        // Log security event
        await logSecurityEvent(securityEvent);

        // Publish CloudWatch metrics
        await publishSecurityMetrics(securityEvent);

        console.log('Security event processed successfully:', securityEvent.eventId);

        return {
            statusCode: 200,
            body: {
                eventId: securityEvent.eventId,
                eventType: securityEvent.eventType,
                severity: securityEvent.severity,
                message: 'Security event processed successfully'
            }
        };

    } catch (error) {
        console.error('Failed to process security event:', error);

        return {
            statusCode: 500,
            body: {
                error: error.message,
                message: 'Failed to process security event'
            }
        };
    }
};

async function processCloudTrailEvent(event) {
    const detail = event.detail;

    // Analyze CloudTrail event for security implications
    const eventType = determineSecurityEventType(detail);
    const severity = determineSeverity(detail);

    if (eventType === 'NONE') {
        return null; // Not a security-relevant event
    }

    return {
        eventId: \`ct-\${detail.eventID}\`,
        timestamp: new Date().toISOString(),
        eventType,
        severity,
        source: 'CloudTrail',
        description: \`CloudTrail event: \${detail.eventName} by \${detail.userIdentity?.type || 'unknown'}\`,
        metadata: {
            eventName: detail.eventName,
            sourceIPAddress: detail.sourceIPAddress,
            userAgent: detail.userAgent,
            userIdentity: detail.userIdentity,
            awsRegion: detail.awsRegion
        }
    };
}

async function processVpcFlowEvent(event) {
    const detail = event.detail;

    // Analyze VPC Flow Logs for suspicious network activity
    const isAnomalous = analyzeNetworkTraffic(detail);

    if (!isAnomalous) {
        return null; // Normal network traffic
    }

    return {
        eventId: \`vpc-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`,
        timestamp: new Date().toISOString(),
        eventType: 'NETWORK_ANOMALY',
        severity: 'MEDIUM',
        source: 'VPC Flow Logs',
        description: 'Suspicious network activity detected',
        metadata: {
            srcaddr: detail.srcaddr,
            dstaddr: detail.dstaddr,
            srcport: detail.srcport,
            dstport: detail.dstport,
            protocol: detail.protocol,
            action: detail.action
        }
    };
}

async function processGenericSecurityEvent(event) {
    return {
        eventId: \`gen-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`,
        timestamp: new Date().toISOString(),
        eventType: event.eventType || 'SUSPICIOUS_ACTIVITY',
        severity: event.severity || 'MEDIUM',
        source: event.source || 'Generic',
        description: event.description || 'Generic security event',
        metadata: event.metadata || {}
    };
}

function determineSecurityEventType(detail) {
    const eventName = detail.eventName;
    const userType = detail.userIdentity?.type;

    // High-risk IAM operations
    if (['CreateUser', 'DeleteUser', 'AttachUserPolicy', 'DetachUserPolicy'].includes(eventName)) {
        return 'PRIVILEGE_ESCALATION';
    }

    // Role operations
    if (['CreateRole', 'DeleteRole', 'AssumeRole'].includes(eventName)) {
        return 'PRIVILEGE_ESCALATION';
    }

    // Root user activity
    if (userType === 'Root') {
        return 'UNAUTHORIZED_ACCESS';
    }

    // Failed authentication attempts
    if (detail.errorCode === 'SigninFailure') {
        return 'SUSPICIOUS_LOGIN';
    }

    return 'CONFIGURATION_CHANGE';
}

function determineSeverity(detail) {
    const eventName = detail.eventName;
    const userType = detail.userIdentity?.type;
    const sourceIP = detail.sourceIPAddress;

    // Critical: Root user activity
    if (userType === 'Root') {
        return 'CRITICAL';
    }

    // High: Privilege escalation operations
    if (['CreateUser', 'DeleteUser', 'AttachUserPolicy', 'DetachUserPolicy'].includes(eventName)) {
        return 'HIGH';
    }

    // High: External IP addresses
    if (sourceIP && !isInternalIP(sourceIP)) {
        return 'HIGH';
    }

    // Medium: Role operations
    if (['CreateRole', 'DeleteRole', 'AssumeRole'].includes(eventName)) {
        return 'MEDIUM';
    }

    return 'LOW';
}

function analyzeNetworkTraffic(detail) {
    // Simple anomaly detection for network traffic
    const srcPort = parseInt(detail.srcport);
    const dstPort = parseInt(detail.dstport);
    const action = detail.action;

    // Suspicious ports
    const suspiciousPorts = [22, 23, 135, 139, 445, 1433, 3389];

    if (action === 'REJECT' && (suspiciousPorts.includes(srcPort) || suspiciousPorts.includes(dstPort))) {
        return true;
    }

    // High volume of rejected connections
    if (action === 'REJECT') {
        return true;
    }

    return false;
}

function isInternalIP(ip) {
    // Check if IP is in private ranges
    const privateRanges = [
        /^10\\./,
        /^172\\.(1[6-9]|2[0-9]|3[0-1])\\./,
        /^192\\.168\\./,
        /^127\\./
    ];

    return privateRanges.some(range => range.test(ip));
}

async function recordSecurityEvent(securityEvent) {
    const ttl = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60); // 1 year TTL

    const item = {
        eventId: { S: securityEvent.eventId },
        timestamp: { S: securityEvent.timestamp },
        eventType: { S: securityEvent.eventType },
        severity: { S: securityEvent.severity },
        source: { S: securityEvent.source },
        description: { S: securityEvent.description },
        ttl: { N: ttl.toString() }
    };

    // Add metadata
    if (securityEvent.metadata) {
        item.metadata = { M: {} };
        Object.entries(securityEvent.metadata).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                if (typeof value === 'object') {
                    item.metadata.M[key] = { S: JSON.stringify(value) };
                } else {
                    item.metadata.M[key] = { S: value.toString() };
                }
            }
        });
    }

    await dynamodb.send(new PutItemCommand({
        TableName: process.env.SECURITY_EVENT_TABLE,
        Item: item
    }));
}

async function logSecurityEvent(securityEvent) {
    try {
        const logStreamName = \`security-events-\${new Date().toISOString().split('T')[0]}\`;
        const logMessage = {
            timestamp: securityEvent.timestamp,
            eventId: securityEvent.eventId,
            eventType: securityEvent.eventType,
            severity: securityEvent.severity,
            source: securityEvent.source,
            description: securityEvent.description,
            metadata: securityEvent.metadata
        };

        // Create log stream if it doesn't exist
        try {
            await cloudwatchLogs.send(new CreateLogStreamCommand({
                logGroupName: process.env.SECURITY_LOG_GROUP,
                logStreamName: logStreamName
            }));
        } catch (error) {
            // Log stream might already exist, ignore error
            if (!error.message.includes('already exists')) {
                console.warn('Failed to create log stream:', error.message);
            }
        }

        // Put log event
        await cloudwatchLogs.send(new PutLogEventsCommand({
            logGroupName: process.env.SECURITY_LOG_GROUP,
            logStreamName: logStreamName,
            logEvents: [{
                timestamp: Date.now(),
                message: JSON.stringify(logMessage)
            }]
        }));

    } catch (error) {
        console.error('Failed to log security event:', error);
    }
}

async function publishSecurityMetrics(securityEvent) {
    try {
        const metrics = [
            {
                MetricName: 'SecurityEvent',
                Value: 1,
                Unit: 'Count',
                Dimensions: [
                    { Name: 'Environment', Value: process.env.ENVIRONMENT_NAME },
                    { Name: 'EventType', Value: securityEvent.eventType },
                    { Name: 'Severity', Value: securityEvent.severity },
                    { Name: 'Application', Value: process.env.APPLICATION_NAME }
                ]
            }
        ];

        await cloudwatch.send(new PutMetricDataCommand({
            Namespace: 'MacroAI/Security',
            MetricData: metrics
        }));

    } catch (error) {
        console.error('Failed to publish security metrics:', error);
    }
}
`
	}

	/**
	 * Get security analyzer Lambda code
	 */
	private getSecurityAnalyzerCode(): string {
		return `
const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB();
const cloudwatch = new AWS.CloudWatch();

exports.handler = async (event) => {
    console.log('Security analyzer event:', JSON.stringify(event, null, 2));

    try {
        // Analyze security events from the last hour
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 60 * 60 * 1000); // 1 hour ago

        // Get security events for analysis
        const securityEvents = await getSecurityEvents(startTime, endTime);

        // Perform security analysis
        const analysis = await performSecurityAnalysis(securityEvents);

        // Publish analysis metrics
        await publishAnalysisMetrics(analysis);

        console.log('Security analysis completed:', {
            eventsAnalyzed: securityEvents.length,
            threatsDetected: analysis.threats.length,
            riskScore: analysis.riskScore
        });

        return {
            statusCode: 200,
            body: {
                eventsAnalyzed: securityEvents.length,
                threatsDetected: analysis.threats.length,
                riskScore: analysis.riskScore,
                analysis: analysis
            }
        };

    } catch (error) {
        console.error('Security analysis failed:', error);

        return {
            statusCode: 500,
            body: {
                error: error.message,
                message: 'Security analysis failed'
            }
        };
    }
};

async function getSecurityEvents(startTime, endTime) {
    try {
        const result = await dynamodb.send(new ScanCommand({
            TableName: process.env.SECURITY_EVENT_TABLE,
            FilterExpression: '#timestamp BETWEEN :startTime AND :endTime',
            ExpressionAttributeNames: {
                '#timestamp': 'timestamp'
            },
            ExpressionAttributeValues: {
                ':startTime': { S: startTime.toISOString() },
                ':endTime': { S: endTime.toISOString() }
            }
        }));

        return result.Items?.map(parseSecurityEvent).filter(Boolean) || [];

    } catch (error) {
        console.error('Failed to get security events:', error);
        return [];
    }
}

async function performSecurityAnalysis(events) {
    const analysis = {
        riskScore: 0,
        threats: [],
        patterns: [],
        recommendations: []
    };

    // Analyze event patterns
    const eventsByType = groupEventsByType(events);
    const eventsBySeverity = groupEventsBySeverity(events);
    const eventsBySource = groupEventsBySource(events);

    // Detect suspicious patterns
    analysis.patterns = detectSuspiciousPatterns(events);

    // Identify threats
    analysis.threats = identifyThreats(events, analysis.patterns);

    // Calculate risk score
    analysis.riskScore = calculateRiskScore(events, analysis.threats);

    // Generate recommendations
    analysis.recommendations = generateRecommendations(analysis);

    return analysis;
}

function groupEventsByType(events) {
    return events.reduce((acc, event) => {
        acc[event.eventType] = (acc[event.eventType] || 0) + 1;
        return acc;
    }, {});
}

function groupEventsBySeverity(events) {
    return events.reduce((acc, event) => {
        acc[event.severity] = (acc[event.severity] || 0) + 1;
        return acc;
    }, {});
}

function groupEventsBySource(events) {
    return events.reduce((acc, event) => {
        acc[event.source] = (acc[event.source] || 0) + 1;
        return acc;
    }, {});
}

function detectSuspiciousPatterns(events) {
    const patterns = [];

    // Pattern 1: Multiple failed login attempts
    const failedLogins = events.filter(e => e.eventType === 'SUSPICIOUS_LOGIN');
    if (failedLogins.length > 5) {
        patterns.push({
            type: 'BRUTE_FORCE_ATTACK',
            severity: 'HIGH',
            description: \`\${failedLogins.length} failed login attempts detected\`,
            events: failedLogins.length
        });
    }

    // Pattern 2: Privilege escalation attempts
    const privilegeEvents = events.filter(e => e.eventType === 'PRIVILEGE_ESCALATION');
    if (privilegeEvents.length > 3) {
        patterns.push({
            type: 'PRIVILEGE_ESCALATION_CAMPAIGN',
            severity: 'CRITICAL',
            description: \`\${privilegeEvents.length} privilege escalation attempts detected\`,
            events: privilegeEvents.length
        });
    }

    // Pattern 3: Unusual network activity
    const networkEvents = events.filter(e => e.eventType === 'NETWORK_ANOMALY');
    if (networkEvents.length > 10) {
        patterns.push({
            type: 'NETWORK_RECONNAISSANCE',
            severity: 'MEDIUM',
            description: \`\${networkEvents.length} network anomalies detected\`,
            events: networkEvents.length
        });
    }

    return patterns;
}

function identifyThreats(events, patterns) {
    const threats = [];

    // Convert patterns to threats
    patterns.forEach(pattern => {
        threats.push({
            id: \`threat-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`,
            type: pattern.type,
            severity: pattern.severity,
            description: pattern.description,
            confidence: calculateThreatConfidence(pattern),
            mitigation: getThreatMitigation(pattern.type)
        });
    });

    // Identify individual high-severity events as threats
    const criticalEvents = events.filter(e => e.severity === 'CRITICAL');
    criticalEvents.forEach(event => {
        threats.push({
            id: \`threat-\${event.eventId}\`,
            type: event.eventType,
            severity: 'CRITICAL',
            description: event.description,
            confidence: 0.9,
            mitigation: getThreatMitigation(event.eventType)
        });
    });

    return threats;
}

function calculateThreatConfidence(pattern) {
    // Simple confidence calculation based on pattern type and event count
    const baseConfidence = {
        'BRUTE_FORCE_ATTACK': 0.8,
        'PRIVILEGE_ESCALATION_CAMPAIGN': 0.9,
        'NETWORK_RECONNAISSANCE': 0.6
    };

    const base = baseConfidence[pattern.type] || 0.5;
    const eventMultiplier = Math.min(pattern.events / 10, 1);

    return Math.min(base + (eventMultiplier * 0.2), 1);
}

function getThreatMitigation(threatType) {
    const mitigations = {
        'BRUTE_FORCE_ATTACK': 'Implement account lockout policies and multi-factor authentication',
        'PRIVILEGE_ESCALATION_CAMPAIGN': 'Review and restrict IAM permissions, enable CloudTrail logging',
        'NETWORK_RECONNAISSANCE': 'Review security group rules and enable VPC Flow Logs',
        'UNAUTHORIZED_ACCESS': 'Review access logs and implement additional authentication controls',
        'SUSPICIOUS_LOGIN': 'Investigate login patterns and implement geo-blocking if necessary'
    };

    return mitigations[threatType] || 'Review security policies and implement additional monitoring';
}

function calculateRiskScore(events, threats) {
    let score = 0;

    // Base score from event severity
    events.forEach(event => {
        const severityScores = {
            'CRITICAL': 10,
            'HIGH': 7,
            'MEDIUM': 4,
            'LOW': 1,
            'INFO': 0
        };
        score += severityScores[event.severity] || 0;
    });

    // Additional score from identified threats
    threats.forEach(threat => {
        const threatScores = {
            'CRITICAL': 20,
            'HIGH': 15,
            'MEDIUM': 10,
            'LOW': 5
        };
        score += (threatScores[threat.severity] || 0) * threat.confidence;
    });

    // Normalize to 0-100 scale
    return Math.min(Math.round(score), 100);
}

function generateRecommendations(analysis) {
    const recommendations = [];

    if (analysis.riskScore > 70) {
        recommendations.push({
            priority: 'HIGH',
            action: 'Immediate security review required',
            description: 'High risk score detected, conduct immediate security assessment'
        });
    }

    if (analysis.threats.some(t => t.severity === 'CRITICAL')) {
        recommendations.push({
            priority: 'CRITICAL',
            action: 'Investigate critical threats',
            description: 'Critical security threats detected, immediate investigation required'
        });
    }

    if (analysis.patterns.some(p => p.type === 'BRUTE_FORCE_ATTACK')) {
        recommendations.push({
            priority: 'HIGH',
            action: 'Implement account lockout policies',
            description: 'Brute force attacks detected, strengthen authentication controls'
        });
    }

    return recommendations;
}

async function publishAnalysisMetrics(analysis) {
    try {
        const metrics = [
            {
                MetricName: 'SecurityRiskScore',
                Value: analysis.riskScore,
                Unit: 'None',
                Dimensions: [
                    { Name: 'Environment', Value: process.env.ENVIRONMENT_NAME },
                    { Name: 'Application', Value: process.env.APPLICATION_NAME }
                ]
            },
            {
                MetricName: 'SecurityThreats',
                Value: analysis.threats.length,
                Unit: 'Count',
                Dimensions: [
                    { Name: 'Environment', Value: process.env.ENVIRONMENT_NAME },
                    { Name: 'Application', Value: process.env.APPLICATION_NAME }
                ]
            },
            {
                MetricName: 'SecurityPatterns',
                Value: analysis.patterns.length,
                Unit: 'Count',
                Dimensions: [
                    { Name: 'Environment', Value: process.env.ENVIRONMENT_NAME },
                    { Name: 'Application', Value: process.env.APPLICATION_NAME }
                ]
            }
        ];

        await cloudwatch.send(new PutMetricDataCommand({
            Namespace: 'MacroAI/Security',
            MetricData: metrics
        }));

    } catch (error) {
        console.error('Failed to publish analysis metrics:', error);
    }
}

function parseSecurityEvent(item) {
    if (!item) return null;

    try {
        const event = {
            eventId: item.eventId?.S,
            timestamp: item.timestamp?.S,
            eventType: item.eventType?.S,
            severity: item.severity?.S,
            source: item.source?.S,
            description: item.description?.S
        };

        // Parse metadata
        if (item.metadata?.M) {
            event.metadata = {};
            Object.entries(item.metadata.M).forEach(([key, value]) => {
                try {
                    event.metadata[key] = JSON.parse(value.S);
                } catch {
                    event.metadata[key] = value.S;
                }
            });
        }

        return event;

    } catch (error) {
        console.error('Failed to parse security event:', error);
        return null;
    }
}
`
	}

	/**
	 * Get compliance checker Lambda code
	 */
	private getComplianceCheckerCode(): string {
		return `
const { ConfigServiceClient, GetComplianceDetailsByConfigRuleCommand, DescribeConfigRulesCommand } = require('@aws-sdk/client-config-service');
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

const configService = new ConfigServiceClient();
const dynamodb = new DynamoDBClient();
const cloudwatch = new CloudWatchClient();

exports.handler = async (event) => {
    console.log('Compliance checker event:', JSON.stringify(event, null, 2));

    try {
        // Get all Config rules
        const configRules = await getConfigRules();

        // Check compliance for each rule
        const complianceResults = await checkCompliance(configRules);

        // Process compliance violations
        const violations = complianceResults.filter(result => result.complianceType === 'NON_COMPLIANT');

        // Record violations as security events
        for (const violation of violations) {
            await recordComplianceViolation(violation);
        }

        // Publish compliance metrics
        await publishComplianceMetrics(complianceResults);

        console.log('Compliance check completed:', {
            rulesChecked: complianceResults.length,
            violations: violations.length,
            complianceRate: ((complianceResults.length - violations.length) / complianceResults.length * 100).toFixed(2) + '%'
        });

        return {
            statusCode: 200,
            body: {
                rulesChecked: complianceResults.length,
                violations: violations.length,
                complianceRate: (complianceResults.length - violations.length) / complianceResults.length * 100,
                results: complianceResults
            }
        };

    } catch (error) {
        console.error('Compliance check failed:', error);

        return {
            statusCode: 500,
            body: {
                error: error.message,
                message: 'Compliance check failed'
            }
        };
    }
};

async function getConfigRules() {
    try {
        const result = await configService.send(new DescribeConfigRulesCommand({}));
        return result.ConfigRules || [];
    } catch (error) {
        console.error('Failed to get Config rules:', error);
        return [];
    }
}

async function checkCompliance(configRules) {
    const results = [];

    for (const rule of configRules) {
        try {
            const complianceResult = await configService.send(new GetComplianceDetailsByConfigRuleCommand({
                ConfigRuleName: rule.ConfigRuleName
            }));

            if (complianceResult.EvaluationResults) {
                complianceResult.EvaluationResults.forEach(evaluation => {
                    results.push({
                        ruleName: rule.ConfigRuleName,
                        resourceType: evaluation.EvaluationResultIdentifier?.EvaluationResultQualifier?.ResourceType,
                        resourceId: evaluation.EvaluationResultIdentifier?.EvaluationResultQualifier?.ResourceId,
                        complianceType: evaluation.ComplianceType,
                        resultRecordedTime: evaluation.ResultRecordedTime,
                        annotation: evaluation.Annotation
                    });
                });
            }
        } catch (error) {
            console.error(\`Failed to check compliance for rule \${rule.ConfigRuleName}:\`, error);
        }
    }

    return results;
}

async function recordComplianceViolation(violation) {
    const securityEvent = {
        eventId: \`compliance-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`,
        timestamp: new Date().toISOString(),
        eventType: 'COMPLIANCE_VIOLATION',
        severity: determineViolationSeverity(violation),
        source: 'AWS Config',
        description: \`Compliance violation: \${violation.ruleName}\`,
        metadata: {
            ruleName: violation.ruleName,
            resourceType: violation.resourceType,
            resourceId: violation.resourceId,
            annotation: violation.annotation,
            resultRecordedTime: violation.resultRecordedTime
        }
    };

    const ttl = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60); // 1 year TTL

    const item = {
        eventId: { S: securityEvent.eventId },
        timestamp: { S: securityEvent.timestamp },
        eventType: { S: securityEvent.eventType },
        severity: { S: securityEvent.severity },
        source: { S: securityEvent.source },
        description: { S: securityEvent.description },
        ttl: { N: ttl.toString() }
    };

    // Add metadata
    if (securityEvent.metadata) {
        item.metadata = { M: {} };
        Object.entries(securityEvent.metadata).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                item.metadata.M[key] = { S: value.toString() };
            }
        });
    }

    await dynamodb.send(new PutItemCommand({
        TableName: process.env.SECURITY_EVENT_TABLE,
        Item: item
    }));
}

function determineViolationSeverity(violation) {
    const ruleName = violation.ruleName.toLowerCase();

    // Critical compliance rules
    if (ruleName.includes('encryption') ||
        ruleName.includes('public') ||
        ruleName.includes('security-group') ||
        ruleName.includes('iam')) {
        return 'HIGH';
    }

    // Important compliance rules
    if (ruleName.includes('logging') ||
        ruleName.includes('monitoring') ||
        ruleName.includes('backup')) {
        return 'MEDIUM';
    }

    return 'LOW';
}

async function publishComplianceMetrics(results) {
    try {
        const compliantCount = results.filter(r => r.complianceType === 'COMPLIANT').length;
        const nonCompliantCount = results.filter(r => r.complianceType === 'NON_COMPLIANT').length;
        const complianceRate = results.length > 0 ? (compliantCount / results.length) * 100 : 100;

        const metrics = [
            {
                MetricName: 'ComplianceRate',
                Value: complianceRate,
                Unit: 'Percent',
                Dimensions: [
                    { Name: 'Environment', Value: process.env.ENVIRONMENT_NAME },
                    { Name: 'Application', Value: process.env.APPLICATION_NAME }
                ]
            },
            {
                MetricName: 'ComplianceViolation',
                Value: nonCompliantCount,
                Unit: 'Count',
                Dimensions: [
                    { Name: 'Environment', Value: process.env.ENVIRONMENT_NAME },
                    { Name: 'Application', Value: process.env.APPLICATION_NAME }
                ]
            },
            {
                MetricName: 'CompliantResources',
                Value: compliantCount,
                Unit: 'Count',
                Dimensions: [
                    { Name: 'Environment', Value: process.env.ENVIRONMENT_NAME },
                    { Name: 'Application', Value: process.env.APPLICATION_NAME }
                ]
            }
        ];

        await cloudwatch.send(new PutMetricDataCommand({
            Namespace: 'MacroAI/Security',
            MetricData: metrics
        }));

    } catch (error) {
        console.error('Failed to publish compliance metrics:', error);
    }
}
`
	}
}
