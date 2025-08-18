import * as cdk from 'aws-cdk-lib'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as sns from 'aws-cdk-lib/aws-sns'
import { Construct } from 'constructs'

export interface AdvancedHealthCheckConstructProps {
	/**
	 * Environment name for resource naming and tagging
	 */
	readonly environmentName: string

	/**
	 * Application name for resource naming
	 */
	readonly applicationName: string

	/**
	 * VPC for health check resources
	 */
	readonly vpc: ec2.IVpc

	/**
	 * Target groups to monitor
	 */
	readonly targetGroups: elbv2.ApplicationTargetGroup[]

	/**
	 * Health check configuration
	 */
	readonly healthCheckConfig?: {
		/**
		 * Application health check endpoints
		 */
		readonly applicationEndpoints?: {
			path: string
			expectedStatusCode?: number
			timeout?: cdk.Duration
			expectedResponsePattern?: string
		}[]

		/**
		 * External service dependencies to validate
		 */
		readonly externalDependencies?: {
			name: string
			endpoint: string
			timeout?: cdk.Duration
			critical?: boolean
		}[]

		/**
		 * Performance thresholds
		 */
		readonly performanceThresholds?: {
			maxResponseTime: cdk.Duration
			minThroughput: number
			maxErrorRate: number
		}

		/**
		 * Health check frequency
		 */
		readonly checkInterval?: cdk.Duration

		/**
		 * Number of consecutive failures before marking unhealthy
		 */
		readonly failureThreshold?: number

		/**
		 * Number of consecutive successes before marking healthy
		 */
		readonly successThreshold?: number
	}

	/**
	 * SNS topics for health check notifications
	 */
	readonly notificationTopics?: {
		readonly healthDegraded?: sns.Topic
		readonly healthRestored?: sns.Topic
		readonly criticalFailure?: sns.Topic
	}
}

/**
 * Health check result interface
 */
export interface HealthCheckResult {
	readonly isHealthy: boolean
	readonly status: 'healthy' | 'degraded' | 'unhealthy'
	readonly timestamp: string
	readonly checks: {
		readonly application: ApplicationHealthResult
		readonly dependencies: DependencyHealthResult
		readonly performance: PerformanceHealthResult
		readonly infrastructure: InfrastructureHealthResult
	}
	readonly summary: {
		readonly totalChecks: number
		readonly passedChecks: number
		readonly failedChecks: number
		readonly degradedChecks: number
	}
}

export interface ApplicationHealthResult {
	readonly status: 'healthy' | 'degraded' | 'unhealthy'
	readonly endpoints: {
		path: string
		status: 'healthy' | 'unhealthy'
		responseTime: number
		statusCode?: number
		error?: string
	}[]
}

export interface DependencyHealthResult {
	readonly status: 'healthy' | 'degraded' | 'unhealthy'
	readonly services: {
		name: string
		status: 'healthy' | 'unhealthy'
		responseTime: number
		critical: boolean
		error?: string
	}[]
}

export interface PerformanceHealthResult {
	readonly status: 'healthy' | 'degraded' | 'unhealthy'
	readonly metrics: {
		avgResponseTime: number
		throughput: number
		errorRate: number
		p95ResponseTime: number
	}
	readonly thresholds: {
		maxResponseTime: number
		minThroughput: number
		maxErrorRate: number
	}
}

export interface InfrastructureHealthResult {
	readonly status: 'healthy' | 'degraded' | 'unhealthy'
	readonly targetGroups: {
		arn: string
		healthyTargets: number
		totalTargets: number
		healthyPercentage: number
	}[]
	readonly loadBalancer: {
		status: 'healthy' | 'unhealthy'
		activeConnections: number
		requestCount: number
	}
}

/**
 * Advanced Health Check Construct for comprehensive deployment health validation
 *
 * This construct provides multi-layered health validation including:
 * - Application endpoint health checks with custom validation
 * - External service dependency validation
 * - Performance threshold monitoring
 * - Infrastructure health validation
 * - Real-time health status tracking and alerting
 */
export class AdvancedHealthCheckConstruct extends Construct {
	public readonly healthCheckFunction: lambda.Function
	public readonly applicationHealthValidator: lambda.Function
	public readonly dependencyHealthValidator: lambda.Function
	public readonly performanceHealthValidator: lambda.Function
	public readonly healthCheckRole: iam.Role
	public readonly healthCheckAlarms: cloudwatch.Alarm[]

