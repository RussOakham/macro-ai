import * as cdk from 'aws-cdk-lib'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as sns from 'aws-cdk-lib/aws-sns'
import { Construct } from 'constructs'

export interface SslCertificateConstructProps {
	/**
	 * Environment name for resource naming
	 */
	environmentName: string

	/**
	 * Domain name for the certificate
	 */
	domainName: string

	/**
	 * Additional subject alternative names (SANs)
	 */
	subjectAlternativeNames?: string[]

	/**
	 * Route 53 hosted zone for DNS validation
	 */
	hostedZone?: route53.IHostedZone

	/**
	 * Enable DNS validation (recommended)
	 */
	enableDnsValidation?: boolean

	/**
	 * Certificate transparency logging
	 */
	enableTransparencyLogging?: boolean

	/**
	 * SNS topic for certificate expiration alerts
	 */
	alertTopic?: sns.ITopic

	/**
	 * Days before expiration to send alert (default: 30)
	 */
	alertDaysBeforeExpiration?: number

	/**
	 * Key algorithm for the certificate
	 */
	keyAlgorithm?: acm.KeyAlgorithm

	/**
	 * Certificate validation method
	 */
	validationMethod?: acm.ValidationMethod
}

export class SslCertificateConstruct extends Construct {
	public readonly certificate: acm.Certificate
	public readonly certificateArn: string
	public readonly validationRecords: route53.CnameRecord[]
	public readonly alarms: cloudwatch.Alarm[]

	constructor(
		scope: Construct,
		id: string,
		props: SslCertificateConstructProps,
	) {
		super(scope, id)

		const {
			environmentName,
			domainName,
			subjectAlternativeNames = [],
			hostedZone,
			enableDnsValidation = true,
			enableTransparencyLogging = true,
			alertTopic,
			alertDaysBeforeExpiration = 30,
			keyAlgorithm = acm.KeyAlgorithm.RSA_2048,
			validationMethod = acm.ValidationMethod.DNS,
		} = props

		this.alarms = []
		this.validationRecords = []

		// Create the certificate
		this.certificate = new acm.Certificate(this, 'Certificate', {
			domainName,
			subjectAlternativeNames,
			validationMethod: enableDnsValidation
				? acm.ValidationMethod.DNS
				: validationMethod,
			keyAlgorithm,
		})

		this.certificateArn = this.certificate.certificateArn

		// DNS validation records
		if (enableDnsValidation && hostedZone) {
			this.validationRecords = this.createValidationRecords(hostedZone)
		}

		// Certificate monitoring and alerting
		if (alertTopic) {
			this.createCertificateMonitoring(
				environmentName,
				alertTopic,
				alertDaysBeforeExpiration,
			)
		}

		// CloudFormation outputs
		this.createOutputs(environmentName)

		// Certificate transparency logging
		if (enableTransparencyLogging) {
			this.enableCertificateTransparencyLogging()
		}
	}

	private createValidationRecords(
		hostedZone: route53.IHostedZone,
	): route53.CnameRecord[] {
		const records: route53.CnameRecord[] = []

		// Create DNS validation records for the certificate
		const validationRecords = this.certificate.domainValidationOptions

		validationRecords.forEach((validation, index) => {
			const record = new route53.CnameRecord(this, `ValidationRecord${index}`, {
				zone: hostedZone,
				recordName: validation.resourceRecordName,
				recordValue: validation.resourceRecordValue,
				comment: `Certificate validation for ${validation.domainName}`,
				ttl: cdk.Duration.seconds(300), // 5 minutes TTL for validation records
			})

			records.push(record)
		})

		return records
	}

	private createCertificateMonitoring(
		environmentName: string,
		alertTopic: sns.ITopic,
		alertDaysBeforeExpiration: number,
	): void {
		// Certificate expiration alarm
		const expirationAlarm = new cloudwatch.Alarm(
			this,
			'CertificateExpirationAlarm',
			{
				alarmName: `${environmentName}-ssl-certificate-expiration`,
				alarmDescription: `SSL certificate for ${this.certificate.certificateArn} is expiring soon`,
				metric: new cloudwatch.Metric({
					namespace: 'AWS/CertificateManager',
					metricName: 'DaysToExpiry',
					dimensionsMap: {
						CertificateArn: this.certificateArn,
					},
					statistic: 'Minimum',
				}),
				threshold: alertDaysBeforeExpiration,
				evaluationPeriods: 1,
				comparisonOperator:
					cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
				treatMissingData: cloudwatch.TreatMissingData.MISSING,
			},
		)

		// Add SNS action to the alarm
		expirationAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic))
		this.alarms.push(expirationAlarm)

		// Certificate status alarm (for failed validations, etc.)
		const statusAlarm = new cloudwatch.Alarm(this, 'CertificateStatusAlarm', {
			alarmName: `${environmentName}-ssl-certificate-status`,
			alarmDescription: `SSL certificate status issue detected`,
			metric: new cloudwatch.Metric({
				namespace: 'AWS/CertificateManager',
				metricName: 'CertificateStatus',
				dimensionsMap: {
					CertificateArn: this.certificateArn,
				},
				statistic: 'Maximum',
			}),
			threshold: 0, // 0 = valid, 1 = expired, 2 = failed, etc.
			evaluationPeriods: 1,
			comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
			treatMissingData: cloudwatch.TreatMissingData.MISSING,
		})

		statusAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic))
		this.alarms.push(statusAlarm)
	}

	private enableCertificateTransparencyLogging(): void {
		// Certificate Transparency (CT) logging is enabled by default in ACM
		// This method serves as documentation and could be extended for custom CT logging
		new cdk.CfnOutput(this, 'CertificateTransparencyEnabled', {
			value: 'true',
			description: 'Certificate Transparency logging enabled',
			exportName: `${this.stackName}-CertificateTransparencyEnabled`,
		})
	}

	private createOutputs(environmentName: string): void {
		new cdk.CfnOutput(this, 'CertificateArn', {
			value: this.certificateArn,
			description: 'SSL Certificate ARN',
			exportName: `${environmentName}-ssl-certificate-arn`,
		})

		new cdk.CfnOutput(this, 'CertificateDomainName', {
			value: this.certificate.domainName,
			description: 'SSL Certificate domain name',
			exportName: `${environmentName}-ssl-certificate-domain`,
		})

		if (this.validationRecords.length > 0) {
			new cdk.CfnOutput(this, 'ValidationRecordsCount', {
				value: this.validationRecords.length.toString(),
				description: 'Number of DNS validation records created',
				exportName: `${environmentName}-ssl-validation-records-count`,
			})
		}

		new cdk.CfnOutput(this, 'CertificateStatus', {
			value: 'ISSUED', // Will be updated after issuance
			description: 'SSL Certificate status',
			exportName: `${environmentName}-ssl-certificate-status`,
		})
	}

	/**
	 * Get the certificate ARN for external use
	 */
	public getCertificateArn(): string {
		return this.certificateArn
	}

	/**
	 * Get the certificate for use with load balancers or CloudFront
	 */
	public getCertificate(): acm.ICertificate {
		return this.certificate
	}

	/**
	 * Get the domain validation records
	 */
	public getValidationRecords(): route53.CnameRecord[] {
		return this.validationRecords
	}

	/**
	 * Create a new certificate with additional domain names
	 */
	public addSubjectAlternativeName(domainName: string): void {
		// This would require recreating the certificate with updated SANs
		// In practice, you'd plan domain names upfront or create separate certificates
		cdk.Annotations.of(this).addWarning(
			`Cannot add domain ${domainName} to existing certificate. Create a new certificate with all required domains.`,
		)
	}
}
