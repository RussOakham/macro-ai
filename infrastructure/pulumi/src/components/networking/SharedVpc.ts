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

// Interface for existing VPC references (doesn't create resources)
interface ExistingVpcReference {
	vpcId: pulumi.Output<string>
	publicSubnetIds: pulumi.Output<string[]>
	privateSubnetIds?: pulumi.Output<string[]>
}

export class SharedVpc extends pulumi.ComponentResource {
	public privateSubnetIds?: pulumi.Output<string[]>
	public publicSubnetIds: pulumi.Output<string[]>
	public vpc: awsx.ec2.Vpc | ExistingVpcReference
	public vpcId: pulumi.Output<string>

	constructor(
		name: string,
		args: SharedVpcArgs,
		opts?: pulumi.ComponentResourceOptions,
	) {
		super('macro-ai:networking:SharedVpc', name, {}, opts)

		// Initialize properties that will be set in conditional blocks
		this.vpcId = pulumi.output('')
		this.publicSubnetIds = pulumi.output([])

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

			// For existing VPCs, create a reference object that doesn't provision resources
			const existingVpcRef: ExistingVpcReference = {
				vpcId: existingVpc.id,
				publicSubnetIds: subnets.ids,
				privateSubnetIds: pulumi.output([]), // No private subnets in existing VPC for now
			}

			this.vpc = existingVpcRef

			// Set properties for existing VPC case
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

			// For new VPCs, get properties from the awsx VPC object
			// For existing VPCs, these are already set above
			if (this.vpc instanceof awsx.ec2.Vpc) {
				this.vpcId = this.vpc.vpcId
				this.publicSubnetIds = this.vpc.publicSubnetIds
				this.privateSubnetIds = this.vpc.privateSubnetIds
			}
			// Note: For existing VPCs, vpcId and publicSubnetIds are already set above
		}

		this.registerOutputs({
			vpcId: this.vpcId,
			publicSubnetIds: this.publicSubnetIds,
		})
	}
}
