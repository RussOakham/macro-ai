import * as cdk from 'aws-cdk-lib'
import * as applicationautoscaling from 'aws-cdk-lib/aws-applicationautoscaling'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import { Construct } from 'constructs'

export interface AutoShutdownConstructProps {
	/**
	 * ECS scalable task count (from service.autoScaleTaskCount())
	 */
	readonly scalableTaskCount: ecs.ScalableTaskCount

	/**
	 * Environment name for resource naming and tagging
	 */
	readonly environmentName: string

	/**
	 * Shutdown schedule in cron format (UTC)
	 * @default '0 22 * * *' (10 PM UTC daily)
	 */
	readonly shutdownSchedule?: string

	/**
	 * Startup schedule in cron format (UTC)
	 * Set to undefined to disable automatic startup (on-demand only)
	 * @default '0 8 * * 1-5' (8 AM UTC, Monday-Friday)
	 */
	readonly startupSchedule?: string

	/**
	 * Number of tasks to scale to during startup
	 * @default 1
	 */
	readonly startupTaskCount?: number

	/**
	 * Enable weekend shutdown (Friday night to Monday morning)
	 * @default true
	 */
	readonly enableWeekendShutdown?: boolean

	/**
	 * Time zone for schedule display (does not affect UTC cron)
	 * @default 'UTC'
	 */
	readonly displayTimeZone?: string
}

/**
 * Auto-shutdown construct for ECS preview environments
 *
 * This construct creates scheduled scaling for ECS Fargate services to reduce costs:
 * - Automatically scales down to 0 tasks during off-hours
 * - Scales back up to the specified task count during business hours
 * - Uses existing ECS ScalableTaskCount with scheduled scaling
 * - No additional AWS services required
 *
 * Cost savings:
 * - Preview environment (0.25 vCPU, 512MB): ~$0.34/day -> ~$0.11/day (68% savings)
 * - Typical savings: $5-10/month per preview environment
 */
export class AutoShutdownConstruct extends Construct {
	constructor(scope: Construct, id: string, props: AutoShutdownConstructProps) {
		super(scope, id)

		const {
			scalableTaskCount,
			environmentName,
			shutdownSchedule = '0 22 * * 0-6', // 10 PM UTC daily - minute hour day month day-of-week (0-6 = Sunday-Saturday)
			startupSchedule, // No default - can be undefined for on-demand only
			startupTaskCount = 1,
			enableWeekendShutdown = true,
		} = props

		// Validate CRON expressions
		const validateCronExpression = (cron: string): string => {
			// AWS Application Auto Scaling expects explicit CRON expressions
			// Ensure we have exactly 5 fields: minute hour day month day-of-week
			const parts = cron.split(' ')
			if (parts.length !== 5) {
				throw new Error(
					`Invalid CRON expression: ${cron}. Expected 5 fields, got ${parts.length}`,
				)
			}

			// Debug: Log the CRON expression being validated
			console.log(
				`Validating CRON expression: "${cron}" (length: ${cron.length})`,
			)
			console.log(`CRON parts: [${parts.join(', ')}]`)

			return cron
		}

		// Add shutdown scheduled scaling action
		const shutdownCronExpression = `cron(${validateCronExpression(shutdownSchedule)})`
		console.log(
			`Creating shutdown schedule with expression: "${shutdownCronExpression}"`,
		)

		scalableTaskCount.scaleOnSchedule('ShutdownSchedule', {
			schedule: applicationautoscaling.Schedule.expression(
				shutdownCronExpression,
			),
			minCapacity: 0,
			maxCapacity: 0,
		})

		// Add startup scheduled scaling action only if startupSchedule is provided
		if (startupSchedule) {
			// Create startup schedule expression
			const startupScheduleExpression = enableWeekendShutdown
				? startupSchedule // Monday-Friday startup
				: startupSchedule.replace('1-5', '*') // Daily startup if weekend shutdown disabled

			scalableTaskCount.scaleOnSchedule('StartupSchedule', {
				schedule: applicationautoscaling.Schedule.expression(
					`cron(${validateCronExpression(startupScheduleExpression)})`,
				),
				minCapacity: startupTaskCount,
				maxCapacity: Math.max(startupTaskCount, 2),
			})
		}

		// Add tags for resource management
		cdk.Tags.of(this).add('SubComponent', 'Auto-Shutdown')
		cdk.Tags.of(this).add('SubEnvironmentType', environmentName)
		cdk.Tags.of(this).add('SubCostOptimization', 'Enabled')

		// Output schedule information
		new cdk.CfnOutput(this, 'ShutdownSchedule', {
			value: shutdownSchedule,
			description: `Auto-shutdown schedule for ${environmentName} (UTC cron)`,
		})

		new cdk.CfnOutput(this, 'StartupSchedule', {
			value: startupSchedule
				? enableWeekendShutdown
					? startupSchedule
					: startupSchedule.replace('1-5', '*')
				: 'Disabled - On-demand startup only',
			description: `Auto-startup schedule for ${environmentName} (UTC cron)`,
		})

		new cdk.CfnOutput(this, 'EstimatedMonthlySavings', {
			value: '$5-10 per month',
			description: 'Estimated cost savings from auto-shutdown',
		})
	}

	/**
	 * Manual scaling commands for CloudFormation outputs
	 */
	public createManualShutdownOutput(): cdk.CfnOutput {
		return new cdk.CfnOutput(this, 'ManualShutdown', {
			value: 'Check ECS Console or use AWS CLI to scale service to 0',
			description: 'Manual shutdown instructions',
		})
	}

	/**
	 * Manual scaling commands for CloudFormation outputs
	 */
	public createManualStartupOutput(): cdk.CfnOutput {
		return new cdk.CfnOutput(this, 'ManualStartup', {
			value: 'Check ECS Console or use AWS CLI to scale service to 1',
			description: 'Manual startup instructions',
		})
	}
}
