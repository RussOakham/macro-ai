import * as aws from '@pulumi/aws'
import * as awsx from '@pulumi/awsx'
import * as pulumi from '@pulumi/pulumi'

import { AWS_LIMITS } from '../../config/constants'
import { getCommonTags } from '../../config/tags'
import { getCostOptimizedSettings } from '../../utils/environment'

export interface SharedVpcArgs {
	/**
	 * Environment name (dev, staging, production, pr-*)
	 */
	environmentName: string

	/**
	 * Optional: Existing VPC ID to reference instead of creating new
	 */
	existingVpcId?: pulumi.Input<string>

	/**
	 * CIDR block for new VPC (only if creating new)
	 */
	cidrBlock?: string

	/**
	 * Number of availability zones
	 */
	numberOfAvailabilityZones?: number

	/**
	 * Whether to create NAT gateways (expensive, usually false for dev/preview)
	 */
	createNatGateways?: boolean

	/**
	 * Common tags to apply to all resources
	 */
	tags?: Record<string, string>
}

export class SharedVpc extends pulumi.ComponentResource {
	public readonly privateSubnetIds?: pulumi.Output<string[]>
	public readonly publicSubnetIds: pulumi.Output<string[]>
	public readonly vpc: awsx.ec2.Vpc
	public readonly vpcId: pulumi.Output<string>

	constructor(
		name: string,
		args: SharedVpcArgs,
		opts?: pulumi.ComponentResourceOptions,
	) {
		super('macro-ai:networking:SharedVpc', name, {}, opts)

		const commonTags = getCommonTags(args.environmentName, args.environmentName)
		const costSettings = getCostOptimizedSettings(args.environmentName)

		if (args.existingVpcId) {
			// Reference existing VPC (for PR previews)
			const existingVpc = aws.ec2.Vpc.get(
				`${name}-existing`,
				args.existingVpcId,
				{},
				{ parent: this },
			)

			// Get subnets from existing VPC
			const subnets = aws.ec2.getSubnetsOutput(
				{
					filters: [
						{
							name: 'vpc-id',
							values: [args.existingVpcId],
						},
					],
				},
				{ parent: this },
			)

			// Create awsx VPC wrapper for existing VPC - no new resources provisioned
			// Use the existing VPC ID as the resource ID to prevent creation of new resources
			this.vpc = new awsx.ec2.Vpc(
				`${name}-existing-wrapper`,
				{}, // Empty args since we're referencing existing VPC
				{
					parent: this,
					id: args.existingVpcId, // This makes it reference existing VPC
				},
			)

			this.vpcId = existingVpc.id
			this.publicSubnetIds = subnets.ids
		} else {
			// Create new VPC
			const createNatGateways =
				args.createNatGateways ?? costSettings.enableNatGateways

			this.vpc = new awsx.ec2.Vpc(
				name,
				{
					cidrBlock: args.cidrBlock || AWS_LIMITS.vpcCidrBlock,
					numberOfAvailabilityZones: args.numberOfAvailabilityZones || 2,
					enableDnsHostnames: true,
					enableDnsSupport: true,
					natGateways: {
						strategy: createNatGateways ? 'Single' : 'None',
					},
					tags: {
						Name: `${args.environmentName}-vpc`,
						...commonTags,
						...args.tags,
					},
				},
				{ parent: this },
			)

			this.vpcId = this.vpc.vpcId
			this.publicSubnetIds = this.vpc.publicSubnetIds
			this.privateSubnetIds = this.vpc.privateSubnetIds
		}

		this.registerOutputs({
			vpcId: this.vpcId,
			publicSubnetIds: this.publicSubnetIds,
		})
	}
}
