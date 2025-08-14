#!/usr/bin/env node

import { Command } from 'commander'
import {
	CloudWatchClient,
	GetMetricStatisticsCommand,
	DescribeAlarmsCommand,
} from '@aws-sdk/client-cloudwatch'
import {
	DynamoDBClient,
	QueryCommand,
	ScanCommand,
	GetItemCommand,
} from '@aws-sdk/client-dynamodb'
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import chalk from 'chalk'
import Table from 'cli-table3'

/**
 * Security Monitoring CLI Tool
 *
 * Provides command-line interface for monitoring security events,
 * analyzing security metrics, and managing security configurations.
 */

const program = new Command()
const cloudwatch = new CloudWatchClient()
const dynamodb = new DynamoDBClient()
const lambda = new LambdaClient()

// Configuration
const DEFAULT_ENVIRONMENT = 'production'
const DEFAULT_APPLICATION = 'macro-ai'

program
	.name('security-monitoring')
	.description('CLI tool for security monitoring and analysis')
	.version('1.0.0')

/**
 * Security events command
 */
program
	.command('events')
	.description('View and analyze security events')
	.option('-e, --environment <env>', 'Environment name', DEFAULT_ENVIRONMENT)
	.option('-a, --application <app>', 'Application name', DEFAULT_APPLICATION)
	.option('-t, --type <type>', 'Filter by event type')
	.option('-s, --severity <severity>', 'Filter by severity level')
	.option('-l, --limit <number>', 'Limit number of results', '50')
	.option('--since <hours>', 'Show events from last N hours', '24')
	.action(async (options) => {
		try {
			console.log(chalk.blue('🔍 Fetching security events...'))
			const events = await getSecurityEvents(options)
			displaySecurityEvents(events)
		} catch (error) {
			console.error(
				chalk.red('❌ Failed to fetch security events:'),
				error.message,
			)
			process.exit(1)
		}
	})

/**
 * Security metrics command
 */
program
	.command('metrics')
	.description('View security metrics and statistics')
	.option('-e, --environment <env>', 'Environment name', DEFAULT_ENVIRONMENT)
	.option('-a, --application <app>', 'Application name', DEFAULT_APPLICATION)
	.option('--period <hours>', 'Time period in hours', '24')
	.action(async (options) => {
		try {
			console.log(chalk.blue('📊 Fetching security metrics...'))
			const metrics = await getSecurityMetrics(options)
			displaySecurityMetrics(metrics)
		} catch (error) {
			console.error(
				chalk.red('❌ Failed to fetch security metrics:'),
				error.message,
			)
			process.exit(1)
		}
	})

/**
 * Security analysis command
 */
program
	.command('analyze')
	.description('Run security analysis and get recommendations')
	.option('-e, --environment <env>', 'Environment name', DEFAULT_ENVIRONMENT)
	.option('-a, --application <app>', 'Application name', DEFAULT_APPLICATION)
	.action(async (options) => {
		try {
			console.log(chalk.blue('🔬 Running security analysis...'))
			const analysis = await runSecurityAnalysis(options)
			displaySecurityAnalysis(analysis)
		} catch (error) {
			console.error(
				chalk.red('❌ Failed to run security analysis:'),
				error.message,
			)
			process.exit(1)
		}
	})

/**
 * Compliance check command
 */
program
	.command('compliance')
	.description('Check compliance status and violations')
	.option('-e, --environment <env>', 'Environment name', DEFAULT_ENVIRONMENT)
	.option('-a, --application <app>', 'Application name', DEFAULT_APPLICATION)
	.action(async (options) => {
		try {
			console.log(chalk.blue('✅ Checking compliance status...'))
			const compliance = await checkCompliance(options)
			displayComplianceStatus(compliance)
		} catch (error) {
			console.error(chalk.red('❌ Failed to check compliance:'), error.message)
			process.exit(1)
		}
	})

/**
 * Security dashboard command
 */
program
	.command('dashboard')
	.description('Display security dashboard summary')
	.option('-e, --environment <env>', 'Environment name', DEFAULT_ENVIRONMENT)
	.option('-a, --application <app>', 'Application name', DEFAULT_APPLICATION)
	.action(async (options) => {
		try {
			console.log(chalk.blue('📈 Loading security dashboard...'))
			const dashboard = await getSecurityDashboard(options)
			displaySecurityDashboard(dashboard)
		} catch (error) {
			console.error(
				chalk.red('❌ Failed to load security dashboard:'),
				error.message,
			)
			process.exit(1)
		}
	})

/**
 * Get security events from DynamoDB
 */
