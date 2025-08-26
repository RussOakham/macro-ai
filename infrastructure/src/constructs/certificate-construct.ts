import * as cdk from 'aws-cdk-lib'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as route53 from 'aws-cdk-lib/aws-route53'
import { Construct } from 'constructs'

export interface CertificateConstructProps {
	/**
	 * Custom domain configuration
	 */
	readonly customDomain: {
		readonly domainName: string
		readonly hostedZoneId: string
	}

	/**
	 * Environment name for resource naming and tagging
	 */
	readonly environmentName: string

	/**
	 * PR number for preview environment naming
	 */
	readonly prNumber: string
}

/**
 * Certificate Construct for Macro AI Preview Environments
 *
 * This construct automatically creates and validates ACM certificates for custom domains
 * used in preview environments. It handles DNS validation through Route53.
 */
export class CertificateConstruct extends Construct {
	public readonly certificate: acm.Certificate
	public readonly certificateArn: string

	constructor(scope: Construct, id: string, props: CertificateConstructProps) {
		super(scope, id)

		const { customDomain, environmentName, prNumber } = props

		// Import the hosted zone
		const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
			this,
			'HostedZone',
			{
				hostedZoneId: customDomain.hostedZoneId,
				zoneName: customDomain.domainName,
			},
		)

		// Create the certificate for API domain only (frontend will use CloudFront)
		const apiDomainName = `pr-${prNumber}-api.${customDomain.domainName}`

		this.certificate = new acm.Certificate(this, 'Certificate', {
			domainName: apiDomainName,
			validation: acm.CertificateValidation.fromDns(hostedZone),
			certificateName: `macro-ai-${environmentName}-api-cert`,
		})

		this.certificateArn = this.certificate.certificateArn

		// Add tags for resource identification
		cdk.Tags.of(this.certificate).add('Component', 'Certificate')
		cdk.Tags.of(this.certificate).add('Environment', environmentName)
		cdk.Tags.of(this.certificate).add('Domain', apiDomainName)
		cdk.Tags.of(this.certificate).add('PR', prNumber)

		// Output the certificate ARN
		new cdk.CfnOutput(this, 'CertificateArn', {
			value: this.certificateArn,
			description: 'ACM Certificate ARN for the preview domain',
			exportName: `${environmentName}-CertificateArn`,
		})

		console.log(`✅ Certificate created for domain: ${apiDomainName}`)
	}
}
