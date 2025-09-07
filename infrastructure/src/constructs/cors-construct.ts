import * as cdk from 'aws-cdk-lib'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'

export interface CorsConstructProps {
	/**
	 * Environment name for resource naming
	 */
	environmentName: string

	/**
	 * Allowed origins for CORS
	 */
	allowedOrigins: string[]

	/**
	 * Allowed methods for CORS
	 */
	allowedMethods?: string[]

	/**
	 * Allowed headers for CORS
	 */
	allowedHeaders?: string[]

	/**
	 * Exposed headers for CORS
	 */
	exposedHeaders?: string[]

	/**
	 * Max age for preflight requests (in seconds)
	 */
	maxAge?: number

	/**
	 * Allow credentials in CORS requests
	 */
	allowCredentials?: boolean

	/**
	 * Enable CORS preflight request logging
	 */
	enableLogging?: boolean

	/**
	 * Enable detailed monitoring
	 */
	enableDetailedMonitoring?: boolean

	/**
	 * Rate limiting for CORS requests
	 */
	rateLimitThreshold?: number
}

export class CorsConstruct extends Construct {
	public readonly corsLambda: lambda.Function
	public readonly logGroup?: logs.LogGroup
	public readonly alarms: cloudwatch.Alarm[]

	constructor(scope: Construct, id: string, props: CorsConstructProps) {
		super(scope, id)

		const {
			environmentName,
			allowedOrigins,
			allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
			allowedHeaders = [
				'Content-Type',
				'Authorization',
				'X-Requested-With',
				'Accept',
				'Origin',
			],
			exposedHeaders = [],
			maxAge = 86400, // 24 hours
			allowCredentials = false,
			enableLogging = true,
			enableDetailedMonitoring = true,
			rateLimitThreshold = 1000,
		} = props

		this.alarms = []

		// Create Lambda function for CORS handling
		this.corsLambda = this.createCorsLambda({
			environmentName,
			allowedOrigins,
			allowedMethods,
			allowedHeaders,
			exposedHeaders,
			maxAge,
			allowCredentials,
		})

		// Create CloudWatch log group for CORS logs
		if (enableLogging) {
			this.logGroup = this.createLogGroup(environmentName)
		}

		// Create monitoring and alarms
		if (enableDetailedMonitoring) {
			this.createMonitoringAlarms(environmentName, rateLimitThreshold)
		}

		// Create CloudFormation outputs
		this.createOutputs(environmentName)
	}