async function getSecurityEvents(options: any) {
	const tableName = `${options.application}-${options.environment}-security-events`
	const sinceTime = new Date(
		Date.now() - parseInt(options.since) * 60 * 60 * 1000,
	)

	let command
	if (options.type || options.severity) {
		// Use GSI for filtered queries
		const indexName = options.type ? 'EventTypeIndex' : 'SeverityIndex'
		const keyCondition = options.type
			? 'eventType = :eventType'
			: 'severity = :severity'
		const attributeValues = options.type
			? { ':eventType': { S: options.type } }
			: { ':severity': { S: options.severity } }

		command = new QueryCommand({
			TableName: tableName,
			IndexName: indexName,
			KeyConditionExpression: keyCondition,
			ExpressionAttributeValues: attributeValues,
			Limit: parseInt(options.limit),
		})
	} else {
		// Scan for all events
		command = new ScanCommand({
			TableName: tableName,
			FilterExpression: '#timestamp > :sinceTime',
			ExpressionAttributeNames: {
				'#timestamp': 'timestamp',
			},
			ExpressionAttributeValues: {
				':sinceTime': { S: sinceTime.toISOString() },
			},
			Limit: parseInt(options.limit),
		})
	}

	const result = await dynamodb.send(command)
	return result.Items?.map(parseSecurityEvent).filter(Boolean) || []
}

/**
 * Get security metrics from CloudWatch
 */
async function getSecurityMetrics(options: any) {
	const endTime = new Date()
	const startTime = new Date(
		endTime.getTime() - parseInt(options.period) * 60 * 60 * 1000,
	)

	const metrics = await Promise.all([
		// Total security events
		cloudwatch.send(
			new GetMetricStatisticsCommand({
				Namespace: 'MacroAI/Security',
				MetricName: 'SecurityEvent',
				Dimensions: [
					{ Name: 'Environment', Value: options.environment },
					{ Name: 'Application', Value: options.application },
				],
				StartTime: startTime,
				EndTime: endTime,
				Period: 3600, // 1 hour
				Statistics: ['Sum'],
			}),
		),

		// Critical events
		cloudwatch.send(
			new GetMetricStatisticsCommand({
				Namespace: 'MacroAI/Security',
				MetricName: 'SecurityEvent',
				Dimensions: [
					{ Name: 'Environment', Value: options.environment },
					{ Name: 'Severity', Value: 'CRITICAL' },
					{ Name: 'Application', Value: options.application },
				],
				StartTime: startTime,
				EndTime: endTime,
				Period: 3600,
				Statistics: ['Sum'],
			}),
		),

		// Security risk score
		cloudwatch.send(
			new GetMetricStatisticsCommand({
				Namespace: 'MacroAI/Security',
				MetricName: 'SecurityRiskScore',
				Dimensions: [
					{ Name: 'Environment', Value: options.environment },
					{ Name: 'Application', Value: options.application },
				],
				StartTime: startTime,
				EndTime: endTime,
				Period: 3600,
				Statistics: ['Average'],
			}),
		),
	])

	return {
		totalEvents:
			metrics[0].Datapoints?.reduce((sum, dp) => sum + (dp.Sum || 0), 0) || 0,
		criticalEvents:
			metrics[1].Datapoints?.reduce((sum, dp) => sum + (dp.Sum || 0), 0) || 0,
		riskScore:
			metrics[2].Datapoints?.reduce((sum, dp) => sum + (dp.Average || 0), 0) /
				(metrics[2].Datapoints?.length || 1) || 0,
		period: options.period,
	}
}

/**
 * Run security analysis
 */
async function runSecurityAnalysis(options: any) {
	const functionName = `${options.application}-${options.environment}-security-analyzer`

	const result = await lambda.send(
		new InvokeCommand({
			FunctionName: functionName,
			Payload: JSON.stringify({
				environment: options.environment,
				application: options.application,
			}),
		}),
	)

	const payload = JSON.parse(new TextDecoder().decode(result.Payload))
	return payload.body || payload
}

/**
 * Check compliance status
 */
async function checkCompliance(options: any) {
	const functionName = `${options.application}-${options.environment}-compliance-checker`

	const result = await lambda.send(
		new InvokeCommand({
			FunctionName: functionName,
			Payload: JSON.stringify({
				environment: options.environment,
				application: options.application,
			}),
		}),
	)

	const payload = JSON.parse(new TextDecoder().decode(result.Payload))
	return payload.body || payload
}

/**
 * Get security dashboard data
 */
async function getSecurityDashboard(options: any) {
	const [events, metrics, alarms] = await Promise.all([
		getSecurityEvents({ ...options, limit: '10', since: '24' }),
		getSecurityMetrics({ ...options, period: '24' }),
		getSecurityAlarms(options),
	])

	return { events, metrics, alarms }
}

