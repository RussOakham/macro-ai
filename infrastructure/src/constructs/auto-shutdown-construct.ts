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
			shutdownSchedule = '0 22 * * *', // 10 PM UTC daily - standard 5-field cron
			startupSchedule, // No default - can be undefined for on-demand only
			startupTaskCount = 1,
			enableWeekendShutdown = true,
		} = props

		// Validate CRON expressions
		const validateCronExpression = (cron: string): string => {
			// AWS Application Auto Scaling supports both 5-field and 6-field cron expressions
			const parts = cron.split(' ')
			if (parts.length !== 5 && parts.length !== 6) {
				throw new Error(
					`Invalid CRON expression: ${cron}. Expected 5 or 6 fields, got ${parts.length}. AWS Application Auto Scaling supports: minute hour day-of-month month day-of-week [year]`,
				)
			}

			// Debug: Log the CRON expression being validated
			console.log(
				`Validating CRON expression: "${cron}" (length: ${cron.length})`,
			)
			console.log(`CRON parts: [${parts.join(', ')}]`)

			// For 6-field cron, validate day-of-month vs day-of-week conflict rule
			if (parts.length === 6) {
				const [, , dayOfMonth, , dayOfWeek] = parts
				if (dayOfMonth === '*' && dayOfWeek === '*') {
					throw new Error(
						`Invalid CRON expression: ${cron}. AWS Application Auto Scaling does not allow * in both day-of-month and day-of-week fields. Use ? in one of them.`,
					)
				}
			}

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

		// Helper function to safely get startup schedule expression
		const getStartupScheduleExpression = (): string => {
			if (!startupSchedule) {
				return 'Disabled - On-demand startup only'
			}

			if (enableWeekendShutdown) {
				return startupSchedule // Monday-Friday startup
			} else {
				return startupSchedule.replace('1-5', '*') // Daily startup if weekend shutdown disabled
			}
		}

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
			value: getStartupScheduleExpression(),
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
