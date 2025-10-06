import * as pulumi from '@pulumi/pulumi'

/**
 * Create a StackReference to another Pulumi stack
 */
export function createStackReference(
	stackName: string,
	targetStackName: string,
): pulumi.StackReference {
	const org = pulumi.getOrganization()
	const fullyQualifiedStackName = `${org}/macro-ai-infrastructure/${targetStackName}`

	return new pulumi.StackReference(stackName, {
		name: fullyQualifiedStackName,
	})
}

/**
 * Get shared VPC resources from dev stack
 */
export function getSharedVpcResources(devStack: pulumi.StackReference) {
	return {
		vpcId: devStack.requireOutput('vpcId'),
		publicSubnetIds: devStack.requireOutput('publicSubnetIds'),
	}
}

/**
 * Get shared ALB resources from dev stack
 */
export function getSharedAlbResources(devStack: pulumi.StackReference) {
	return {
		albArn: devStack.requireOutput('albArn'),
		albDnsName: devStack.requireOutput('albDnsName'),
		albZoneId: devStack.requireOutput('albZoneId'),
		albSecurityGroupId: devStack.requireOutput('albSecurityGroupId'),
		httpListenerArn: devStack.requireOutput('httpListenerArn'),
		httpsListenerArn: devStack.requireOutput('httpsListenerArn'),
	}
}

/**
 * Safely get optional outputs from stack reference
 */
export function getOptionalOutput<T>(
	stackRef: pulumi.StackReference,
	outputName: string,
	defaultValue: T,
): pulumi.Output<T> {
	try {
		return stackRef.requireOutput(outputName) as pulumi.Output<T>
	} catch {
		return pulumi.output(defaultValue)
	}
}