/**
 * Get security alarms
 */
async function getSecurityAlarms(options: any) {
	const result = await cloudwatch.send(
		new DescribeAlarmsCommand({
			AlarmNamePrefix: `${options.application}-${options.environment}`,
			StateValue: 'ALARM',
		}),
	)

	return result.MetricAlarms || []
}

/**
 * Parse security event from DynamoDB item
 */
function parseSecurityEvent(item: any) {
	if (!item) return null

	try {
		return {
			eventId: item.eventId?.S,
			timestamp: item.timestamp?.S,
			eventType: item.eventType?.S,
			severity: item.severity?.S,
			source: item.source?.S,
			description: item.description?.S,
			metadata: item.metadata?.M
				? Object.fromEntries(
						Object.entries(item.metadata.M).map(
							([key, value]: [string, any]) => [
								key,
								value.S || value.N || value.BOOL,
							],
						),
					)
				: {},
		}
	} catch (error) {
		console.warn('Failed to parse security event:', error)
		return null
	}
}

/**
 * Display security events in a table
 */
function displaySecurityEvents(events: any[]) {
	if (events.length === 0) {
		console.log(chalk.yellow('ℹ️  No security events found'))
		return
	}

	const table = new Table({
		head: [
			'Event ID',
			'Timestamp',
			'Type',
			'Severity',
			'Source',
			'Description',
		],
		colWidths: [20, 20, 20, 12, 15, 40],
	})

	events.forEach((event) => {
		const severityColor = getSeverityColor(event.severity)
		table.push([
			event.eventId?.substring(0, 18) + '...',
			new Date(event.timestamp).toLocaleString(),
			event.eventType,
			severityColor(event.severity),
			event.source,
			event.description?.substring(0, 35) + '...',
		])
	})

	console.log(table.toString())
	console.log(chalk.green(`\n✅ Found ${events.length} security events`))
}

/**
 * Display security metrics
 */
function displaySecurityMetrics(metrics: any) {
	console.log(chalk.bold('\n📊 Security Metrics Summary'))
	console.log(chalk.gray('─'.repeat(50)))

	const table = new Table({
		head: ['Metric', 'Value', 'Period'],
		colWidths: [25, 15, 15],
	})

	table.push(
		[
			'Total Security Events',
			metrics.totalEvents.toString(),
			`${metrics.period}h`,
		],
		[
			'Critical Events',
			chalk.red(metrics.criticalEvents.toString()),
			`${metrics.period}h`,
		],
		['Risk Score', metrics.riskScore.toFixed(1), 'Current'],
	)

	console.log(table.toString())

	// Risk assessment
	const riskLevel = getRiskLevel(metrics.riskScore)
	console.log(`\n🎯 Current Risk Level: ${riskLevel.color(riskLevel.level)}`)
}

/**
 * Display security analysis results
 */
function displaySecurityAnalysis(analysis: any) {
	console.log(chalk.bold('\n🔬 Security Analysis Results'))
	console.log(chalk.gray('─'.repeat(50)))

	if (analysis.error) {
		console.log(chalk.red(`❌ Analysis failed: ${analysis.error}`))
		return
	}

	console.log(`📈 Risk Score: ${chalk.yellow(analysis.riskScore || 'N/A')}`)
	console.log(
		`🔍 Threats Detected: ${chalk.red(analysis.threatsDetected || 0)}`,
	)
	console.log(`📊 Events Analyzed: ${analysis.eventsAnalyzed || 0}`)

	if (analysis.analysis?.threats?.length > 0) {
		console.log(chalk.bold('\n🚨 Detected Threats:'))
		const threatTable = new Table({
			head: ['Type', 'Severity', 'Confidence', 'Description'],
			colWidths: [20, 12, 12, 40],
		})

		analysis.analysis.threats.forEach((threat: any) => {
			const severityColor = getSeverityColor(threat.severity)
			threatTable.push([
				threat.type,
				severityColor(threat.severity),
				`${(threat.confidence * 100).toFixed(0)}%`,
				threat.description?.substring(0, 35) + '...',
			])
		})

		console.log(threatTable.toString())
	}

	if (analysis.analysis?.recommendations?.length > 0) {
		console.log(chalk.bold('\n💡 Recommendations:'))
		analysis.analysis.recommendations.forEach((rec: any, index: number) => {
			const priorityColor = getPriorityColor(rec.priority)
			console.log(
				`${index + 1}. ${priorityColor(rec.priority)}: ${rec.action} - ${rec.description}`,
			)
		})
	}
}

/**
 * Display compliance status
 */
