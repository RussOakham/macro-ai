#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'

import 'source-map-support/register.js'

import { MacroAiHobbyStack } from './stacks/macro-ai-hobby-stack.js'
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
const deploymentScale = process.env.CDK_DEPLOY_SCALE ?? 'hobby'
const deploymentType = process.env.CDK_DEPLOY_TYPE ?? 'standard'

// Detect ephemeral preview environments
const isPreviewEnvironment = deploymentEnv.startsWith('pr-')
const isEC2Preview = deploymentType === 'ec2-preview'
const environmentType = isPreviewEnvironment ? 'ephemeral' : 'persistent'

// Create environment-specific stack
const stackName = `MacroAi${deploymentEnv.charAt(0).toUpperCase() + deploymentEnv.slice(1)}Stack`

// Create stack description based on deployment type
let stackDescription: string
if (isEC2Preview) {
	stackDescription = `Macro AI ${deploymentEnv} Preview Environment - EC2-based architecture (ephemeral)`
} else {
	const ephemeralSuffix = isPreviewEnvironment ? ' (ephemeral)' : ''
	stackDescription = `Macro AI ${deploymentEnv} Environment - ${deploymentScale} scale serverless architecture${ephemeralSuffix}`
}

// Centralized tag generation using TaggingStrategy
const tags = isPreviewEnvironment
	? TaggingStrategy.createPrTags({
			prNumber: parseInt(deploymentEnv.replace('pr-', ''), 10),
			branch: process.env.GITHUB_HEAD_REF ?? 'unknown',
			component: 'preview-environment',
			purpose: TAG_VALUES.PURPOSES.PREVIEW_ENVIRONMENT,
			createdBy: 'github-actions',
			scale: deploymentScale,
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
			scale: deploymentScale,
			project: 'MacroAI',
			owner: `${deploymentEnv}-deployment`,
		})

// Create the appropriate stack based on deployment type
if (isEC2Preview && isPreviewEnvironment) {
	// Extract PR number and branch name for preview environments
	const prNumber = parseInt(deploymentEnv.replace('pr-', ''), 10)
	const branchName =
		process.env.BRANCH_NAME ?? process.env.GITHUB_HEAD_REF ?? 'unknown'
	const corsAllowedOrigins =
		process.env.CORS_ALLOWED_ORIGINS ??
		'http://localhost:3000,http://localhost:5173'

	if (isNaN(prNumber)) {
		throw new Error(`Invalid PR number in environment name: ${deploymentEnv}`)
	}

	// Parse cost alert emails from environment variable
	const costAlertEmailsEnv = process.env.COST_ALERT_EMAILS
	const costAlertEmails = costAlertEmailsEnv
		? costAlertEmailsEnv.split(',').map((email) => email.trim()).filter(Boolean)
		: undefined

	new MacroAiPreviewStack(app, stackName, {
		env: {
			account,
			region,
		},
		description: stackDescription,
		environmentName: deploymentEnv,
		prNumber,
		branchName,
		corsAllowedOrigins,
		scale: deploymentScale,
		costAlertEmails,
		tags,
	})
} else {
	// Use the standard hobby stack for non-preview environments
	new MacroAiHobbyStack(app, stackName, {
		env: {
			account,
			region,
		},
		description: stackDescription,
		environmentName: deploymentEnv,
		tags,
	})
}

app.synth()