	private readonly props: AdvancedHealthCheckConstructProps
	private readonly resourcePrefix: string

	constructor(
		scope: Construct,
		id: string,
		props: AdvancedHealthCheckConstructProps,
	) {
		super(scope, id)

		this.props = props
		this.resourcePrefix = `${props.applicationName}-${props.environmentName}`
		this.healthCheckAlarms = []

		// Create IAM role for health check operations
		this.healthCheckRole = this.createHealthCheckRole()

		// Create individual health validator functions
		this.applicationHealthValidator = this.createApplicationHealthValidator()
		this.dependencyHealthValidator = this.createDependencyHealthValidator()
		this.performanceHealthValidator = this.createPerformanceHealthValidator()

		// Create orchestrator health check function
		this.healthCheckFunction = this.createHealthCheckOrchestrator()

		// Create health check alarms
		this.createHealthCheckAlarms()

		// Apply tags
		this.applyTags()
	}

	/**
	 * Trigger comprehensive health check
	 */
	public async triggerHealthCheck(): Promise<HealthCheckResult> {
		// This would be implemented to invoke the health check function
		// For now, return a placeholder
		return {
			isHealthy: true,
			status: 'healthy',
			timestamp: new Date().toISOString(),
			checks: {
				application: {
					status: 'healthy',
					endpoints: [],
				},
				dependencies: {
					status: 'healthy',
					services: [],
				},
				performance: {
					status: 'healthy',
					metrics: {
						avgResponseTime: 0,
						throughput: 0,
						errorRate: 0,
						p95ResponseTime: 0,
					},
					thresholds: {
						maxResponseTime: 2000,
						minThroughput: 10,
						maxErrorRate: 5,
					},
				},
				infrastructure: {
					status: 'healthy',
					targetGroups: [],
					loadBalancer: {
						status: 'healthy',
						activeConnections: 0,
						requestCount: 0,
					},
				},
			},
			summary: {
				totalChecks: 0,
				passedChecks: 0,
				failedChecks: 0,
				degradedChecks: 0,
			},
		}
	}