function displayComplianceStatus(compliance: any) {
	console.log(chalk.bold('\n✅ Compliance Status'))
	console.log(chalk.gray('─'.repeat(50)))

	if (compliance.error) {
		console.log(chalk.red(`❌ Compliance check failed: ${compliance.error}`))
		return
	}

	console.log(`📋 Rules Checked: ${compliance.rulesChecked || 0}`)
	console.log(`❌ Violations: ${chalk.red(compliance.violations || 0)}`)

	if (compliance.complianceRate !== undefined) {
		const rate = compliance.complianceRate
		const rateColor =
			rate >= 95 ? chalk.green : rate >= 80 ? chalk.yellow : chalk.red
		console.log(`📊 Compliance Rate: ${rateColor(rate.toFixed(1) + '%')}`)
	}

	if (compliance.results?.length > 0) {
		const violations = compliance.results.filter(
			(r: any) => r.complianceType === 'NON_COMPLIANT',
		)

		if (violations.length > 0) {
			console.log(chalk.bold('\n❌ Compliance Violations:'))
			const violationTable = new Table({
				head: ['Rule', 'Resource Type', 'Resource ID', 'Status'],
				colWidths: [25, 20, 25, 15],
			})

			violations.slice(0, 10).forEach((violation: any) => {
				violationTable.push([
					violation.ruleName?.substring(0, 22) + '...',
					violation.resourceType || 'N/A',
					violation.resourceId?.substring(0, 22) + '...' || 'N/A',
					chalk.red('NON_COMPLIANT'),
				])
			})

			console.log(violationTable.toString())

			if (violations.length > 10) {
				console.log(
					chalk.gray(`... and ${violations.length - 10} more violations`),
				)
			}
		}
	}
}

/**
 * Display security dashboard
 */
function displaySecurityDashboard(dashboard: any) {
	console.log(chalk.bold('\n📈 Security Dashboard'))
	console.log(chalk.gray('═'.repeat(60)))

	// Recent events summary
	console.log(chalk.bold('\n🔍 Recent Security Events (Last 24h)'))
	if (dashboard.events?.length > 0) {
		const eventSummary = dashboard.events.reduce((acc: any, event: any) => {
			acc[event.severity] = (acc[event.severity] || 0) + 1
			return acc
		}, {})

		Object.entries(eventSummary).forEach(([severity, count]) => {
			const severityColor = getSeverityColor(severity)
			console.log(`  ${severityColor(severity)}: ${count}`)
		})
	} else {
		console.log(chalk.green('  ✅ No security events'))
	}

	// Metrics summary
	console.log(chalk.bold('\n📊 Security Metrics'))
	console.log(`  Total Events: ${dashboard.metrics?.totalEvents || 0}`)
	console.log(
		`  Critical Events: ${chalk.red(dashboard.metrics?.criticalEvents || 0)}`,
	)
	console.log(
		`  Risk Score: ${dashboard.metrics?.riskScore?.toFixed(1) || 'N/A'}`,
	)

	// Active alarms
	console.log(chalk.bold('\n🚨 Active Security Alarms'))
	if (dashboard.alarms?.length > 0) {
		dashboard.alarms.forEach((alarm: any) => {
			console.log(
				`  ${chalk.red('🔴')} ${alarm.AlarmName}: ${alarm.StateReason}`,
			)
		})
	} else {
		console.log(chalk.green('  ✅ No active alarms'))
	}

	console.log(chalk.gray('\n' + '═'.repeat(60)))
}

/**
 * Get color for severity level
 */
function getSeverityColor(severity: string) {
	switch (severity?.toUpperCase()) {
		case 'CRITICAL':
			return chalk.red.bold
		case 'HIGH':
			return chalk.red
		case 'MEDIUM':
			return chalk.yellow
		case 'LOW':
			return chalk.blue
		case 'INFO':
			return chalk.gray
		default:
			return chalk.white
	}
}

/**
 * Get color for priority level
 */
function getPriorityColor(priority: string) {
	switch (priority?.toUpperCase()) {
		case 'CRITICAL':
			return chalk.red.bold
		case 'HIGH':
			return chalk.red
		case 'MEDIUM':
			return chalk.yellow
		case 'LOW':
			return chalk.blue
		default:
			return chalk.white
	}
}

/**
 * Get risk level assessment
 */
function getRiskLevel(score: number) {
	if (score >= 80) {
		return { level: 'CRITICAL', color: chalk.red.bold }
	} else if (score >= 60) {
		return { level: 'HIGH', color: chalk.red }
	} else if (score >= 40) {
		return { level: 'MEDIUM', color: chalk.yellow }
	} else if (score >= 20) {
		return { level: 'LOW', color: chalk.blue }
	} else {
		return { level: 'MINIMAL', color: chalk.green }
	}
}

// Parse command line arguments
program.parse()

export { program }
