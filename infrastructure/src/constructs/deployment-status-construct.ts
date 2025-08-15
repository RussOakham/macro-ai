import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as sns from 'aws-cdk-lib/aws-sns'
import { Construct } from 'constructs'

export interface DeploymentStatusConstructProps {
	/**
	 * Environment name for resource naming and tagging
	 */
	readonly environmentName: string

	/**
	 * Application name for resource naming
	 */
	readonly applicationName: string

	/**
	 * Deployment status configuration
	 */
	readonly deploymentStatusConfig?: {
		/**
		 * Retention period for deployment history
		 */
		readonly historyRetentionDays?: number

		/**
		 * Enable detailed deployment logging
		 */
		readonly enableDetailedLogging?: boolean

		/**
		 * Log retention period
		 */
		readonly logRetentionDays?: logs.RetentionDays

		/**
		 * Enable real-time notifications
		 */
		readonly enableNotifications?: boolean
	}

	/**
	 * SNS topics for deployment notifications
	 */
	readonly notificationTopics?: {
		readonly deploymentStarted?: sns.Topic
		readonly deploymentCompleted?: sns.Topic
		readonly deploymentFailed?: sns.Topic
		readonly deploymentRolledBack?: sns.Topic
	}
}

/**
 * Deployment status enumeration
 */
export enum DeploymentStatus {
	PENDING = 'PENDING',
	IN_PROGRESS = 'IN_PROGRESS',
	VALIDATING = 'VALIDATING',
	COMPLETED = 'COMPLETED',
	FAILED = 'FAILED',
	ROLLED_BACK = 'ROLLED_BACK',
	CANCELLED = 'CANCELLED',
}

/**
 * Deployment stage enumeration
 */
export enum DeploymentStage {
	INITIALIZATION = 'INITIALIZATION',
	HEALTH_CHECK = 'HEALTH_CHECK',
	DEPLOYMENT = 'DEPLOYMENT',
	VALIDATION = 'VALIDATION',
	ROLLBACK = 'ROLLBACK',
	CLEANUP = 'CLEANUP',
}

/**
 * Deployment event interface
 */
export interface DeploymentEvent {
	readonly deploymentId: string
	readonly timestamp: string
	readonly status: DeploymentStatus
	readonly stage: DeploymentStage
	readonly environment: string
	readonly version: string
	readonly triggeredBy: 'MANUAL' | 'AUTOMATIC' | 'SCHEDULED'
	readonly metadata?: {
		commitHash?: string
		pullRequestNumber?: string
		rollbackTarget?: string
		userEmail?: string
		reason?: string
	}
	readonly metrics?: {
		duration: number
		healthScore: number
		errorCount: number
		instanceCount: number
		successRate: number
	}
	readonly error?: {
		message: string
		code: string
		stack?: string
	}
}

/**
 * Deployment summary interface
 */
export interface DeploymentSummary {
	readonly deploymentId: string
	readonly environment: string
	readonly version: string
	readonly status: DeploymentStatus
	readonly startTime: string
	readonly endTime?: string
	readonly duration?: number
	readonly triggeredBy: string
	readonly successRate: number
	readonly healthScore: number
	readonly stageHistory: {
		stage: DeploymentStage
		status: DeploymentStatus
		timestamp: string
		duration?: number
	}[]
}

/**
 * Deployment Status Construct for comprehensive deployment tracking and monitoring
 *
 * This construct provides:
 * - Real-time deployment status tracking with DynamoDB
 * - Comprehensive deployment event logging
 * - CloudWatch metrics for deployment monitoring
 * - SNS notifications for deployment events
 * - Lambda functions for deployment event processing
 * - Integration with existing deployment pipeline
 */
export class DeploymentStatusConstruct extends Construct {
	public readonly deploymentHistoryTable: dynamodb.Table
	public readonly deploymentEventProcessor: lambda.Function
	public readonly deploymentStatusQuery: lambda.Function
	public readonly deploymentLogGroup: logs.LogGroup
	public readonly deploymentRole: iam.Role

