#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'

import 'source-map-support/register.js'

// Hobby stack removed - preview environments only
import { MacroAiPreviewStack } from './stacks/macro-ai-preview-stack.js'
import { TAG_VALUES, TaggingStrategy } from './utils/tagging-strategy.js'

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

// Detect ephemeral preview environments
const isPreviewEnvironment = deploymentEnv.startsWith('pr-')
const environmentType = isPreviewEnvironment ? 'ephemeral' : 'persistent'

// Create environment-specific stack
const stackName = `MacroAi${deploymentEnv.charAt(0).toUpperCase() + deploymentEnv.slice(1)}Stack`

// Create stack description
const stackDescription = isPreviewEnvironment
	? `Macro AI ${deploymentEnv} Preview Environment - ECS Fargate-based architecture (ephemeral)`
	: `Macro AI ${deploymentEnv} Environment - ECS Fargate-based architecture`

// Centralized tag generation using TaggingStrategy
const tags = isPreviewEnvironment
	? TaggingStrategy.createPrTags({
			prNumber: parseInt(deploymentEnv.replace('pr-', ''), 10),
			branch: process.env.GITHUB_HEAD_REF ?? 'unknown',
			component: 'preview-environment',
			purpose: TAG_VALUES.PURPOSES.PREVIEW_ENVIRONMENT,
			createdBy: 'github-actions',
			scale: 'preview',
			project: 'MacroAI',
			owner: `${deploymentEnv}-deployment`,
			monitoringLevel: TAG_VALUES.MONITORING_LEVELS.STANDARD,
			autoShutdown: true,
			expiryDays: 7,
			// Note: environment is derived from prNumber by createPrTags
		})
	: TaggingStrategy.createBaseTags({
			environment: deploymentEnv,
			environmentType: environmentType,
			component: 'shared-infrastructure',
			purpose: 'SharedInfrastructure',
			createdBy: 'github-actions',
			scale: 'standard',
			project: 'MacroAI',
			owner: `${deploymentEnv}-deployment`,
		})

// Create the appropriate stack based on environment type
if (isPreviewEnvironment) {
	// Extract PR number and branch name for preview environments
	const prNumber = parseInt(deploymentEnv.replace('pr-', ''), 10)
	const branchName =
		process.env.BRANCH_NAME ?? process.env.GITHUB_HEAD_REF ?? 'unknown'

	// Custom domain configuration for preview environments
	const customDomain = {
		domainName: 'macro-ai.russoakham.dev',
		hostedZoneId: 'Z10081873B648ARROPNER',
		apiSubdomain: `${deploymentEnv}-api`, // e.g., 'pr-56-api'
		// Note: certificateArn is optional - if not provided, the load balancer will create one
	}

	if (isNaN(prNumber)) {
		throw new Error(`Invalid PR number in environment name: ${deploymentEnv}`)
	}

	// Cost alert emails removed - focus on core ECS functionality

	new MacroAiPreviewStack(app, stackName, {
		env: {
			account,
			region,
		},
		description: stackDescription,
		environmentName: deploymentEnv,
		prNumber,
		branchName,
		scale: 'preview',
		customDomain,
		// Complex features removed - focus on core ECS functionality
		tags,
	})
} else {
	// Only preview environments are supported
	throw new Error(
		`Only preview environments (pr-*) are supported. Got: ${deploymentEnv}`,
	)
}

app.synth()
