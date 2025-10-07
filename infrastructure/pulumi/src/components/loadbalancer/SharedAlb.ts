import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'
import type { acm } from '@pulumi/aws/types/output'
import { getCommonTags } from '../../config/tags'
import { APP_CONFIG } from '../../config/constants'
import { getCostOptimizedSettings } from '../../utils/environment'

export interface SharedAlbArgs {
	/**
	 * Environment name
	 */
	environmentName: string

	/**
	 * VPC ID where ALB will be created
	 */
	vpcId: pulumi.Input<string>

	/**
	 * Subnet IDs for ALB (must be public subnets)
	 */
	subnetIds: pulumi.Input<string[]>

	/**
	 * Security group ID for ALB
	 */
	securityGroupId: pulumi.Input<string>

	/**
	 * Base domain name for certificate (e.g., macro-ai.russoakham.dev)
	 */
	baseDomainName?: string

	/**
	 * Route53 Hosted Zone ID for DNS records
	 */
	hostedZoneId?: string

	/**
	 * Whether to enable deletion protection
	 */
	enableDeletionProtection?: boolean

	/**
	 * Common tags
	 */
	tags?: Record<string, string>
}

export class SharedAlb extends pulumi.ComponentResource {
	public readonly alb: aws.lb.LoadBalancer
	public readonly albArn: pulumi.Output<string>
	public readonly albDnsName: pulumi.Output<string>
	public readonly albZoneId: pulumi.Output<string>
	public readonly certificate?: aws.acm.Certificate
	public readonly httpListener: aws.lb.Listener
	public readonly httpsListener?: aws.lb.Listener

	constructor(
		name: string,
		args: SharedAlbArgs,
		opts?: pulumi.ComponentResourceOptions,
	) {
		super('macro-ai:loadbalancer:SharedAlb', name, {}, opts)

		const commonTags = getCommonTags(args.environmentName, args.environmentName)
		const costSettings = getCostOptimizedSettings(args.environmentName)

		// Create ALB
		this.alb = new aws.lb.LoadBalancer(
			`${name}-alb`,
			{
				name: `macro-ai-${args.environmentName}-alb`,
				loadBalancerType: 'application',
				securityGroups: [args.securityGroupId],
				subnets: args.subnetIds,
				enableDeletionProtection:
					args.enableDeletionProtection ??
					costSettings.enableDeletionProtection,
				tags: {
					Name: `macro-ai-${args.environmentName}-alb`,
					...commonTags,
					...args.tags,
				},
			},
			{ parent: this },
		)

		this.albArn = this.alb.arn
		this.albDnsName = this.alb.dnsName
		this.albZoneId = this.alb.zoneId

		// Create default target group (for HTTP listener default action)
		const defaultTargetGroup = new aws.lb.TargetGroup(
			`${name}-default-tg`,
			{
				name: `macro-ai-${args.environmentName}-default`,
				port: APP_CONFIG.port,
				protocol: 'HTTP',
				vpcId: args.vpcId,
				targetType: 'ip',
				healthCheck: {
					enabled: true,
					path: APP_CONFIG.healthEndpoint,
					matcher: '200',
				},
				tags: {
					Name: `macro-ai-${args.environmentName}-default-tg`,
					...commonTags,
					...args.tags,
				},
			},
			{ parent: this },
		)

		// Create HTTP listener (will redirect to HTTPS if cert provided)
		this.httpListener = new aws.lb.Listener(
			`${name}-http-listener`,
			{
				loadBalancerArn: this.alb.arn,
				port: 80,
				protocol: 'HTTP',
				defaultActions: [
					{
						type: 'forward',
						targetGroupArn: defaultTargetGroup.arn,
					},
				],
			},
			{ parent: this },
		)

		// Create HTTPS listener if domain provided
		if (args.baseDomainName && args.hostedZoneId) {
			// Create wildcard certificate for API subdomains (*.api.domain + api.domain)
			this.certificate = new aws.acm.Certificate(
				`${name}-certificate`,
				{
					domainName: `*.api.${args.baseDomainName}`,
					subjectAlternativeNames: [`api.${args.baseDomainName}`],
					validationMethod: 'DNS',
					tags: {
						Name: `macro-ai-api-wildcard-certificate`,
						CertificateType: 'shared',
						...commonTags,
						...args.tags,
					},
				},
				{ parent: this },
			)

			// Create DNS validation records
			const validationRecords = this.certificate.domainValidationOptions.apply(
				(options: acm.CertificateDomainValidationOption[]) => {
					const uniqueOptions = options.filter(
						(option, index, self) =>
							index ===
							self.findIndex(
								(o) =>
									o.resourceRecordName === option.resourceRecordName &&
									o.resourceRecordType === option.resourceRecordType,
							),
					)

					return uniqueOptions.map(
						(option, index) =>
							new aws.route53.Record(
								`${name}-cert-validation-${index}`,
								{
									name: option.resourceRecordName,
									records: [option.resourceRecordValue],
									ttl: 60,
									type: option.resourceRecordType,
									zoneId: args.hostedZoneId!,
									allowOverwrite: true,
								},
								{ parent: this },
							),
					)
				},
			)

			// Wait for certificate validation
			const certificateValidation = new aws.acm.CertificateValidation(
				`${name}-cert-validation`,
				{
					certificateArn: this.certificate.arn,
					validationRecordFqdns: validationRecords.apply((records) =>
						records.map((r) => r.fqdn),
					),
				},
				{ parent: this },
			)

			// Create HTTPS listener
			this.httpsListener = new aws.lb.Listener(
				`${name}-https-listener`,
				{
					loadBalancerArn: this.alb.arn,
					port: 443,
					protocol: 'HTTPS',
					certificateArn: certificateValidation.certificateArn,
					defaultActions: [
						{
							type: 'forward',
							targetGroupArn: defaultTargetGroup.arn,
						},
					],
				},
				{ parent: this },
			)

			// Redirect HTTP to HTTPS
			new aws.lb.ListenerRule(
				`${name}-redirect-rule`,
				{
					listenerArn: this.httpListener.arn,
					priority: 1,
					actions: [
						{
							type: 'redirect',
							redirect: {
								port: '443',
								protocol: 'HTTPS',
								statusCode: 'HTTP_301',
							},
						},
					],
					conditions: [
						{
							pathPattern: {
								values: ['/*'],
							},
						},
					],
				},
				{ parent: this },
			)
		}

		this.registerOutputs({
			albArn: this.albArn,
			albDnsName: this.albDnsName,
			httpListenerArn: this.httpListener.arn,
			httpsListenerArn: this.httpsListener?.arn,
		})
	}
}