	private createCorsLambda(config: {
		environmentName: string
		allowedOrigins: string[]
		allowedMethods: string[]
		allowedHeaders: string[]
		exposedHeaders: string[]
		maxAge: number
		allowCredentials: boolean
	}): lambda.Function {
		const corsLambda = new lambda.Function(this, 'CorsHandler', {
			functionName: `${config.environmentName}-cors-handler`,
			runtime: lambda.Runtime.NODEJS_18_X,
			code: lambda.Code.fromAsset('src/lambda/cors-handler'),
			handler: 'index.handler',
			timeout: cdk.Duration.seconds(30),
			memorySize: 128,
			environment: {
				ENVIRONMENT: config.environmentName,
				ALLOWED_ORIGINS: JSON.stringify(config.allowedOrigins),
				ALLOWED_METHODS: JSON.stringify(config.allowedMethods),
				ALLOWED_HEADERS: JSON.stringify(config.allowedHeaders),
				EXPOSED_HEADERS: JSON.stringify(config.exposedHeaders),
				MAX_AGE: config.maxAge.toString(),
				ALLOW_CREDENTIALS: config.allowCredentials.toString(),
			},
		})

		// Add IAM permissions for logging
		corsLambda.addToRolePolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'logs:CreateLogGroup',
					'logs:CreateLogStream',
					'logs:PutLogEvents',
				],
				resources: ['*'],
			}),
		)

		return corsLambda
	}

	private createLogGroup(environmentName: string): logs.LogGroup {
		return new logs.LogGroup(this, 'CorsLogGroup', {
			logGroupName: `/aws/lambda/${environmentName}-cors-handler`,
			retention: logs.RetentionDays.ONE_WEEK,
			removalPolicy: cdk.RemovalPolicy.DESTROY,
		})
	}

	private createMonitoringAlarms(
		environmentName: string,
		rateLimitThreshold: number,
	): void {
		// CORS violation alarm (high number of blocked requests)
		const corsViolationAlarm = new cloudwatch.Alarm(
			this,
			'CorsViolationAlarm',
			{
				alarmName: `${environmentName}-cors-violations`,
				alarmDescription: 'High number of CORS violations detected',
				metric: new cloudwatch.Metric({
					namespace: 'MacroAI/CORS',
					metricName: 'CorsViolationCount',
					dimensionsMap: {
						Environment: environmentName,
					},
					statistic: 'Sum',
				}),
				threshold: 50,
				evaluationPeriods: 5,
				comparisonOperator:
					cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
				treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
			},
		)

		// CORS preflight rate alarm
		const preflightRateAlarm = new cloudwatch.Alarm(
			this,
			'PreflightRateAlarm',
			{
				alarmName: `${environmentName}-cors-preflight-rate`,
				alarmDescription:
					'High rate of CORS preflight requests (possible scanning)',
				metric: new cloudwatch.Metric({
					namespace: 'MacroAI/CORS',
					metricName: 'PreflightRequestCount',
					dimensionsMap: {
						Environment: environmentName,
					},
					statistic: 'Sum',
				}),
				threshold: rateLimitThreshold,
				evaluationPeriods: 5,
				comparisonOperator:
					cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
				treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
			},
		)

		// CORS origin mismatch alarm
		const originMismatchAlarm = new cloudwatch.Alarm(
			this,
			'OriginMismatchAlarm',
			{
				alarmName: `${environmentName}-cors-origin-mismatch`,
				alarmDescription: 'CORS requests from unauthorized origins detected',
				metric: new cloudwatch.Metric({
					namespace: 'MacroAI/CORS',
					metricName: 'OriginMismatchCount',
					dimensionsMap: {
						Environment: environmentName,
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

		this.alarms.push(
			corsViolationAlarm,
			preflightRateAlarm,
			originMismatchAlarm,
		)
	}

	private createOutputs(environmentName: string): void {
		new cdk.CfnOutput(this, 'CorsLambdaArn', {
			value: this.corsLambda.functionArn,
			description: 'CORS Lambda function ARN',
			exportName: `${environmentName}-cors-lambda-arn`,
		})

		new cdk.CfnOutput(this, 'CorsLambdaName', {
			value: this.corsLambda.functionName,
			description: 'CORS Lambda function name',
			exportName: `${environmentName}-cors-lambda-name`,
		})

		if (this.logGroup) {
			new cdk.CfnOutput(this, 'CorsLogGroupName', {
				value: this.logGroup.logGroupName,
				description: 'CORS log group name',
				exportName: `${environmentName}-cors-log-group`,
			})
		}
	}

	/**
	 * Get the CORS Lambda function for external use
	 */
	public getCorsLambda(): lambda.Function {
		return this.corsLambda
	}

	/**
	 * Get the CORS Lambda function ARN
	 */
	public getCorsLambdaArn(): string {
		return this.corsLambda.functionArn
	}

	/**
	 * Update CORS configuration
	 */
	public updateCorsConfig(updates: Partial<CorsConstructProps>): void {
		const currentEnv = this.corsLambda.environment

		// Update environment variables
		if (updates.allowedOrigins) {
			currentEnv['ALLOWED_ORIGINS'] = JSON.stringify(updates.allowedOrigins)
		}

		if (updates.allowedMethods) {
			currentEnv['ALLOWED_METHODS'] = JSON.stringify(updates.allowedMethods)
		}

		if (updates.allowedHeaders) {
			currentEnv['ALLOWED_HEADERS'] = JSON.stringify(updates.allowedHeaders)
		}

		if (updates.maxAge) {
			currentEnv['MAX_AGE'] = updates.maxAge.toString()
		}

		if (updates.allowCredentials !== undefined) {
			currentEnv['ALLOW_CREDENTIALS'] = updates.allowCredentials.toString()
		}

		// Update the Lambda function environment
		this.corsLambda.addEnvironment('UPDATED_AT', new Date().toISOString())
	}
}
