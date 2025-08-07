import * as cdk from 'aws-cdk-lib'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as route53targets from 'aws-cdk-lib/aws-route53-targets'
import { Construct } from 'constructs'

export interface ApiGatewayConstructProps {
	/**
	 * Environment name for resource naming
	 */
	readonly environmentName: string

	/**
	 * Lambda function to integrate with API Gateway
	 */
	readonly lambdaFunction: lambda.Function

	/**
	 * Custom domain name for the API (optional)
	 * If provided, will set up custom domain with SSL certificate
	 */
	readonly domainName?: string

	/**
	 * Hosted zone ID for the custom domain (required if domainName is provided)
	 */
	readonly hostedZoneId?: string

	/**
	 * Whether to enable detailed monitoring
	 * @default false
	 */
	readonly enableDetailedMonitoring?: boolean

	/**
	 * API Gateway throttling configuration
	 */
	readonly throttling?: {
		rateLimit: number
		burstLimit: number
	}

	/**
	 * Cognito User Pool configuration for API Gateway authorizers (optional)
	 * If provided, will create Cognito authorizers for protected routes
	 * Note: Current implementation uses Lambda-level authentication for cost optimization
	 */
	readonly cognitoConfig?: {
		userPoolId: string
		userPoolClientId: string
	}
}

/**
 * Construct for API Gateway REST API
 *
 * Creates a REST API with Lambda proxy integration, CORS configuration,
 * and optional custom domain setup for the hobby deployment.
 *
 * ## Authentication Strategy
 *
 * This construct supports dual authentication approaches:
 *
 * 1. **Lambda-level Authentication (Current/Primary)**:
 *    - Authentication handled by Express middleware within Lambda
 *    - Cost-optimized (no API Gateway authorizer charges)
 *    - Flexible and consistent across deployment modes
 *    - Uses Cognito JWT validation in Express middleware
 *
 * 2. **API Gateway Cognito Authorizers (Optional)**:
 *    - Can be enabled by providing cognitoConfig
 *    - Provides API Gateway-level authentication
 *    - Useful for additional security layers or specific use cases
 *    - Requires additional AWS charges for authorizer usage
 *
 * The current implementation prioritizes cost optimization and uses Lambda-level
 * authentication as the primary method.
 */
export class ApiGatewayConstruct extends Construct {
	public readonly restApi: apigateway.RestApi
	public readonly deployment: apigateway.Deployment
	public readonly stage: apigateway.Stage
	public readonly domainName?: apigateway.DomainName
	public readonly cognitoAuthorizer?: apigateway.CognitoUserPoolsAuthorizer

	/**
	 * Get allowed CORS origins based on environment
	 */
	private getAllowedOrigins(environmentName: string): string[] {
		// Get allowed origins from environment variable or use defaults
		const customOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(',').map(
			(origin) => origin.trim(),
		)

		// Production environment - restrict to specific domains
		if (environmentName === 'production') {
			return (
				customOrigins ?? [
					'https://app.macro-ai.com',
					'https://www.macro-ai.com',
				]
			)
		}

		// Staging environment - allow staging domains
		if (environmentName === 'staging') {
			return (
				customOrigins ?? [
					'https://staging.macro-ai.com',
					'https://dev.macro-ai.com',
					'http://localhost:3000',
					'https://localhost:3000',
				]
			)
		}

		// Development/hobby environment - allow local development
		return (
			customOrigins ?? [
				'http://localhost:3000',
				'https://localhost:3000',
				'http://127.0.0.1:3000',
				'https://127.0.0.1:3000',
			]
		)
	}

