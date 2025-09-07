import { Construct } from 'constructs'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambda_nodejs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as logs from 'aws-cdk-lib/aws-logs'
import { Duration } from 'aws-cdk-lib'

export interface CostOptimizationLambdaProps {
	environment: string
	costOptimizationRole: iam.IRole
	logRetention?: logs.RetentionDays
	timeout?: Duration
	memorySize?: number
}

export class CostOptimizationLambdaConstruct extends Construct {
	public readonly function: lambda_nodejs.NodejsFunction
	public readonly logGroup: logs.LogGroup

	constructor(
		scope: Construct,
		id: string,
		props: CostOptimizationLambdaProps,
	) {
		super(scope, id)

		const {
			environment,
			costOptimizationRole,
			logRetention = logs.RetentionDays.ONE_MONTH,
			timeout = Duration.minutes(5),
			memorySize = 256,
		} = props

		// Create CloudWatch log group
		this.logGroup = new logs.LogGroup(this, 'LogGroup', {
			logGroupName: `/aws/lambda/${environment}-cost-optimization`,
			retention: logRetention,
		})

		// Create the Lambda function
		this.function = new lambda_nodejs.NodejsFunction(this, 'Function', {
			functionName: `${environment}-cost-optimization`,
			entry: 'src/lambda/cost-optimization/index.ts',
			handler: 'handler',
			runtime: lambda.Runtime.NODEJS_20_X,
			timeout,
			memorySize,
			role: costOptimizationRole,
			environment: {
				NODE_ENV: 'production',
				ENVIRONMENT: environment,
			},
			logGroup: this.logGroup,
			bundling: {
				minify: true,
				sourceMap: true,
				target: 'node20',
			},
		})

		// Grant additional permissions needed for cost analysis
		this.function.addToRolePolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'budgets:DescribeBudget',
					'budgets:DescribeBudgets',
					'ce:GetCostAndUsage',
					'ce:GetUsageAndCosts',
					'ce:GetReservationCoverage',
					'ce:GetReservationPurchaseRecommendation',
					'ce:GetReservationUtilization',
					'ec2:DescribeInstances',
					'ec2:DescribeSnapshots',
					'ec2:DescribeVolumes',
					'ec2:DescribeReservedInstances',
					'elasticloadbalancing:DescribeLoadBalancers',
					'cloudwatch:GetMetricData',
					'cloudwatch:ListMetrics',
					'pricing:GetProducts',
					'pricing:GetAttributeValues',
				],
				resources: ['*'],
			}),
		)
	}
}