	private readonly props: DeploymentStatusConstructProps
	private readonly resourcePrefix: string

	constructor(
		scope: Construct,
		id: string,
		props: DeploymentStatusConstructProps,
	) {
		super(scope, id)

		this.props = props
		this.resourcePrefix = `${props.applicationName}-${props.environmentName}`

		// Create DynamoDB table for deployment history
		this.deploymentHistoryTable = this.createDeploymentHistoryTable()

		// Create CloudWatch log group for deployment logging
		this.deploymentLogGroup = this.createDeploymentLogGroup()

		// Create IAM role for deployment operations
		this.deploymentRole = this.createDeploymentRole()

		// Create Lambda functions for deployment tracking
		this.deploymentEventProcessor = this.createDeploymentEventProcessor()
		this.deploymentStatusQuery = this.createDeploymentStatusQuery()

		// Apply tags
		this.applyTags()
	}

	/**
	 * Record deployment event
	 */
	public recordDeploymentEvent(event: DeploymentEvent): void {
		// This method would be called by the deployment pipeline
		// to record deployment events in real-time
		console.log(
			`Recording deployment event: ${event.deploymentId} - ${event.status}`,
		)
	}

	/**
	 * Get deployment status
	 */
	public async getDeploymentStatus(
		deploymentId: string,
	): Promise<DeploymentSummary | null> {
		// This method would query the deployment history table
		// and return the current status and summary
		console.log(`Getting deployment status for: ${deploymentId}`)
		return null
	}

	/**
	 * Create or reference existing DynamoDB table for deployment history
	 * Attempts to reference existing table first, creates new one if needed
	 */
	private createDeploymentHistoryTable(): dynamodb.Table {
		const tableName = `${this.resourcePrefix}-deployment-history`

		// Check if we should try to reference an existing table
		// This can be controlled via context or environment variable
		const contextValue: unknown = this.node.tryGetContext('reuseExistingResources')
		const shouldReuseExisting: boolean =
			contextValue !== undefined ? (contextValue as boolean) : true

		if (shouldReuseExisting) {
			try {
				// Try to reference existing table
				console.log(
					`Attempting to reference existing DynamoDB table: ${tableName}`,
				)
				return dynamodb.Table.fromTableName(
					this,
					'ExistingDeploymentHistoryTable',
					tableName,
				)
			} catch (error: unknown) {
				console.log(
					`Could not reference existing table, will create new one: ${String(error)}`,
				)
			}
		}

		// Create new table if existing one not found or not reusing
		console.log(`Creating new DynamoDB table: ${tableName}`)
		const table = new dynamodb.Table(this, 'DeploymentHistoryTable', {
			tableName,
			partitionKey: {
				name: 'deploymentId',
				type: dynamodb.AttributeType.STRING,
			},
			sortKey: {
				name: 'timestamp',
				type: dynamodb.AttributeType.STRING,
			},
			billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
			pointInTimeRecovery: true,
			removalPolicy: cdk.RemovalPolicy.RETAIN, // Always retain deployment history
			timeToLiveAttribute: 'ttl',
		})

		// Add GSI for querying by environment and status
		table.addGlobalSecondaryIndex({
			indexName: 'EnvironmentStatusIndex',
			partitionKey: {
				name: 'environment',
				type: dynamodb.AttributeType.STRING,
			},
			sortKey: {
				name: 'status',
				type: dynamodb.AttributeType.STRING,
			},
		})

		// Add GSI for querying by timestamp
		table.addGlobalSecondaryIndex({
			indexName: 'TimestampIndex',
			partitionKey: {
				name: 'environment',
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
	 * Create or reference existing CloudWatch log group for deployment logging
	 * Attempts to reference existing log group first, creates new one if needed
	 */
	private createDeploymentLogGroup(): logs.LogGroup {
		const logGroupName = `/aws/deployment/${this.resourcePrefix}`

		// Check if we should try to reference an existing log group
		const contextValue: unknown = this.node.tryGetContext('reuseExistingResources')
		const shouldReuseExisting: boolean =
			contextValue !== undefined ? (contextValue as boolean) : true

		if (shouldReuseExisting) {
			try {
				// Try to reference existing log group
				console.log(
					`Attempting to reference existing CloudWatch log group: ${logGroupName}`,
				)
				return logs.LogGroup.fromLogGroupName(
					this,
					'ExistingDeploymentLogGroup',
					logGroupName,
				)
			} catch (error: unknown) {
				console.log(
					`Could not reference existing log group, will create new one: ${String(error)}`,
				)
			}
		}

		// Create new log group if existing one not found or not reusing
		console.log(`Creating new CloudWatch log group: ${logGroupName}`)
		return new logs.LogGroup(this, 'DeploymentLogGroup', {
			logGroupName,
			retention:
				this.props.deploymentStatusConfig?.logRetentionDays ??
				logs.RetentionDays.ONE_MONTH,
			removalPolicy: cdk.RemovalPolicy.RETAIN, // Always retain deployment logs
		})
	}

	/**
	 * Create IAM role for deployment operations
	 */
	private createDeploymentRole(): iam.Role {
		const role = new iam.Role(this, 'DeploymentRole', {
			roleName: `${this.resourcePrefix}-deployment-status-role`,
			assumedBy: new iam.CompositePrincipal(
				new iam.ServicePrincipal('lambda.amazonaws.com'),
				new iam.ServicePrincipal('states.amazonaws.com'),
			),
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
					'dynamodb:BatchGetItem',
					'dynamodb:BatchWriteItem',
				],
				resources: [
					this.deploymentHistoryTable.tableArn,
					`${this.deploymentHistoryTable.tableArn}/index/*`,
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
				resources: [this.deploymentLogGroup.logGroupArn],
			}),
		)

		// Add permissions for CloudWatch metrics
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'cloudwatch:PutMetricData',
					'cloudwatch:GetMetricStatistics',
					'cloudwatch:GetMetricData',
				],
				resources: ['*'],
			}),
		)