	/**
	 * Create IAM role for health check operations
	 */
	private createHealthCheckRole(): iam.Role {
		const role = new iam.Role(this, 'HealthCheckRole', {
			roleName: `${this.resourcePrefix}-advanced-health-check-role`,
			assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
			managedPolicies: [
				iam.ManagedPolicy.fromAwsManagedPolicyName(
					'service-role/AWSLambdaBasicExecutionRole',
				),
				iam.ManagedPolicy.fromAwsManagedPolicyName(
					'service-role/AWSLambdaVPCAccessExecutionRole',
				),
			],
		})

		// Add permissions for CloudWatch metrics
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'cloudwatch:GetMetricStatistics',
					'cloudwatch:GetMetricData',
					'cloudwatch:ListMetrics',
					'cloudwatch:PutMetricData',
				],
				resources: ['*'],
			}),
		)

		// Add permissions for ELB operations
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'elasticloadbalancing:DescribeTargetGroups',
					'elasticloadbalancing:DescribeTargetHealth',
					'elasticloadbalancing:DescribeLoadBalancers',
				],
				resources: ['*'],
			}),
		)

		// Add permissions for Lambda invocation (for orchestration)
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: ['lambda:InvokeFunction'],
				resources: [
					`arn:aws:lambda:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:function:${this.resourcePrefix}-*`,
				],
			}),
		)

		return role
	}

	/**
	 * Create application health validator function
	 */
	private createApplicationHealthValidator(): lambda.Function {
		return new lambda.Function(this, 'ApplicationHealthValidator', {
			functionName: `${this.resourcePrefix}-app-health-validator`,
			runtime: lambda.Runtime.NODEJS_20_X,
			handler: 'index.handler',
			role: this.healthCheckRole,
			timeout: cdk.Duration.minutes(2),
			vpc: this.props.vpc,
			code: lambda.Code.fromInline(this.getApplicationHealthValidatorCode()),
			environment: {
				ENVIRONMENT_NAME: this.props.environmentName,
				APPLICATION_NAME: this.props.applicationName,
			},
		})
	}

	/**
	 * Create dependency health validator function
	 */
	private createDependencyHealthValidator(): lambda.Function {
		return new lambda.Function(this, 'DependencyHealthValidator', {
			functionName: `${this.resourcePrefix}-dependency-health-validator`,
			runtime: lambda.Runtime.NODEJS_20_X,
			handler: 'index.handler',
			role: this.healthCheckRole,
			timeout: cdk.Duration.minutes(2),
			code: lambda.Code.fromInline(this.getDependencyHealthValidatorCode()),
			environment: {
				ENVIRONMENT_NAME: this.props.environmentName,
				APPLICATION_NAME: this.props.applicationName,
			},
		})
	}

	/**
	 * Create performance health validator function
	 */
	private createPerformanceHealthValidator(): lambda.Function {
		return new lambda.Function(this, 'PerformanceHealthValidator', {
			functionName: `${this.resourcePrefix}-performance-health-validator`,
			runtime: lambda.Runtime.NODEJS_20_X,
			handler: 'index.handler',
			role: this.healthCheckRole,
			timeout: cdk.Duration.minutes(2),
			code: lambda.Code.fromInline(this.getPerformanceHealthValidatorCode()),
			environment: {
				ENVIRONMENT_NAME: this.props.environmentName,
				APPLICATION_NAME: this.props.applicationName,
			},
		})
	}

	/**
	 * Create health check orchestrator function
	 */
	private createHealthCheckOrchestrator(): lambda.Function {
		return new lambda.Function(this, 'HealthCheckOrchestrator', {
			functionName: `${this.resourcePrefix}-health-check-orchestrator`,
			runtime: lambda.Runtime.NODEJS_20_X,
			handler: 'index.handler',
			role: this.healthCheckRole,
			timeout: cdk.Duration.minutes(5),
			vpc: this.props.vpc,
			code: lambda.Code.fromInline(this.getHealthCheckOrchestratorCode()),
			environment: {
				ENVIRONMENT_NAME: this.props.environmentName,
				APPLICATION_NAME: this.props.applicationName,
				APP_HEALTH_VALIDATOR_ARN: this.applicationHealthValidator.functionArn,
				DEPENDENCY_HEALTH_VALIDATOR_ARN:
					this.dependencyHealthValidator.functionArn,
				PERFORMANCE_HEALTH_VALIDATOR_ARN:
					this.performanceHealthValidator.functionArn,
				TARGET_GROUP_ARNS: this.props.targetGroups
					.map((tg) => tg.targetGroupArn)
					.join(','),
			},
		})
	}

	/**
	 * Create health check alarms
	 */
	private createHealthCheckAlarms(): void {
		// Overall health status alarm
		const healthStatusAlarm = new cloudwatch.Alarm(this, 'HealthStatusAlarm', {
			alarmName: `${this.resourcePrefix}-health-status-alarm`,
			metric: new cloudwatch.Metric({
				namespace: 'MacroAI/HealthCheck',
				metricName: 'OverallHealthStatus',
				dimensionsMap: {
					Environment: this.props.environmentName,
					Application: this.props.applicationName,
				},
				statistic: 'Average',
				period: cdk.Duration.minutes(1),
			}),
			threshold: 0.5, // 0 = unhealthy, 1 = healthy
			comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
			evaluationPeriods: 3,
			alarmDescription: 'Overall application health is degraded',
		})

		// Application endpoint health alarm
		const appHealthAlarm = new cloudwatch.Alarm(
			this,
			'ApplicationHealthAlarm',
			{
				alarmName: `${this.resourcePrefix}-application-health-alarm`,
				metric: new cloudwatch.Metric({
					namespace: 'MacroAI/HealthCheck',
					metricName: 'ApplicationHealthStatus',
					dimensionsMap: {
						Environment: this.props.environmentName,
						Application: this.props.applicationName,
					},
					statistic: 'Average',
					period: cdk.Duration.minutes(1),
				}),
				threshold: 0.5,
				comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
				evaluationPeriods: 2,
				alarmDescription: 'Application endpoints are unhealthy',
			},
		)

		// Dependency health alarm
		const dependencyHealthAlarm = new cloudwatch.Alarm(
			this,
			'DependencyHealthAlarm',
			{
				alarmName: `${this.resourcePrefix}-dependency-health-alarm`,
				metric: new cloudwatch.Metric({
					namespace: 'MacroAI/HealthCheck',
					metricName: 'DependencyHealthStatus',
					dimensionsMap: {
						Environment: this.props.environmentName,
						Application: this.props.applicationName,
					},
					statistic: 'Average',
					period: cdk.Duration.minutes(1),
				}),
				threshold: 0.5,
				comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
				evaluationPeriods: 3,
				alarmDescription: 'External dependencies are unhealthy',
			},
		)

		// Performance health alarm
		const performanceHealthAlarm = new cloudwatch.Alarm(
			this,
			'PerformanceHealthAlarm',
			{
				alarmName: `${this.resourcePrefix}-performance-health-alarm`,
				metric: new cloudwatch.Metric({
					namespace: 'MacroAI/HealthCheck',
					metricName: 'PerformanceHealthStatus',
					dimensionsMap: {
						Environment: this.props.environmentName,
						Application: this.props.applicationName,
					},
					statistic: 'Average',
					period: cdk.Duration.minutes(1),
				}),
				threshold: 0.5,
				comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
				evaluationPeriods: 2,
				alarmDescription: 'Application performance is degraded',
			},
		)

		this.healthCheckAlarms.push(
			healthStatusAlarm,
			appHealthAlarm,
			dependencyHealthAlarm,
			performanceHealthAlarm,
		)

		// Add SNS actions if notification topics are provided
		if (this.props.notificationTopics?.healthDegraded) {
			const snsAction = new cloudwatchActions.SnsAction(
				this.props.notificationTopics.healthDegraded,
			)
			healthStatusAlarm.addAlarmAction(snsAction)
			appHealthAlarm.addAlarmAction(snsAction)
			dependencyHealthAlarm.addAlarmAction(snsAction)
			performanceHealthAlarm.addAlarmAction(snsAction)
		}
	}

	/**
	 * Apply comprehensive tagging
	 */
	private applyTags(): void {
		cdk.Tags.of(this).add('Environment', this.props.environmentName)
		cdk.Tags.of(this).add('Application', this.props.applicationName)
		cdk.Tags.of(this).add('Component', 'AdvancedHealthCheck')
		cdk.Tags.of(this).add('Purpose', 'HealthValidation')
		cdk.Tags.of(this).add('ManagedBy', 'AdvancedHealthCheckConstruct')
	}

	/**
	 * Get application health validator Lambda code
	 */
	private getApplicationHealthValidatorCode(): string {
		return `
const https = require('https');
const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

const cloudwatch = new CloudWatchClient();

exports.handler = async (event) => {
    console.log('Application health validator event:', JSON.stringify(event, null, 2));

    const { endpoints = [], baseUrl } = event;
    const results = [];

    for (const endpoint of endpoints) {
        const startTime = Date.now();
        try {
            const result = await checkEndpoint(baseUrl, endpoint);
            const responseTime = Date.now() - startTime;

            results.push({
                path: endpoint.path,
                status: result.success ? 'healthy' : 'unhealthy',
                responseTime,
                statusCode: result.statusCode,
                error: result.error
            });

            // Publish metrics
            await publishMetric('ApplicationEndpointHealth', result.success ? 1 : 0, {
                Endpoint: endpoint.path,
                Environment: process.env.ENVIRONMENT_NAME,
                Application: process.env.APPLICATION_NAME
            });

            await publishMetric('ApplicationEndpointResponseTime', responseTime, {
                Endpoint: endpoint.path,
                Environment: process.env.ENVIRONMENT_NAME,
                Application: process.env.APPLICATION_NAME
            }, 'Milliseconds');

        } catch (error) {
            const responseTime = Date.now() - startTime;
            results.push({
                path: endpoint.path,
                status: 'unhealthy',
                responseTime,
                error: error.message
            });
        }
    }

    const healthyEndpoints = results.filter(r => r.status === 'healthy').length;
    const totalEndpoints = results.length;
    const healthyPercentage = totalEndpoints > 0 ? (healthyEndpoints / totalEndpoints) : 1;

    let overallStatus = 'healthy';
    if (healthyPercentage < 0.5) {
        overallStatus = 'unhealthy';
    } else if (healthyPercentage < 1.0) {
        overallStatus = 'degraded';
    }

    // Publish overall application health metric
    await publishMetric('ApplicationHealthStatus', overallStatus === 'healthy' ? 1 : 0, {
        Environment: process.env.ENVIRONMENT_NAME,
        Application: process.env.APPLICATION_NAME
    });

    return {
        status: overallStatus,
        endpoints: results,
        summary: {
            total: totalEndpoints,
            healthy: healthyEndpoints,
            unhealthy: totalEndpoints - healthyEndpoints
        }
    };
};

async function checkEndpoint(baseUrl, endpoint) {
    return new Promise((resolve) => {
        const url = \`\${baseUrl}\${endpoint.path}\`;
        const timeout = endpoint.timeout || 5000;

        const req = https.get(url, { timeout }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const expectedStatus = endpoint.expectedStatusCode || 200;
                const success = res.statusCode === expectedStatus;

                // Check response pattern if specified
                if (success && endpoint.expectedResponsePattern) {
                    const pattern = new RegExp(endpoint.expectedResponsePattern);
                    if (!pattern.test(data)) {
                        resolve({ success: false, statusCode: res.statusCode, error: 'Response pattern mismatch' });
                        return;
                    }
                }

                resolve({ success, statusCode: res.statusCode });
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ success: false, error: 'Request timeout' });
        });

        req.on('error', (error) => {
            resolve({ success: false, error: error.message });
        });
    });
}

async function publishMetric(metricName, value, dimensions, unit = 'Count') {
    try {
        await cloudwatch.send(new PutMetricDataCommand({
            Namespace: 'MacroAI/HealthCheck',
            MetricData: [{
                MetricName: metricName,
                Value: value,
                Unit: unit,
                Timestamp: new Date(),
                Dimensions: Object.entries(dimensions).map(([Name, Value]) => ({ Name, Value }))
            }]
        }));
    } catch (error) {
        console.error('Failed to publish metric:', error);
    }
}
`
	}

	/**
	 * Get dependency health validator Lambda code
	 */
	private getDependencyHealthValidatorCode(): string {
		return `
const https = require('https');
const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

const cloudwatch = new CloudWatchClient();

exports.handler = async (event) => {
    console.log('Dependency health validator event:', JSON.stringify(event, null, 2));

    const { dependencies = [] } = event;
    const results = [];

    for (const dependency of dependencies) {
        const startTime = Date.now();
        try {
            const result = await checkDependency(dependency);
            const responseTime = Date.now() - startTime;

            results.push({
                name: dependency.name,
                status: result.success ? 'healthy' : 'unhealthy',
                responseTime,
                critical: dependency.critical || false,
                error: result.error
            });

            // Publish metrics
            await publishMetric('DependencyHealth', result.success ? 1 : 0, {
                Dependency: dependency.name,
                Critical: dependency.critical ? 'true' : 'false',
                Environment: process.env.ENVIRONMENT_NAME,
                Application: process.env.APPLICATION_NAME
            });

            await publishMetric('DependencyResponseTime', responseTime, {
                Dependency: dependency.name,
                Environment: process.env.ENVIRONMENT_NAME,
                Application: process.env.APPLICATION_NAME
            }, 'Milliseconds');

        } catch (error) {
            const responseTime = Date.now() - startTime;
            results.push({
                name: dependency.name,
                status: 'unhealthy',
                responseTime,
                critical: dependency.critical || false,
                error: error.message
            });
        }
    }

    // Determine overall dependency health
    const criticalDependencies = results.filter(r => r.critical);
    const healthyCritical = criticalDependencies.filter(r => r.status === 'healthy').length;
    const totalCritical = criticalDependencies.length;

    const allDependencies = results.length;
    const healthyAll = results.filter(r => r.status === 'healthy').length;

    let overallStatus = 'healthy';

    // If any critical dependency is unhealthy, overall status is unhealthy
    if (totalCritical > 0 && healthyCritical < totalCritical) {
        overallStatus = 'unhealthy';
    } else if (allDependencies > 0 && healthyAll < allDependencies) {
        // If non-critical dependencies are unhealthy, status is degraded
        overallStatus = 'degraded';
    }

    // Publish overall dependency health metric
    await publishMetric('DependencyHealthStatus', overallStatus === 'healthy' ? 1 : 0, {
        Environment: process.env.ENVIRONMENT_NAME,
        Application: process.env.APPLICATION_NAME
    });

    return {
        status: overallStatus,
        services: results,
        summary: {
            total: allDependencies,
            healthy: healthyAll,
            unhealthy: allDependencies - healthyAll,
            critical: totalCritical,
            healthyCritical
        }
    };
};

async function checkDependency(dependency) {
    return new Promise((resolve) => {
        const timeout = dependency.timeout || 10000;

        const req = https.get(dependency.endpoint, { timeout }, (res) => {
            res.on('data', () => {}); // Consume response data
            res.on('end', () => {
                const success = res.statusCode >= 200 && res.statusCode < 400;
                resolve({ success, statusCode: res.statusCode });
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ success: false, error: 'Request timeout' });
        });

        req.on('error', (error) => {
            resolve({ success: false, error: error.message });
        });
    });
}

async function publishMetric(metricName, value, dimensions, unit = 'Count') {
    try {
        await cloudwatch.send(new PutMetricDataCommand({
            Namespace: 'MacroAI/HealthCheck',
            MetricData: [{
                MetricName: metricName,
                Value: value,
                Unit: unit,
                Timestamp: new Date(),
                Dimensions: Object.entries(dimensions).map(([Name, Value]) => ({ Name, Value }))
            }]
        }));
    } catch (error) {
        console.error('Failed to publish metric:', error);
    }
}
`
	}

	/**
	 * Get performance health validator Lambda code
	 */
	private getPerformanceHealthValidatorCode(): string {
		return `
const { CloudWatchClient, GetMetricStatisticsCommand, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

const cloudwatch = new CloudWatchClient();

exports.handler = async (event) => {
    console.log('Performance health validator event:', JSON.stringify(event, null, 2));

    const { thresholds, targetGroupArns = [] } = event;
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 5 * 60 * 1000); // 5 minutes ago

    const metrics = {
        avgResponseTime: 0,
        throughput: 0,
        errorRate: 0,
        p95ResponseTime: 0
    };

    try {
        // Get response time metrics
        for (const targetGroupArn of targetGroupArns) {
            const targetGroupName = targetGroupArn.split('/').slice(-2).join('/');

            // Average response time
            const avgResponseTimeResult = await cloudwatch.send(new GetMetricStatisticsCommand({
                Namespace: 'AWS/ApplicationELB',
                MetricName: 'TargetResponseTime',
                Dimensions: [{ Name: 'TargetGroup', Value: targetGroupName }],
                StartTime: startTime,
                EndTime: endTime,
                Period: 300,
                Statistics: ['Average']
            }));

            if (avgResponseTimeResult.Datapoints && avgResponseTimeResult.Datapoints.length > 0) {
                const avgTime = avgResponseTimeResult.Datapoints.reduce((sum, dp) => sum + (dp.Average || 0), 0) / avgResponseTimeResult.Datapoints.length;
                metrics.avgResponseTime = Math.max(metrics.avgResponseTime, avgTime * 1000); // Convert to ms
            }

            // Request count (throughput)
            const requestCountResult = await cloudwatch.send(new GetMetricStatisticsCommand({
                Namespace: 'AWS/ApplicationELB',
                MetricName: 'RequestCount',
                Dimensions: [{ Name: 'TargetGroup', Value: targetGroupName }],
                StartTime: startTime,
                EndTime: endTime,
                Period: 300,
                Statistics: ['Sum']
            }));

            if (requestCountResult.Datapoints && requestCountResult.Datapoints.length > 0) {
                const totalRequests = requestCountResult.Datapoints.reduce((sum, dp) => sum + (dp.Sum || 0), 0);
                metrics.throughput += totalRequests / 300; // Requests per second
            }

            // Error rate
            const errorCountResult = await cloudwatch.send(new GetMetricStatisticsCommand({
                Namespace: 'AWS/ApplicationELB',
                MetricName: 'HTTPCode_Target_5XX_Count',
                Dimensions: [{ Name: 'TargetGroup', Value: targetGroupName }],
                StartTime: startTime,
                EndTime: endTime,
                Period: 300,
                Statistics: ['Sum']
            }));

            if (errorCountResult.Datapoints && errorCountResult.Datapoints.length > 0) {
                const totalErrors = errorCountResult.Datapoints.reduce((sum, dp) => sum + (dp.Sum || 0), 0);
                const totalRequests = requestCountResult.Datapoints?.reduce((sum, dp) => sum + (dp.Sum || 0), 0) || 1;
                metrics.errorRate = Math.max(metrics.errorRate, (totalErrors / totalRequests) * 100);
            }
        }

        // Determine performance health status
        const defaultThresholds = {
            maxResponseTime: 2000,
            minThroughput: 1,
            maxErrorRate: 5
        };

        const activeThresholds = { ...defaultThresholds, ...thresholds };

        let status = 'healthy';
        if (metrics.avgResponseTime > activeThresholds.maxResponseTime ||
            metrics.throughput < activeThresholds.minThroughput ||
            metrics.errorRate > activeThresholds.maxErrorRate) {
            status = 'unhealthy';
        } else if (metrics.avgResponseTime > activeThresholds.maxResponseTime * 0.8 ||
                   metrics.throughput < activeThresholds.minThroughput * 1.2 ||
                   metrics.errorRate > activeThresholds.maxErrorRate * 0.6) {
            status = 'degraded';
        }

        // Publish performance metrics
        await publishMetric('PerformanceHealthStatus', status === 'healthy' ? 1 : 0, {
            Environment: process.env.ENVIRONMENT_NAME,
            Application: process.env.APPLICATION_NAME
        });

        await publishMetric('PerformanceAvgResponseTime', metrics.avgResponseTime, {
            Environment: process.env.ENVIRONMENT_NAME,
            Application: process.env.APPLICATION_NAME
        }, 'Milliseconds');

        await publishMetric('PerformanceThroughput', metrics.throughput, {
            Environment: process.env.ENVIRONMENT_NAME,
            Application: process.env.APPLICATION_NAME
        }, 'Count/Second');

        await publishMetric('PerformanceErrorRate', metrics.errorRate, {
            Environment: process.env.ENVIRONMENT_NAME,
            Application: process.env.APPLICATION_NAME
        }, 'Percent');

        return {
            status,
            metrics,
            thresholds: activeThresholds
        };

    } catch (error) {
        console.error('Performance health check failed:', error);
        return {
            status: 'unhealthy',
            metrics,
            thresholds: thresholds || {},
            error: error.message
        };
    }
};

async function publishMetric(metricName, value, dimensions, unit = 'Count') {
    try {
        await cloudwatch.send(new PutMetricDataCommand({
            Namespace: 'MacroAI/HealthCheck',
            MetricData: [{
                MetricName: metricName,
                Value: value,
                Unit: unit,
                Timestamp: new Date(),
                Dimensions: Object.entries(dimensions).map(([Name, Value]) => ({ Name, Value }))
            }]
        }));
    } catch (error) {
        console.error('Failed to publish metric:', error);
    }
}
`
	}

	/**
	 * Get health check orchestrator Lambda code
	 */
	private getHealthCheckOrchestratorCode(): string {
		return `
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { ELBv2Client, DescribeTargetHealthCommand } = require('@aws-sdk/client-elastic-load-balancing-v2');
const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

const lambda = new LambdaClient();
const elbv2 = new ELBv2Client();
const cloudwatch = new CloudWatchClient();

exports.handler = async (event) => {
    console.log('Health check orchestrator event:', JSON.stringify(event, null, 2));

    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
        // Get configuration from event or environment
        const config = event.config || {};
        const targetGroupArns = (process.env.TARGET_GROUP_ARNS || '').split(',').filter(Boolean);

        // Parallel execution of all health checks
        const [appHealthResult, dependencyHealthResult, performanceHealthResult, infraHealthResult] = await Promise.allSettled([
            invokeHealthValidator(process.env.APP_HEALTH_VALIDATOR_ARN, {
                endpoints: config.applicationEndpoints || [
                    { path: '/api/health', expectedStatusCode: 200 },
                    { path: '/api/health/ready', expectedStatusCode: 200 }
                ],
                baseUrl: config.baseUrl || 'https://api.example.com'
            }),

            invokeHealthValidator(process.env.DEPENDENCY_HEALTH_VALIDATOR_ARN, {
                dependencies: config.externalDependencies || [
                    { name: 'OpenAI', endpoint: 'https://api.openai.com/v1/models', critical: true },
                    { name: 'Database', endpoint: 'postgresql://localhost:5432', critical: true }
                ]
            }),

            invokeHealthValidator(process.env.PERFORMANCE_HEALTH_VALIDATOR_ARN, {
                thresholds: config.performanceThresholds || {
                    maxResponseTime: 2000,
                    minThroughput: 1,
                    maxErrorRate: 5
                },
                targetGroupArns
            }),

            checkInfrastructureHealth(targetGroupArns)
        ]);

        // Process results
        const appHealth = getResultValue(appHealthResult, { status: 'unhealthy', endpoints: [] });
        const dependencyHealth = getResultValue(dependencyHealthResult, { status: 'unhealthy', services: [] });
        const performanceHealth = getResultValue(performanceHealthResult, { status: 'unhealthy', metrics: {}, thresholds: {} });
        const infraHealth = getResultValue(infraHealthResult, { status: 'unhealthy', targetGroups: [], loadBalancer: {} });

        // Determine overall health status
        const healthStatuses = [appHealth.status, dependencyHealth.status, performanceHealth.status, infraHealth.status];
        let overallStatus = 'healthy';

        if (healthStatuses.includes('unhealthy')) {
            overallStatus = 'unhealthy';
        } else if (healthStatuses.includes('degraded')) {
            overallStatus = 'degraded';
        }

        // Calculate summary
        const totalChecks = 4;
        const passedChecks = healthStatuses.filter(s => s === 'healthy').length;
        const degradedChecks = healthStatuses.filter(s => s === 'degraded').length;
        const failedChecks = healthStatuses.filter(s => s === 'unhealthy').length;

        const result = {
            isHealthy: overallStatus === 'healthy',
            status: overallStatus,
            timestamp,
            checks: {
                application: appHealth,
                dependencies: dependencyHealth,
                performance: performanceHealth,
                infrastructure: infraHealth
            },
            summary: {
                totalChecks,
                passedChecks,
                failedChecks,
                degradedChecks
            },
            duration: Date.now() - startTime
        };

        // Publish overall health metric
        await publishMetric('OverallHealthStatus', overallStatus === 'healthy' ? 1 : 0, {
            Environment: process.env.ENVIRONMENT_NAME,
            Application: process.env.APPLICATION_NAME
        });

        await publishMetric('HealthCheckDuration', result.duration, {
            Environment: process.env.ENVIRONMENT_NAME,
            Application: process.env.APPLICATION_NAME
        }, 'Milliseconds');

        console.log('Health check completed:', { status: overallStatus, duration: result.duration });

        return result;

    } catch (error) {
        console.error('Health check orchestrator failed:', error);

        const result = {
            isHealthy: false,
            status: 'unhealthy',
            timestamp,
            error: error.message,
            duration: Date.now() - startTime
        };

        await publishMetric('OverallHealthStatus', 0, {
            Environment: process.env.ENVIRONMENT_NAME,
            Application: process.env.APPLICATION_NAME
        });

        return result;
    }
};

async function invokeHealthValidator(functionArn, payload) {
    if (!functionArn) {
        throw new Error('Function ARN not provided');
    }

    const command = new InvokeCommand({
        FunctionName: functionArn,
        Payload: JSON.stringify(payload)
    });

    const response = await lambda.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.Payload));

    if (response.FunctionError) {
        throw new Error(\`Health validator failed: \${result.errorMessage || 'Unknown error'}\`);
    }

    return result;
}

async function checkInfrastructureHealth(targetGroupArns) {
    const targetGroups = [];

    for (const targetGroupArn of targetGroupArns) {
        try {
            const healthResult = await elbv2.send(new DescribeTargetHealthCommand({
                TargetGroupArn: targetGroupArn
            }));

            const healthyTargets = healthResult.TargetHealthDescriptions?.filter(
                target => target.TargetHealth?.State === 'healthy'
            ) || [];

            const totalTargets = healthResult.TargetHealthDescriptions?.length || 0;
            const healthyPercentage = totalTargets > 0 ? (healthyTargets.length / totalTargets) * 100 : 0;

            targetGroups.push({
                arn: targetGroupArn,
                healthyTargets: healthyTargets.length,
                totalTargets,
                healthyPercentage
            });

        } catch (error) {
            console.error(\`Failed to check target group health: \${targetGroupArn}\`, error);
            targetGroups.push({
                arn: targetGroupArn,
                healthyTargets: 0,
                totalTargets: 0,
                healthyPercentage: 0,
                error: error.message
            });
        }
    }

    // Determine infrastructure health
    const unhealthyTargetGroups = targetGroups.filter(tg => tg.healthyPercentage < 80);
    let status = 'healthy';

    if (unhealthyTargetGroups.length === targetGroups.length && targetGroups.length > 0) {
        status = 'unhealthy';
    } else if (unhealthyTargetGroups.length > 0) {
        status = 'degraded';
    }

    return {
        status,
        targetGroups,
        loadBalancer: {
            status: status === 'unhealthy' ? 'unhealthy' : 'healthy',
            activeConnections: 0, // Would be populated from actual metrics
            requestCount: 0 // Would be populated from actual metrics
        }
    };
}

function getResultValue(promiseResult, defaultValue) {
    return promiseResult.status === 'fulfilled' ? promiseResult.value : defaultValue;
}

async function publishMetric(metricName, value, dimensions, unit = 'Count') {
    try {
        await cloudwatch.send(new PutMetricDataCommand({
            Namespace: 'MacroAI/HealthCheck',
            MetricData: [{
                MetricName: metricName,
                Value: value,
                Unit: unit,
                Timestamp: new Date(),
                Dimensions: Object.entries(dimensions).map(([Name, Value]) => ({ Name, Value }))
            }]
        }));
    } catch (error) {
        console.error('Failed to publish metric:', error);
    }
}
`
	}
}
