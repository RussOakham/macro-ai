import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'

import { getCommonTags } from '../../config/tags'

export interface AlbListenerRuleArgs {
	/**
	 * Environment name (for naming)
	 */
	environmentName: string

	/**
	 * ALB HTTPS Listener ARN
	 */
	listenerArn: pulumi.Input<string>

	/**
	 * Target group ARN to forward traffic to
	 */
	targetGroupArn: pulumi.Input<string>

	/**
	 * Custom domain name for host-based routing
	 */
	customDomainName: string

	/**
	 * Rule priority (must be unique per listener)
	 * Recommendation: Use PR number + 100 for PR previews
	 */
	priority: number

	/**
	 * Route53 Hosted Zone ID for creating DNS record
	 */
	hostedZoneId?: string

	/**
	 * ALB DNS name for Route53 alias record
	 */
	albDnsName?: pulumi.Input<string>

	/**
	 * ALB Zone ID for Route53 alias record
	 */
	albZoneId?: pulumi.Input<string>

	/**
	 * Common tags
	 */
	tags?: Record<string, string>
}

export class AlbListenerRule extends pulumi.ComponentResource {
	public readonly dnsRecord?: aws.route53.Record
	public readonly listenerRule: aws.lb.ListenerRule

	constructor(
		name: string,
		args: AlbListenerRuleArgs,
		opts?: pulumi.ComponentResourceOptions,
	) {
		super('macro-ai:loadbalancer:AlbListenerRule', name, {}, opts)

		const commonTags = getCommonTags(args.environmentName, args.environmentName)

		// Create listener rule with host-based routing
		this.listenerRule = new aws.lb.ListenerRule(
			`${name}-rule`,
			{
				listenerArn: args.listenerArn,
				priority: args.priority,
				actions: [
					{
						type: 'forward',
						targetGroupArn: args.targetGroupArn,
					},
				],
				conditions: [
					{
						hostHeader: {
							values: [args.customDomainName],
						},
					},
				],
				tags: {
					Name: `macro-ai-${args.environmentName}-listener-rule`,
					Environment: args.environmentName,
					...commonTags,
					...args.tags,
				},
			},
			{ parent: this },
		)

		// Create Route53 DNS record if zone provided
		if (args.hostedZoneId && args.albDnsName && args.albZoneId) {
			this.dnsRecord = new aws.route53.Record(
				`${name}-dns-record`,
				{
					name: args.customDomainName,
					type: 'A',
					zoneId: args.hostedZoneId,
					aliases: [
						{
							name: args.albDnsName,
							zoneId: args.albZoneId,
							evaluateTargetHealth: true,
						},
					],
				},
				{ parent: this },
			)
		}

		this.registerOutputs({
			listenerRuleArn: this.listenerRule.arn,
			dnsRecordFqdn: this.dnsRecord?.fqdn,
		})
	}
}