	constructor(scope: Construct, id: string, props: ApiGatewayConstructProps) {
		super(scope, id)

		const {
			environmentName,
			lambdaFunction,
			domainName,
			hostedZoneId,
			enableDetailedMonitoring = false,
			throttling = { rateLimit: 100, burstLimit: 200 }, // Conservative limits for hobby use
			cognitoConfig,
		} = props

		// Create REST API
		this.restApi = this.createRestApi(environmentName, enableDetailedMonitoring)

		// Log CORS configuration for transparency
		const allowedOrigins = this.getAllowedOrigins(environmentName)
		new cdk.CfnOutput(this, 'CorsAllowedOrigins', {
			value: allowedOrigins.join(', '),
			description: `CORS allowed origins for ${environmentName} environment`,
		})

		// Create Cognito authorizer if configuration is provided
		if (cognitoConfig) {
			this.cognitoAuthorizer = this.createCognitoAuthorizer(cognitoConfig)
		}

		// Create Lambda integration
		const lambdaIntegration = this.createLambdaIntegration(lambdaFunction)

		// Set up API routes
		this.setupApiRoutes(lambdaIntegration)

		// Create deployment and stage
		const { deployment, stage } = this.createDeploymentAndStage(
			environmentName,
			throttling,
			enableDetailedMonitoring,
		)
		this.deployment = deployment
		this.stage = stage

		// Set up custom domain if provided
		if (domainName && hostedZoneId) {
			this.domainName = this.setupCustomDomain(domainName, hostedZoneId)
		}

		// Output API details
		new cdk.CfnOutput(this, 'RestApiId', {
			value: this.restApi.restApiId,
			description: 'REST API ID',
		})

		new cdk.CfnOutput(this, 'RestApiUrl', {
			value: this.restApi.url,
			description: 'REST API URL',
		})

		if (this.domainName) {
			new cdk.CfnOutput(this, 'CustomDomainName', {
				value: this.domainName.domainName,
				description: 'Custom domain name',
			})
		}
	}

	private createRestApi(
		environmentName: string,
		enableDetailedMonitoring: boolean,
	): apigateway.RestApi {
		return new apigateway.RestApi(this, 'RestApi', {
			restApiName: `macro-ai-${environmentName}-api`,
			description: 'Macro AI API Gateway for hobby deployment',
			// Cost optimization: disable CloudWatch role to avoid charges
			cloudWatchRole: false,
			// Enable detailed monitoring only if requested
			deployOptions: {
				stageName: environmentName,
				metricsEnabled: enableDetailedMonitoring,
				loggingLevel: enableDetailedMonitoring
					? apigateway.MethodLoggingLevel.INFO
					: apigateway.MethodLoggingLevel.OFF,
				dataTraceEnabled: enableDetailedMonitoring,
				tracingEnabled: enableDetailedMonitoring,
			},
			// CORS configuration for frontend integration
			defaultCorsPreflightOptions: {
				allowOrigins: this.getAllowedOrigins(environmentName),
				allowMethods: apigateway.Cors.ALL_METHODS,
				allowHeaders: [
					'Content-Type',
					'X-Amz-Date',
					'Authorization',
					'X-Api-Key',
					'X-Amz-Security-Token',
					'X-Amz-User-Agent',
				],
				allowCredentials: true,
			},
			// Binary media types for file uploads
			binaryMediaTypes: ['multipart/form-data', 'application/octet-stream'],
		})
	}

	private createCognitoAuthorizer(cognitoConfig: {
		userPoolId: string
		userPoolClientId: string
	}): apigateway.CognitoUserPoolsAuthorizer {
		return new apigateway.CognitoUserPoolsAuthorizer(
			this,
			'CognitoAuthorizer',
			{
				cognitoUserPools: [
					cognito.UserPool.fromUserPoolId(
						this,
						'UserPool',
						cognitoConfig.userPoolId,
					),
				],
				identitySource: 'method.request.header.Authorization',
				authorizerName: 'MacroAICognitoAuthorizer',
				resultsCacheTtl: cdk.Duration.minutes(5), // Cache for cost optimization
			},
		)
	}

