import {
	CloudWatchClient,
	PutMetricDataCommand,
	PutMetricAlarmCommand,
	StandardUnit,
} from '@aws-sdk/client-cloudwatch'
import {
	ACMClient,
	ListCertificatesCommand,
	DescribeCertificateCommand,
} from '@aws-sdk/client-acm'
import type { Context } from 'aws-lambda'

interface CertificateInfo {
	arn: string
	domainName: string
	status: string
	notBefore?: Date
	notAfter?: Date
	daysToExpiry?: number
	renewalEligibility: string
	failureReason?: string
}

interface SslMonitoringConfig {
	environment: string
	alertTopicArn?: string
	warningDays: number
	criticalDays: number
	regions: string[]
	enableDetailedMonitoring: boolean
}

function getMonitoringConfig(): SslMonitoringConfig {
	return {
		environment: process.env.ENVIRONMENT || 'development',
		alertTopicArn: process.env.ALERT_TOPIC_ARN,
		warningDays: parseInt(process.env.WARNING_DAYS || '30'),
		criticalDays: parseInt(process.env.CRITICAL_DAYS || '7'),
		regions: (process.env.MONITOR_REGIONS || 'us-east-1').split(','),
		enableDetailedMonitoring: process.env.ENABLE_DETAILED_MONITORING === 'true',
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handler(event: any, _context: Context): Promise<void> {
	try {
		const config = getMonitoringConfig()

		console.log('🔐 SSL Certificate Monitoring Started')
		console.log('Event:', JSON.stringify(event, null, 2))

		const allCertificates: CertificateInfo[] = []

		// Monitor certificates across all specified regions
		for (const region of config.regions) {
			try {
				const regionalCertificates = await monitorCertificatesInRegion(
					region,
					config,
				)
				allCertificates.push(...regionalCertificates)
			} catch (error) {
				console.warn(
					`⚠️ Failed to monitor certificates in region ${region}:`,
					error,
				)
			}
		}

		// Send metrics to CloudWatch
		await sendMetricsToCloudWatch(allCertificates, config)

		// Create or update alarms
		if (config.alertTopicArn) {
			await manageCertificateAlarms(allCertificates, config)
		}

		// Log summary
		const expiringSoon = allCertificates.filter(
			(cert) => (cert.daysToExpiry || 0) <= config.warningDays,
		)
		const expired = allCertificates.filter((cert) => cert.status === 'EXPIRED')

		console.log(
			`✅ SSL monitoring completed: ${allCertificates.length} certificates monitored`,
		)
		console.log(`📊 Certificates expiring soon: ${expiringSoon.length}`)
		console.log(`❌ Expired certificates: ${expired.length}`)

		if (expiringSoon.length > 0) {
			console.log(
				'Certificates expiring soon:',
				expiringSoon.map((c) => `${c.domainName}: ${c.daysToExpiry} days`),
			)
		}

		if (expired.length > 0) {
			console.log(
				'Expired certificates:',
				expired.map((c) => c.domainName),
			)
		}
	} catch (error) {
		console.error('❌ Error in SSL monitoring:', error)
		throw error
	}
}

async function monitorCertificatesInRegion(
	region: string,
	_config: SslMonitoringConfig,
): Promise<CertificateInfo[]> {
	const acm = new ACMClient({ region })

	// List all certificates
	const listCommand = new ListCertificatesCommand({
		Includes: {
			keyTypes: [
				'RSA_2048',
				'RSA_3072',
				'RSA_4096',
				'EC_prime256v1',
				'EC_secp384r1',
			],
		},
		MaxItems: 100, // Adjust as needed
	})

	const listResponse = await acm.send(listCommand)
	const certificates: CertificateInfo[] = []

	if (listResponse.CertificateSummaryList) {
		for (const certSummary of listResponse.CertificateSummaryList) {
			try {
				const describeCommand = new DescribeCertificateCommand({
					CertificateArn: certSummary.CertificateArn!,
				})

				const describeResponse = await acm.send(describeCommand)

				if (describeResponse.Certificate) {
					const cert = describeResponse.Certificate
					const certificateInfo: CertificateInfo = {
						arn: cert.CertificateArn!,
						domainName: cert.DomainName!,
						status: cert.Status || 'UNKNOWN',
						notBefore: cert.NotBefore,
						notAfter: cert.NotAfter,
						renewalEligibility: cert.RenewalEligibility || 'INELIGIBLE',
						failureReason: cert.FailureReason,
					}

					// Calculate days to expiry
					if (cert.NotAfter) {
						const now = new Date()
						const expiry = new Date(cert.NotAfter)
						const diffTime = expiry.getTime() - now.getTime()
						const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
						certificateInfo.daysToExpiry = diffDays
					}

					certificates.push(certificateInfo)

					// Log certificate details
					console.log(`📋 Certificate: ${cert.DomainName}`)
					console.log(`   Status: ${cert.Status}`)
					console.log(`   Expiry: ${cert.NotAfter}`)
					console.log(`   Days to expiry: ${certificateInfo.daysToExpiry}`)
					console.log(`   Renewal: ${cert.RenewalEligibility}`)
					if (cert.FailureReason) {
						console.log(`   Failure: ${cert.FailureReason}`)
					}
				}
			} catch (error) {
				console.warn(
					`⚠️ Failed to describe certificate ${certSummary.CertificateArn}:`,
					error,
				)
			}
		}
	}

	return certificates
}

async function sendMetricsToCloudWatch(
	certificates: CertificateInfo[],
	config: SslMonitoringConfig,
): Promise<void> {
	const cloudwatch = new CloudWatchClient({
		region: process.env.AWS_REGION || 'us-east-1',
	})

	const metrics = []

	// Certificate count metrics
	const totalCertificates = certificates.length
	const validCertificates = certificates.filter(
		(c) => c.status === 'ISSUED',
	).length
	const expiredCertificates = certificates.filter(
		(c) => c.status === 'EXPIRED',
	).length
	const expiringSoonCertificates = certificates.filter(
		(c) => (c.daysToExpiry || 0) <= config.warningDays,
	).length

	metrics.push(
		{
			MetricName: 'TotalCertificates',
			Value: totalCertificates,
			Unit: StandardUnit.Count,
			Dimensions: [
				{
					Name: 'Environment',
					Value: config.environment,
				},
			],
		},
		{
			MetricName: 'ValidCertificates',
			Value: validCertificates,
			Unit: StandardUnit.Count,
			Dimensions: [
				{
					Name: 'Environment',
					Value: config.environment,
				},
			],
		},
		{
			MetricName: 'ExpiredCertificates',
			Value: expiredCertificates,
			Unit: StandardUnit.Count,
			Dimensions: [
				{
					Name: 'Environment',
					Value: config.environment,
				},
			],
		},
		{
			MetricName: 'ExpiringSoonCertificates',
			Value: expiringSoonCertificates,
			Unit: StandardUnit.Count,
			Dimensions: [
				{
					Name: 'Environment',
					Value: config.environment,
				},
			],
		},
	)

	// Individual certificate metrics
	for (const cert of certificates) {
		if (cert.daysToExpiry !== undefined) {
			metrics.push({
				MetricName: 'DaysToExpiry',
				Value: cert.daysToExpiry,
				Unit: StandardUnit.Count,
				Dimensions: [
					{
						Name: 'Environment',
						Value: config.environment,
					},
					{
						Name: 'DomainName',
						Value: cert.domainName,
					},
				],
			})
		}
	}

	// Send metrics in batches (CloudWatch allows max 20 metrics per request)
	const batchSize = 20
	for (let i = 0; i < metrics.length; i += batchSize) {
		const batch = metrics.slice(i, i + batchSize)

		const command = new PutMetricDataCommand({
			Namespace: 'MacroAI/SSL',
			MetricData: batch,
		})

		try {
			await cloudwatch.send(command)
			console.log(`📤 Sent ${batch.length} SSL metrics to CloudWatch`)
		} catch (error) {
			console.warn('⚠️ Failed to send SSL metrics:', error)
		}
	}
}

async function manageCertificateAlarms(
	certificates: CertificateInfo[],
	config: SslMonitoringConfig,
): Promise<void> {
	const cloudwatch = new CloudWatchClient({
		region: process.env.AWS_REGION || 'us-east-1',
	})

	// Create alarms for certificates expiring soon
	for (const cert of certificates) {
		if ((cert.daysToExpiry || 0) <= config.warningDays) {
			try {
				const alarmName = `ssl-certificate-expiry-${cert.domainName.replace(/\./g, '-')}`

				const alarmCommand = new PutMetricAlarmCommand({
					AlarmName: alarmName,
					AlarmDescription: `SSL certificate for ${cert.domainName} is expiring in ${cert.daysToExpiry} days`,
					MetricName: 'DaysToExpiry',
					Namespace: 'MacroAI/SSL',
					Statistic: 'Minimum',
					Dimensions: [
						{
							Name: 'Environment',
							Value: config.environment,
						},
						{
							Name: 'DomainName',
							Value: cert.domainName,
						},
					],
					ComparisonOperator: 'LessThanOrEqualToThreshold',
					Threshold: config.criticalDays,
					EvaluationPeriods: 1,
					TreatMissingData: 'missing',
					ActionsEnabled: true,
					AlarmActions: config.alertTopicArn
						? [config.alertTopicArn]
						: undefined,
					OKActions: config.alertTopicArn ? [config.alertTopicArn] : undefined,
				})

				await cloudwatch.send(alarmCommand)
				console.log(
					`🚨 Created/updated alarm for ${cert.domainName}: ${cert.daysToExpiry} days to expiry`,
				)
			} catch (error) {
				console.warn(`⚠️ Failed to create alarm for ${cert.domainName}:`, error)
			}
		}
	}
}

// Export for testing
export {
	getMonitoringConfig,
	monitorCertificatesInRegion,
	sendMetricsToCloudWatch,
	manageCertificateAlarms,
}
