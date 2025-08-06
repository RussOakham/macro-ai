import * as cdk from 'aws-cdk-lib'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager'
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
}

/**
 * Construct for API Gateway REST API
 *
 * Creates a REST API with Lambda proxy integration, CORS configuration,
 * and optional custom domain setup for the hobby deployment.
 */
export class ApiGatewayConstruct extends Construct {
	public readonly restApi: apigateway.RestApi
	public readonly deployment: apigateway.Deployment
	public readonly stage: apigateway.Stage
	public readonly domainName?: apigateway.DomainName

	constructor(scope: Construct, id: string, props: ApiGatewayConstructProps) {
		super(scope, id)

		const {
			environmentName,
			lambdaFunction,
			domainName,
			hostedZoneId,
			enableDetailedMonitoring = false,
			throttling = { rateLimit: 100, burstLimit: 200 }, // Conservative limits for hobby use
		} = props

		// Create REST API
		this.restApi = this.createRestApi(environmentName, enableDetailedMonitoring)

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
				allowOrigins: apigateway.Cors.ALL_ORIGINS, // In production, restrict to specific domains
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

		// Note: Throttling will be configured at the API level via usage plans if needed

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
}