	private createLambdaIntegration(
		lambdaFunction: lambda.Function,
	): apigateway.LambdaIntegration {
		return new apigateway.LambdaIntegration(lambdaFunction, {
			proxy: true,
			allowTestInvoke: false, // Cost optimization: disable test invoke
		})
	}

	private setupApiRoutes(
		lambdaIntegration: apigateway.LambdaIntegration,
	): void {
		// Add root path integration for requests to "/"
		this.restApi.root.addMethod('ANY', lambdaIntegration)

		// Proxy all other requests to Lambda function
		// This allows the Express app to handle all routing internally
		this.restApi.root.addProxy({
			defaultIntegration: lambdaIntegration,
			anyMethod: true,
		})
	}

	private createDeploymentAndStage(
		environmentName: string,
		throttling: { rateLimit: number; burstLimit: number },
		enableDetailedMonitoring: boolean,
	): { deployment: apigateway.Deployment; stage: apigateway.Stage } {
		const deployment = new apigateway.Deployment(this, 'Deployment', {
			api: this.restApi,
		})

		const stage = new apigateway.Stage(this, 'Stage', {
			deployment,
			stageName: environmentName,
			// Monitoring configuration
			metricsEnabled: enableDetailedMonitoring,
			loggingLevel: enableDetailedMonitoring
				? apigateway.MethodLoggingLevel.INFO
				: apigateway.MethodLoggingLevel.OFF,
			dataTraceEnabled: enableDetailedMonitoring,
			tracingEnabled: enableDetailedMonitoring,
		})

		// Configure throttling via usage plan for cost control and protection
		const usagePlan = this.restApi.addUsagePlan('ThrottlingPlan', {
			name: `${environmentName}-throttling-plan`,
			description: 'Usage plan for API throttling and cost control',
			throttle: {
				rateLimit: throttling.rateLimit,
				burstLimit: throttling.burstLimit,
			},
		})

		// Associate the usage plan with the stage
		usagePlan.addApiStage({
			stage,
		})

		return { deployment, stage }
	}

	private setupCustomDomain(
		domainName: string,
		hostedZoneId: string,
	): apigateway.DomainName {
		// Look up the hosted zone
		const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
			this,
			'HostedZone',
			{
				hostedZoneId,
				zoneName: domainName,
			},
		)

		// Create SSL certificate
		const certificate = new certificatemanager.Certificate(
			this,
			'Certificate',
			{
				domainName,
				validation:
					certificatemanager.CertificateValidation.fromDns(hostedZone),
			},
		)

		// Create custom domain
		const customDomain = new apigateway.DomainName(this, 'CustomDomain', {
			domainName,
			certificate,
			endpointType: apigateway.EndpointType.REGIONAL,
		})

		// Create base path mapping
		customDomain.addBasePathMapping(this.restApi, {
			stage: this.stage,
		})

		// Create Route53 record
		new route53.ARecord(this, 'AliasRecord', {
			zone: hostedZone,
			recordName: domainName,
			target: route53.RecordTarget.fromAlias(
				new route53targets.ApiGatewayDomain(customDomain),
			),
		})

		return customDomain
	}

	/**
	 * Create a protected resource with Cognito authorization
	 * Note: This is optional - the current implementation uses Lambda-level authentication
	 * for cost optimization and flexibility
	 */
	public addProtectedResource(
		path: string,
		methods: string[] = ['GET', 'POST', 'PUT', 'DELETE'],
	): apigateway.Resource | null {
		if (!this.cognitoAuthorizer) {
			console.warn(
				'Cognito authorizer not configured. Protected routes will rely on Lambda-level authentication.',
			)
			return null
		}

		const resource = this.restApi.root.addResource(path)

		// Add methods with Cognito authorization
		for (const method of methods) {
			resource.addMethod(method, undefined, {
				authorizer: this.cognitoAuthorizer,
				authorizationType: apigateway.AuthorizationType.COGNITO,
			})
		}

		return resource
	}
}
