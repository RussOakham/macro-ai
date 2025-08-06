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

// Create the main hobby deployment stack
new MacroAiHobbyStack(app, 'MacroAiHobbyStack', {
	env: {
		account,
		region,
	},
	description:
		'Macro AI Hobby Deployment - Cost-optimized serverless architecture',
	tags: {
		Project: 'MacroAI',
		Environment: 'hobby',
		CostCenter: 'personal',
		Owner: 'hobby-deployment',
	},
})

app.synth()