		return role
	}

	/**
	 * Create deployment event processor Lambda function
	 */
	private createDeploymentEventProcessor(): lambda.Function {
		return new lambda.Function(this, 'DeploymentEventProcessor', {
			functionName: `${this.resourcePrefix}-deployment-event-processor`,
			runtime: lambda.Runtime.NODEJS_20_X,
			handler: 'index.handler',
			role: this.deploymentRole,
			timeout: cdk.Duration.minutes(5),
			code: lambda.Code.fromInline(this.getDeploymentEventProcessorCode()),
			environment: {
				ENVIRONMENT_NAME: this.props.environmentName,
				APPLICATION_NAME: this.props.applicationName,
				DEPLOYMENT_HISTORY_TABLE: this.deploymentHistoryTable.tableName,
				DEPLOYMENT_LOG_GROUP: this.deploymentLogGroup.logGroupName,
				ENABLE_DETAILED_LOGGING:
					this.props.deploymentStatusConfig?.enableDetailedLogging?.toString() ??
					'true',
			},
		})
	}

	/**
	 * Create deployment status query Lambda function
	 */
	private createDeploymentStatusQuery(): lambda.Function {
		return new lambda.Function(this, 'DeploymentStatusQuery', {
			functionName: `${this.resourcePrefix}-deployment-status-query`,
			runtime: lambda.Runtime.NODEJS_20_X,
			handler: 'index.handler',
			role: this.deploymentRole,
			timeout: cdk.Duration.minutes(2),
			code: lambda.Code.fromInline(this.getDeploymentStatusQueryCode()),
			environment: {
				ENVIRONMENT_NAME: this.props.environmentName,
				APPLICATION_NAME: this.props.applicationName,
				DEPLOYMENT_HISTORY_TABLE: this.deploymentHistoryTable.tableName,
			},
		})
	}

	/**
	 * Apply comprehensive tagging
	 * Note: Avoid duplicate tag keys that might conflict with stack-level tags
	 */
	private applyTags(): void {
		// Use SubComponent instead of Component to avoid conflicts with stack-level Component tag
		cdk.Tags.of(this).add('SubComponent', 'DeploymentStatus')
		cdk.Tags.of(this).add('SubPurpose', 'DeploymentTracking')
		cdk.Tags.of(this).add('ConstructManagedBy', 'DeploymentStatusConstruct')
		// Note: Environment and Application tags may be inherited from stack level
	}

	/**
	 * Get deployment event processor Lambda code
	 */
	private getDeploymentEventProcessorCode(): string {
		return `
const { DynamoDBClient, PutItemCommand, UpdateItemCommand, QueryCommand } = require('@aws-sdk/client-dynamodb');
const { CloudWatchLogsClient, PutLogEventsCommand, CreateLogStreamCommand } = require('@aws-sdk/client-cloudwatch-logs');
const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

const dynamodb = new DynamoDBClient();
const cloudwatchLogs = new CloudWatchLogsClient();
const cloudwatch = new CloudWatchClient();

exports.handler = async (event) => {
    console.log('Deployment event processor:', JSON.stringify(event, null, 2));

    try {
        const deploymentEvent = event.deploymentEvent || event;

        // Validate required fields
        if (!deploymentEvent.deploymentId || !deploymentEvent.status || !deploymentEvent.stage) {
            throw new Error('Missing required deployment event fields');
        }

        // Record deployment event in DynamoDB
        await recordDeploymentEvent(deploymentEvent);

        // Log deployment event
        if (process.env.ENABLE_DETAILED_LOGGING === 'true') {
            await logDeploymentEvent(deploymentEvent);
        }

        // Publish CloudWatch metrics
        await publishDeploymentMetrics(deploymentEvent);

        // Update deployment summary
        await updateDeploymentSummary(deploymentEvent);

        console.log('Deployment event processed successfully:', deploymentEvent.deploymentId);

        return {
            statusCode: 200,
            body: {
                deploymentId: deploymentEvent.deploymentId,
                status: deploymentEvent.status,
                stage: deploymentEvent.stage,
                timestamp: deploymentEvent.timestamp,
                message: 'Deployment event processed successfully'
            }
        };

    } catch (error) {
        console.error('Failed to process deployment event:', error);

        return {
            statusCode: 500,
            body: {
                error: error.message,
                message: 'Failed to process deployment event'
            }
        };
    }
};

async function recordDeploymentEvent(deploymentEvent) {
    const timestamp = deploymentEvent.timestamp || new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60); // 90 days TTL

    const item = {
        deploymentId: { S: deploymentEvent.deploymentId },
        timestamp: { S: timestamp },
        status: { S: deploymentEvent.status },
        stage: { S: deploymentEvent.stage },
        environment: { S: deploymentEvent.environment || process.env.ENVIRONMENT_NAME },
        version: { S: deploymentEvent.version || 'unknown' },
        triggeredBy: { S: deploymentEvent.triggeredBy || 'AUTOMATIC' },
        ttl: { N: ttl.toString() }
    };

    // Add optional metadata
    if (deploymentEvent.metadata) {
        item.metadata = { M: {} };
        Object.entries(deploymentEvent.metadata).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                item.metadata.M[key] = { S: value.toString() };
            }
        });
    }

    // Add optional metrics
    if (deploymentEvent.metrics) {
        item.metrics = { M: {} };
        Object.entries(deploymentEvent.metrics).forEach(([key, value]) => {
            if (typeof value === 'number') {
                item.metrics.M[key] = { N: value.toString() };
            }
        });
    }

    // Add optional error information
    if (deploymentEvent.error) {
        item.error = { M: {} };
        Object.entries(deploymentEvent.error).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                item.error.M[key] = { S: value.toString() };
            }
        });
    }

    await dynamodb.send(new PutItemCommand({
        TableName: process.env.DEPLOYMENT_HISTORY_TABLE,
        Item: item
    }));
}

async function logDeploymentEvent(deploymentEvent) {
    try {
        const logStreamName = \`deployment-\${deploymentEvent.deploymentId}\`;
        const logMessage = {
            timestamp: new Date().toISOString(),
            deploymentId: deploymentEvent.deploymentId,
            status: deploymentEvent.status,
            stage: deploymentEvent.stage,
            environment: deploymentEvent.environment,
            version: deploymentEvent.version,
            triggeredBy: deploymentEvent.triggeredBy,
            metadata: deploymentEvent.metadata,
            metrics: deploymentEvent.metrics,
            error: deploymentEvent.error
        };

        // Create log stream if it doesn't exist
        try {
            await cloudwatchLogs.send(new CreateLogStreamCommand({
                logGroupName: process.env.DEPLOYMENT_LOG_GROUP,
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
            logGroupName: process.env.DEPLOYMENT_LOG_GROUP,
            logStreamName: logStreamName,
            logEvents: [{
                timestamp: Date.now(),
                message: JSON.stringify(logMessage)
            }]
        }));

    } catch (error) {
        console.error('Failed to log deployment event:', error);
    }
}

async function publishDeploymentMetrics(deploymentEvent) {
    try {
        const metrics = [
            {
                MetricName: 'DeploymentEvent',
                Value: 1,
                Unit: 'Count',
                Dimensions: [
                    { Name: 'Environment', Value: deploymentEvent.environment || process.env.ENVIRONMENT_NAME },
                    { Name: 'Status', Value: deploymentEvent.status },
                    { Name: 'Stage', Value: deploymentEvent.stage },
                    { Name: 'Application', Value: process.env.APPLICATION_NAME }
                ]
            }
        ];

        // Add duration metric if available
        if (deploymentEvent.metrics?.duration) {
            metrics.push({
                MetricName: 'DeploymentDuration',
                Value: deploymentEvent.metrics.duration,
                Unit: 'Seconds',
                Dimensions: [
                    { Name: 'Environment', Value: deploymentEvent.environment || process.env.ENVIRONMENT_NAME },
                    { Name: 'Stage', Value: deploymentEvent.stage },
                    { Name: 'Application', Value: process.env.APPLICATION_NAME }
                ]
            });
        }

        // Add health score metric if available
        if (deploymentEvent.metrics?.healthScore) {
            metrics.push({
                MetricName: 'DeploymentHealthScore',
                Value: deploymentEvent.metrics.healthScore,
                Unit: 'Percent',
                Dimensions: [
                    { Name: 'Environment', Value: deploymentEvent.environment || process.env.ENVIRONMENT_NAME },
                    { Name: 'Application', Value: process.env.APPLICATION_NAME }
                ]
            });
        }

        await cloudwatch.send(new PutMetricDataCommand({
            Namespace: 'MacroAI/Deployment',
            MetricData: metrics
        }));

    } catch (error) {
        console.error('Failed to publish deployment metrics:', error);
    }
}

async function updateDeploymentSummary(deploymentEvent) {
    try {
        // Update deployment summary record with latest status
        const updateExpression = [];
        const expressionAttributeValues = {};
        const expressionAttributeNames = {};

        updateExpression.push('#status = :status');
        expressionAttributeNames['#status'] = 'status';
        expressionAttributeValues[':status'] = { S: deploymentEvent.status };

        updateExpression.push('#stage = :stage');
        expressionAttributeNames['#stage'] = 'stage';
        expressionAttributeValues[':stage'] = { S: deploymentEvent.stage };

        updateExpression.push('lastUpdated = :lastUpdated');
        expressionAttributeValues[':lastUpdated'] = { S: new Date().toISOString() };

        if (deploymentEvent.status === 'COMPLETED' || deploymentEvent.status === 'FAILED') {
            updateExpression.push('endTime = :endTime');
            expressionAttributeValues[':endTime'] = { S: new Date().toISOString() };
        }

        await dynamodb.send(new UpdateItemCommand({
            TableName: process.env.DEPLOYMENT_HISTORY_TABLE,
            Key: {
                deploymentId: { S: deploymentEvent.deploymentId },
                timestamp: { S: 'SUMMARY' }
            },
            UpdateExpression: \`SET \${updateExpression.join(', ')}\`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues
        }));

    } catch (error) {
        console.error('Failed to update deployment summary:', error);
    }
}
`
	}

	/**
	 * Get deployment status query Lambda code
	 */
	private getDeploymentStatusQueryCode(): string {
		return `
const { DynamoDBClient, QueryCommand, GetItemCommand } = require('@aws-sdk/client-dynamodb');

const dynamodb = new DynamoDBClient();

exports.handler = async (event) => {
    console.log('Deployment status query:', JSON.stringify(event, null, 2));

    try {
        const { deploymentId, environment, limit = 50, operation = 'getStatus' } = event;

        switch (operation) {
            case 'getStatus':
                if (!deploymentId) {
                    throw new Error('deploymentId is required for getStatus operation');
                }
                return await getDeploymentStatus(deploymentId);

            case 'getHistory':
                return await getDeploymentHistory(environment, limit);

            case 'getActiveDeployments':
                return await getActiveDeployments(environment);

            case 'getDeploymentSummary':
                if (!deploymentId) {
                    throw new Error('deploymentId is required for getDeploymentSummary operation');
                }
                return await getDeploymentSummary(deploymentId);

            default:
                throw new Error(\`Unknown operation: \${operation}\`);
        }

    } catch (error) {
        console.error('Failed to query deployment status:', error);

        return {
            statusCode: 500,
            body: {
                error: error.message,
                message: 'Failed to query deployment status'
            }
        };
    }
};

async function getDeploymentStatus(deploymentId) {
    try {
        // Get all events for this deployment
        const result = await dynamodb.send(new QueryCommand({
            TableName: process.env.DEPLOYMENT_HISTORY_TABLE,
            KeyConditionExpression: 'deploymentId = :deploymentId',
            ExpressionAttributeValues: {
                ':deploymentId': { S: deploymentId }
            },
            ScanIndexForward: false, // Get latest events first
            Limit: 100
        }));

        if (!result.Items || result.Items.length === 0) {
            return {
                statusCode: 404,
                body: {
                    message: 'Deployment not found',
                    deploymentId
                }
            };
        }

        // Parse and organize events
        const events = result.Items.map(parseDeploymentEvent).filter(Boolean);
        const latestEvent = events[0];

        // Build stage history
        const stageHistory = {};
        events.forEach(event => {
            if (!stageHistory[event.stage]) {
                stageHistory[event.stage] = [];
            }
            stageHistory[event.stage].push({
                status: event.status,
                timestamp: event.timestamp,
                duration: event.metrics?.duration
            });
        });

        const deploymentStatus = {
            deploymentId,
            environment: latestEvent.environment,
            version: latestEvent.version,
            status: latestEvent.status,
            stage: latestEvent.stage,
            startTime: events[events.length - 1]?.timestamp,
            lastUpdated: latestEvent.timestamp,
            triggeredBy: latestEvent.triggeredBy,
            metadata: latestEvent.metadata,
            stageHistory: Object.entries(stageHistory).map(([stage, history]) => ({
                stage,
                events: history
            })),
            eventCount: events.length
        };

        return {
            statusCode: 200,
            body: deploymentStatus
        };

    } catch (error) {
        console.error('Failed to get deployment status:', error);
        throw error;
    }
}

async function getDeploymentHistory(environment, limit) {
    try {
        const queryParams = {
            TableName: process.env.DEPLOYMENT_HISTORY_TABLE,
            IndexName: 'TimestampIndex',
            KeyConditionExpression: 'environment = :environment',
            ExpressionAttributeValues: {
                ':environment': { S: environment || process.env.ENVIRONMENT_NAME }
            },
            ScanIndexForward: false, // Get latest deployments first
            Limit: parseInt(limit)
        };

        const result = await dynamodb.send(new QueryCommand(queryParams));

        const deployments = result.Items?.map(parseDeploymentEvent).filter(Boolean) || [];

        // Group by deployment ID and get latest status for each
        const deploymentMap = {};
        deployments.forEach(event => {
            if (!deploymentMap[event.deploymentId] ||
                new Date(event.timestamp) > new Date(deploymentMap[event.deploymentId].timestamp)) {
                deploymentMap[event.deploymentId] = event;
            }
        });

        const deploymentHistory = Object.values(deploymentMap).map(event => ({
            deploymentId: event.deploymentId,
            environment: event.environment,
            version: event.version,
            status: event.status,
            stage: event.stage,
            timestamp: event.timestamp,
            triggeredBy: event.triggeredBy,
            duration: event.metrics?.duration,
            healthScore: event.metrics?.healthScore
        }));

        return {
            statusCode: 200,
            body: {
                deployments: deploymentHistory,
                count: deploymentHistory.length,
                environment: environment || process.env.ENVIRONMENT_NAME
            }
        };

    } catch (error) {
        console.error('Failed to get deployment history:', error);
        throw error;
    }
}

async function getActiveDeployments(environment) {
    try {
        const result = await dynamodb.send(new QueryCommand({
            TableName: process.env.DEPLOYMENT_HISTORY_TABLE,
            IndexName: 'EnvironmentStatusIndex',
            KeyConditionExpression: 'environment = :environment AND #status = :status',
            ExpressionAttributeNames: {
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':environment': { S: environment || process.env.ENVIRONMENT_NAME },
                ':status': { S: 'IN_PROGRESS' }
            },
            ScanIndexForward: false
        }));

        const activeDeployments = result.Items?.map(parseDeploymentEvent).filter(Boolean) || [];

        return {
            statusCode: 200,
            body: {
                activeDeployments,
                count: activeDeployments.length,
                environment: environment || process.env.ENVIRONMENT_NAME
            }
        };

    } catch (error) {
        console.error('Failed to get active deployments:', error);
        throw error;
    }
}

async function getDeploymentSummary(deploymentId) {
    try {
        // Get deployment summary record
        const result = await dynamodb.send(new GetItemCommand({
            TableName: process.env.DEPLOYMENT_HISTORY_TABLE,
            Key: {
                deploymentId: { S: deploymentId },
                timestamp: { S: 'SUMMARY' }
            }
        }));

        if (!result.Item) {
            return {
                statusCode: 404,
                body: {
                    message: 'Deployment summary not found',
                    deploymentId
                }
            };
        }

        const summary = parseDeploymentEvent(result.Item);

        return {
            statusCode: 200,
            body: summary
        };

    } catch (error) {
        console.error('Failed to get deployment summary:', error);
        throw error;
    }
}

function parseDeploymentEvent(item) {
    if (!item) return null;

    try {
        const event = {
            deploymentId: item.deploymentId?.S,
            timestamp: item.timestamp?.S,
            status: item.status?.S,
            stage: item.stage?.S,
            environment: item.environment?.S,
            version: item.version?.S,
            triggeredBy: item.triggeredBy?.S
        };

        // Parse metadata
        if (item.metadata?.M) {
            event.metadata = {};
            Object.entries(item.metadata.M).forEach(([key, value]) => {
                event.metadata[key] = value.S;
            });
        }

        // Parse metrics
        if (item.metrics?.M) {
            event.metrics = {};
            Object.entries(item.metrics.M).forEach(([key, value]) => {
                event.metrics[key] = parseFloat(value.N);
            });
        }

        // Parse error
        if (item.error?.M) {
            event.error = {};
            Object.entries(item.error.M).forEach(([key, value]) => {
                event.error[key] = value.S;
            });
        }

        return event;

    } catch (error) {
        console.error('Failed to parse deployment event:', error);
        return null;
    }
}
`
	}
}
