#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'

import 'source-map-support/register.js'

import { MacroAiHobbyStack } from './stacks/macro-ai-hobby-stack.js'

const app = new cdk.App()

// Get environment configuration
const account = process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_ACCOUNT_ID
const region =
	process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? 'us-east-1'

if (!account) {
	throw new Error(
		'AWS account ID must be provided via CDK_DEFAULT_ACCOUNT or AWS_ACCOUNT_ID environment variable',
	)
}

// Get deployment configuration
const deploymentEnv = process.env.CDK_DEPLOY_ENV ?? 'development'
const deploymentScale = process.env.CDK_DEPLOY_SCALE ?? 'hobby'

// Detect ephemeral preview environments
const isPreviewEnvironment = deploymentEnv.startsWith('pr-')
const environmentType = isPreviewEnvironment ? 'ephemeral' : 'persistent'

// Create environment-specific stack
const stackName = `MacroAi${deploymentEnv.charAt(0).toUpperCase() + deploymentEnv.slice(1)}Stack`
const stackDescription = `Macro AI ${deploymentEnv} Environment - ${deploymentScale} scale serverless architecture${isPreviewEnvironment ? ' (ephemeral)' : ''}`

// Build comprehensive tags for resource management and cost allocation
const baseTags = {
	Project: 'MacroAI',
	Environment: deploymentEnv,
	EnvironmentType: environmentType,
	Scale: deploymentScale,
	CostCenter: deploymentEnv === 'production' ? 'production' : 'development',
	Owner: `${deploymentEnv}-deployment`,
	CreatedBy: 'github-actions',
}

// Add preview-specific tags for ephemeral environments
const tags = isPreviewEnvironment
	? {
			...baseTags,
			PrNumber: deploymentEnv.replace('pr-', ''),
			Branch: process.env.GITHUB_HEAD_REF ?? 'unknown',
			// Optional: Add TTL for governance (could be used by cleanup automation)
			ExpiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
		}
	: baseTags

new MacroAiHobbyStack(app, stackName, {
	env: {
		account,
		region,
	},
	description: stackDescription,
	environmentName: deploymentEnv,
	tags,
})

app.synth()
