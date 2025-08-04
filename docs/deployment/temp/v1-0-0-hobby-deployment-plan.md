# Macro AI v1.0.0 Hobby Deployment Plan

**Status**: 📋 PLANNED  
**Version**: v1.0.0 (Hobby Edition)  
**Target Date**: TBD  
**Environment**: Personal/Hobby Projects  
**Target Cost**: <£10 ($12 USD) per month

## 🎯 Executive Summary

This document provides a cost-optimized deployment plan for Macro AI v1.0.0 specifically designed for personal hobby
projects with minimal traffic expectations.

The architecture leverages AWS free tier services and alternative free/low-cost providers to maintain full functionality
while targeting total monthly costs under £10 ($12 USD).

The hobby deployment maintains the same core features as the production architecture:

- React UI with modern tooling
- Express API with OpenAPI documentation
- PostgreSQL database with pgvector support
- Redis caching for performance
- AWS Cognito authentication
- AI chat functionality with OpenAI integration

## 💰 Cost Analysis: Production vs Hobby

### Current Production Architecture Costs (Minimal Traffic)

For <100 users and <1000 requests/day, the production architecture would cost:

```text
ECS Fargate (1 task, 0.25 vCPU, 512MB):    £12.50/month
RDS PostgreSQL t3.micro (24/7):            £10.40/month
ElastiCache Redis t3.micro:                 £9.20/month
Application Load Balancer:                  £13.50/month
CloudFront (within free tier):              £0.00/month
S3 Storage (within free tier):              £0.40/month
Data Transfer:                              £0.80/month
CloudWatch Logs:                            £1.60/month
Total Production Cost:                      £48.40/month
```

**❌ Problem**: Production architecture costs ~£48/month, nearly 5x over the £10 target.

### Hobby Architecture Cost Breakdown

```text
AWS Lambda (API Backend):                   £0.00/month (free tier)
Neon PostgreSQL (Database):                 £0.00/month (free tier)
Upstash Redis (Caching):                    £0.00/month (free tier)
API Gateway (Load Balancing):               £0.00/month (free tier)
AWS Amplify (Frontend Hosting):             £0.00/month (free tier)
AWS Cognito (Authentication):               £0.00/month (free tier)
AWS Systems Manager Parameter Store:        £0.00/month (free tier)
S3 (File Storage):                          £0.00/month (free tier)
CloudWatch (Basic Monitoring):              £0.00/month (free tier)
Domain Name (optional):                     £10.00/year (£0.83/month)
Total Hobby Cost:                           £0.83/month
```

**✅ Solution**: Hobby architecture costs <£1/month, well under the £10 target.

## 🏗️ Hobby Architecture Overview

### Service Comparison Matrix

| Component          | Production Solution | Hobby Alternative | Monthly Cost | Free Tier Limits             |
| ------------------ | ------------------- | ----------------- | ------------ | ---------------------------- |
| **API Backend**    | ECS Fargate         | AWS Lambda        | £0           | 1M requests/month            |
| **Database**       | RDS PostgreSQL      | Neon PostgreSQL   | £0           | 512MB storage, pgvector      |
| **Caching**        | ElastiCache Redis   | Upstash Redis     | £0           | 10k requests/day             |
| **Load Balancer**  | ALB                 | API Gateway       | £0           | 1M API calls/month           |
| **Frontend**       | ECS + CloudFront    | AWS Amplify       | £0           | 15GB bandwidth, 1k build min |
| **Authentication** | AWS Cognito         | AWS Cognito       | £0           | 50k MAU                      |
| **Secrets**        | AWS Secrets Manager | Parameter Store   | £0           | 10k API calls/month          |
| **File Storage**   | S3                  | S3                | £0           | 5GB storage                  |
| **Monitoring**     | CloudWatch          | CloudWatch        | £0           | Basic metrics                |

### Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────┐
│                 Hobby Architecture (£0.83/month)            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Users ──► AWS Amplify ──► React UI (Amplify Hosting)      │
│     │           │                                           │
│     │           └──► CloudFront CDN (Built-in)             │
│     │                                                       │
│     └──► API Gateway ──► Lambda Functions                   │
│                    │            │                          │
│                    │            ├──► Neon PostgreSQL       │
│                    │            │    (pgvector support)    │
│                    │            │                          │
│                    │            ├──► Upstash Redis         │
│                    │            │    (Session cache)       │
│                    │            │                          │
│                    │            └──► OpenAI API            │
│                    │                                        │
│                    └──► AWS Cognito (Authentication)       │
│                                                             │
│  🎯 Target: <100 users, <1000 requests/day                 │
│  💰 Cost: £0.83/month (domain only)                        │
│  🚀 Performance: 200-500ms (including cold starts)        │
│  🔗 AWS Native: Better integration across services         │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Free Tier Service Details

### 1. AWS Lambda (API Backend)

**Free Tier Limits:**

- 1 million requests per month
- 400,000 GB-seconds of compute time
- Always free (not just first 12 months)

**Your Usage (<1000 requests/day):**

- ~30,000 requests/month
- Well within free tier limits
- Cost: £0/month

**Configuration:**

```typescript
// Recommended Lambda configuration
{
  runtime: 'nodejs20.x',
  memorySize: 512, // MB
  timeout: 30,     // seconds
  environment: {
    NODE_ENV: 'production',
    NEON_DATABASE_URL: process.env.NEON_DATABASE_URL,
    UPSTASH_REDIS_URL: process.env.UPSTASH_REDIS_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY
  }
}
```

### 2. Neon PostgreSQL (Database)

**Free Tier Limits:**

- 512 MB storage
- 1 compute unit (0.25 vCPU)
- pgvector extension supported
- 1 database per project

**Your Usage (Personal project):**

- Estimated 50-100MB for personal chat data
- Well within storage limits
- Cost: £0/month

**Features:**

- Automatic scaling to zero
- Built-in connection pooling
- Database branching for development
- Point-in-time recovery

### 3. Upstash Redis (Caching)

**Free Tier Limits:**

- 10,000 requests per day
- 256 MB storage
- Global replication
- REST API access

**Your Usage (<1000 requests/day):**

- Cache hit ratio ~80% = ~200 cache requests/day
- Well within daily limits
- Cost: £0/month

**Use Cases:**

- Session storage
- API response caching
- Rate limiting data
- Temporary chat state

### 4. API Gateway (Load Balancing)

**Free Tier Limits:**

- 1 million API calls per month
- Always free tier

**Your Usage (~30k requests/month):**

- Well within limits
- Cost: £0/month

**Features:**

- Built-in throttling
- Request/response transformation
- CORS handling
- Monitoring and logging

### 5. AWS Amplify (Frontend Hosting)

**Free Tier Limits:**

- 1,000 build minutes per month
- 15 GB served per month
- Unlimited requests
- Always free (not just first 12 months)

**Your Usage (Personal project):**

- Estimated 10 builds/month × 2 minutes = 20 minutes
- Estimated 1-5 GB bandwidth/month
- Well within limits
- Cost: £0/month

**Features:**

- Git integration with GitHub/GitLab
- Built-in CloudFront CDN
- Custom domains with Route 53 integration
- Environment-specific deployments
- Native AWS Cognito integration
- Automatic HTTPS certificates

### 6. AWS Systems Manager Parameter Store (Secrets Management)

**Free Tier Limits:**

- 10,000 standard parameter API calls per month
- Unlimited advanced parameter storage
- AWS managed KMS encryption included
- Always free (not just first 12 months)

**Your Usage (Personal project):**

- Estimated 1,000 parameter retrievals/month
- 5-8 parameters for secrets storage
- Well within free tier limits
- Cost: £0/month

**Security Features:**

- AES-256 encryption at rest
- TLS 1.2+ encryption in transit
- AWS managed or customer managed KMS keys
- CloudTrail integration for audit logging
- IAM-based access control
- Parameter hierarchies for organization

**Parameter Types:**

- **Standard Parameters**: Free, 4KB limit, AWS managed keys
- **Advanced Parameters**: £0.05 per 10k calls, 8KB limit, customer managed keys
- **SecureString**: Encrypted parameters for sensitive data

## 🔐 Enhanced Security Implementation

### Secure Hobby Secrets Manager

```typescript
// src/config/secure-secrets.ts
import {
	SSMClient,
	GetParameterCommand,
	PutParameterCommand,
} from '@aws-sdk/client-ssm'

export class SecureHobbySecretsManager {
	private static readonly ssmClient = new SSMClient({
		region: process.env.AWS_REGION || 'us-east-1',
	})

	private static readonly cache = new Map<
		string,
		{ value: string; expires: number }
	>()

	// Critical secrets requiring advanced parameters
	private static readonly CRITICAL_SECRETS = [
		'openai-api-key',
		'neon-database-url',
	]

	// Non-critical secrets using standard parameters
	private static readonly NON_CRITICAL_SECRETS = [
		'upstash-redis-url',
		'cognito-user-pool-id',
		'cognito-user-pool-client-id',
	]

	static async getSecret(
		parameterName: string,
		useCache = true,
	): Promise<string> {
		// Check cache first (5-minute TTL)
		if (useCache) {
			const cached = this.cache.get(parameterName)
			if (cached && Date.now() < cached.expires) {
				return cached.value
			}
		}

		try {
			const isCritical = this.CRITICAL_SECRETS.includes(parameterName)
			const fullParameterName = isCritical
				? `/macro-ai/prod/critical/${parameterName}`
				: `/macro-ai/prod/standard/${parameterName}`

			const command = new GetParameterCommand({
				Name: fullParameterName,
				WithDecryption: true,
			})

			const response = await this.ssmClient.send(command)
			const value = response.Parameter?.Value

			if (!value) {
				throw new Error(`Parameter ${parameterName} not found`)
			}

			// Log access for audit trail
			console.log(`Secret accessed: ${parameterName}`, {
				timestamp: new Date().toISOString(),
				source: 'lambda',
				parameter: parameterName,
				critical: isCritical,
			})

			// Cache for 5 minutes
			if (useCache) {
				this.cache.set(parameterName, {
					value,
					expires: Date.now() + 5 * 60 * 1000,
				})
			}

			return value
		} catch (error) {
			console.error(`Failed to retrieve parameter ${parameterName}:`, error)
			throw error
		}
	}

	// Manual rotation for critical secrets
	static async rotateCriticalSecrets(): Promise<void> {
		console.log('Starting manual rotation of critical secrets')

		for (const secretName of this.CRITICAL_SECRETS) {
			try {
				await this.rotateSecretByType(secretName)
				console.log(`Successfully rotated: ${secretName}`)
			} catch (error) {
				console.error(`Failed to rotate ${secretName}:`, error)
			}
		}
	}

	private static async rotateSecretByType(secretName: string): Promise<void> {
		switch (secretName) {
			case 'openai-api-key':
				// Implement OpenAI API key rotation logic
				console.log('Manual OpenAI key rotation required')
				break
			case 'neon-database-url':
				// Implement database credential rotation logic
				console.log('Manual database credential rotation required')
				break
			default:
				console.log(`No rotation logic defined for ${secretName}`)
		}
	}

	// Fallback to environment variables for non-sensitive config
	static getEnvVar(key: string, defaultValue?: string): string {
		const value = process.env[key]
		if (!value && !defaultValue) {
			throw new Error(`Environment variable ${key} is required`)
		}
		return value || defaultValue!
	}
}
```

### Manual Rotation Procedures

**Monthly API Key Rotation:**

```typescript
// scripts/rotate-api-keys.ts
import { SecureHobbySecretsManager } from '../src/config/secure-secrets'
import { SSMClient, PutParameterCommand } from '@aws-sdk/client-ssm'

export class ManualRotationProcedures {
	private static readonly ssmClient = new SSMClient({})

	static async rotateOpenAIKey(newApiKey: string): Promise<void> {
		try {
			// Test new API key first
			const testResponse = await fetch('https://api.openai.com/v1/models', {
				headers: {
					Authorization: `Bearer ${newApiKey}`,
				},
			})

			if (!testResponse.ok) {
				throw new Error('New OpenAI API key validation failed')
			}

			// Update parameter
			await this.ssmClient.send(
				new PutParameterCommand({
					Name: '/macro-ai/prod/critical/openai-api-key',
					Value: newApiKey,
					Type: 'SecureString',
					Overwrite: true,
				}),
			)

			console.log('OpenAI API key rotated successfully')
		} catch (error) {
			console.error('Failed to rotate OpenAI API key:', error)
			throw error
		}
	}

	static async rotateDatabaseCredentials(
		newConnectionString: string,
	): Promise<void> {
		try {
			// Test new connection string
			// Implementation depends on your database client

			// Update parameter
			await this.ssmClient.send(
				new PutParameterCommand({
					Name: '/macro-ai/prod/critical/neon-database-url',
					Value: newConnectionString,
					Type: 'SecureString',
					Overwrite: true,
				}),
			)

			console.log('Database credentials rotated successfully')
		} catch (error) {
			console.error('Failed to rotate database credentials:', error)
			throw error
		}
	}
}
```

## 📋 Implementation Guide

### Phase 1: Secrets Management Setup (Day 1)

**1. Set up AWS Systems Manager Parameter Store:**

```bash
# Install AWS CLI if not already installed
aws --version

# Create parameter hierarchy for critical secrets (Advanced Parameters)
aws ssm put-parameter \
  --name "/macro-ai/prod/critical/openai-api-key" \
  --value "PLACEHOLDER_OPENAI_KEY" \
  --type "SecureString" \
  --tier "Advanced" \
  --description "OpenAI API key for macro-ai hobby deployment"

aws ssm put-parameter \
  --name "/macro-ai/prod/critical/neon-database-url" \
  --value "PLACEHOLDER_DATABASE_URL" \
  --type "SecureString" \
  --tier "Advanced" \
  --description "Neon PostgreSQL connection string"

# Create parameter hierarchy for standard secrets (Standard Parameters)
aws ssm put-parameter \
  --name "/macro-ai/prod/standard/upstash-redis-url" \
  --value "PLACEHOLDER_REDIS_URL" \
  --type "SecureString" \
  --description "Upstash Redis connection string"

aws ssm put-parameter \
  --name "/macro-ai/prod/standard/cognito-user-pool-id" \
  --value "PLACEHOLDER_USER_POOL_ID" \
  --type "String" \
  --description "AWS Cognito User Pool ID"

aws ssm put-parameter \
  --name "/macro-ai/prod/standard/cognito-user-pool-client-id" \
  --value "PLACEHOLDER_CLIENT_ID" \
  --type "String" \
  --description "AWS Cognito User Pool Client ID"
```

**2. Update Lambda Environment Configuration:**

```typescript
// src/config/environment.ts
import { SecureHobbySecretsManager } from './secure-secrets'

export class EnvironmentConfig {
	private static secrets: { [key: string]: string } = {}

	static async initialize(): Promise<void> {
		try {
			// Load critical secrets
			this.secrets.openaiApiKey =
				await SecureHobbySecretsManager.getSecret('openai-api-key')
			this.secrets.databaseUrl =
				await SecureHobbySecretsManager.getSecret('neon-database-url')

			// Load standard secrets
			this.secrets.redisUrl =
				await SecureHobbySecretsManager.getSecret('upstash-redis-url')
			this.secrets.userPoolId = await SecureHobbySecretsManager.getSecret(
				'cognito-user-pool-id',
			)
			this.secrets.userPoolClientId = await SecureHobbySecretsManager.getSecret(
				'cognito-user-pool-client-id',
			)

			console.log('Environment configuration loaded successfully')
		} catch (error) {
			console.error('Failed to load environment configuration:', error)
			throw error
		}
	}

	static get(key: string): string {
		const value = this.secrets[key]
		if (!value) {
			throw new Error(`Configuration key '${key}' not found`)
		}
		return value
	}
}
```

**3. Create IAM Policy for Lambda Parameter Access:**

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": [
				"ssm:GetParameter",
				"ssm:GetParameters",
				"ssm:GetParametersByPath"
			],
			"Resource": [
				"arn:aws:ssm:*:*:parameter/macro-ai/prod/critical/*",
				"arn:aws:ssm:*:*:parameter/macro-ai/prod/standard/*"
			]
		},
		{
			"Effect": "Allow",
			"Action": ["kms:Decrypt"],
			"Resource": ["arn:aws:kms:*:*:alias/aws/ssm"]
		}
	]
}
```

### Phase 2: Database Setup (Day 1)

**1. Create Neon PostgreSQL Database:**

```bash
# Sign up at neon.tech
# Create new project: "macro-ai-hobby"
# Enable pgvector extension in SQL editor:

CREATE EXTENSION IF NOT EXISTS vector;

# Test pgvector functionality:
CREATE TABLE test_embeddings (
  id SERIAL PRIMARY KEY,
  content TEXT,
  embedding vector(1536)
);
```

**2. Update Environment Variables:**

```bash
# .env.local
NEON_DATABASE_URL=postgresql://username:password@ep-xxx.neon.tech/macro_ai_hobby?sslmode=require
```

### Phase 2: Cache Setup (Day 1)

**1. Create Upstash Redis Database:**

```bash
# Sign up at upstash.com
# Create new Redis database: "macro-ai-cache"
# Select region closest to your users
```

**2. Update Environment Variables:**

```bash
# .env.local
UPSTASH_REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379
UPSTASH_REDIS_TOKEN=your_token_here
```

### Phase 3: Serverless API Conversion (Days 2-3)

**1. Install Serverless Framework:**

```bash
npm install -g serverless
npm install --save-dev serverless-webpack serverless-offline
```

**2. Create Serverless Configuration:**

```yaml
# serverless.yml
service: macro-ai-hobby-api

provider:
  name: aws
  runtime: nodejs20.x
  region: us-east-1
  stage: ${opt:stage, 'dev'}
  environment:
    NODE_ENV: production
    NEON_DATABASE_URL: ${env:NEON_DATABASE_URL}
    UPSTASH_REDIS_URL: ${env:UPSTASH_REDIS_URL}
    OPENAI_API_KEY: ${env:OPENAI_API_KEY}
    AWS_COGNITO_USER_POOL_ID: ${env:AWS_COGNITO_USER_POOL_ID}
    AWS_COGNITO_USER_POOL_CLIENT_ID: ${env:AWS_COGNITO_USER_POOL_CLIENT_ID}

functions:
  api:
    handler: dist/lambda.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
          cors: true
    timeout: 30
    memorySize: 512

plugins:
  - serverless-webpack
  - serverless-offline
```

**3. Create Lambda Handler:**

```typescript
// src/lambda.ts
import serverless from 'serverless-http'
import app from './app' // Your existing Express app

export const handler = serverless(app, {
	binary: false,
	request: (request, event, context) => {
		// Add Lambda context to request
		request.context = context
		request.event = event
	},
})
```

### Phase 4: Frontend Deployment (Day 3)

**1. Deploy to AWS Amplify:**

```bash
# Install Amplify CLI
npm install -g @aws-amplify/cli

# Initialize Amplify project
cd apps/client-ui
amplify init

# Add hosting
amplify add hosting
# Choose: Amazon CloudFront and S3

# Configure environment variables
amplify env add prod
# Set VITE_API_URL=https://your-api-gateway-url.amazonaws.com/dev

# Deploy
amplify publish
```

**2. Update API URLs:**

```typescript
// apps/client-ui/src/config/api.ts
const API_BASE_URL =
	import.meta.env.VITE_API_URL ||
	'https://your-api-gateway-url.amazonaws.com/dev'

export { API_BASE_URL }
```

## ⚖️ Trade-offs and Limitations

### ✅ Maintained Functionality

- **Complete React UI**: Same user experience and features
- **Full API Functionality**: All endpoints and business logic preserved
- **PostgreSQL + pgvector**: AI embeddings and vector search maintained
- **Redis Caching**: Session management and performance optimization
- **AWS Cognito**: Complete authentication and user management
- **OpenAI Integration**: Chat functionality with streaming responses
- **Type Safety**: Auto-generated API clients and validation

### ⚠️ Performance Trade-offs

**Cold Start Latency:**

- Lambda cold starts: 100-500ms additional latency
- Occurs after ~15 minutes of inactivity
- Mitigated by keeping functions warm during active use

**Database Performance:**

- Neon free tier: 1 compute unit (0.25 vCPU)
- Slower complex queries compared to dedicated RDS
- Automatic scaling helps with burst traffic

**Cache Limitations:**

- Upstash free tier: 256MB storage limit
- May need cache eviction for large datasets
- 10k requests/day limit (sufficient for hobby use)

### 📊 Scalability Constraints

**Concurrent Users:**

- Lambda: ~100 concurrent executions (free tier)
- Neon: Connection pooling handles multiple users
- Upstash: Global replication supports distributed users

**Storage Limits:**

- Neon: 512MB database storage
- Upstash: 256MB cache storage
- S3: 5GB file storage (free tier)

**Request Limits:**

- API Gateway: 1M requests/month
- Lambda: 1M invocations/month
- Upstash: 10k requests/day

## 🚀 Migration Path to Production

### Trigger Points for Upgrade

**User Growth:**

- > 50 active users per month
- > 500 requests per day consistently
- Need for real-time features

**Performance Requirements:**

- Cold start latency becomes problematic
- Database queries consistently slow
- Cache hit ratio drops below 70%

**Storage Constraints:**

- Database approaching 400MB (80% of limit)
- Cache approaching 200MB (80% of limit)
- Need for file uploads >5GB

### Migration Strategy

#### Stage 1: Paid Tiers (£30-50/month)

```text
Upgrade Triggers: >50 users, >500 requests/day

Services to Upgrade:
├── Neon Pro: £15/month (more compute, 10GB storage)
├── Upstash Pro: £8/month (unlimited requests, 1GB cache)
├── AWS Amplify Pro: £16/month (more bandwidth, team features)
└── Total: ~£39/month
```

#### Stage 2: Hybrid Architecture (£80-120/month)

```text
Upgrade Triggers: >200 users, >2000 requests/day

Architecture Changes:
├── Keep Lambda for API (cost-effective scaling)
├── Upgrade to RDS PostgreSQL (better performance)
├── Add ElastiCache Redis (dedicated caching)
├── Add CloudFront (better global performance)
└── Total: ~£100/month
```

#### Stage 3: Full Production (£300-800/month)

```text
Upgrade Triggers: >1000 users, enterprise requirements

Architecture Changes:
├── Migrate to ECS Fargate (better control, scaling)
├── Add Application Load Balancer (advanced routing)
├── Implement auto-scaling groups
├── Add comprehensive monitoring and alerting
├── Multi-AZ deployment for high availability
└── Total: £300-800/month (original production plan)
```

## 📊 Monitoring and Alerts

### Cost Monitoring

**AWS Budget Alert:**

```typescript
// Set up £5 monthly budget alert
const hobbyBudget = new budgets.CfnBudget(this, 'HobbyBudget', {
	budget: {
		budgetName: 'macro-ai-hobby',
		budgetLimit: {
			amount: 5, // £5 alert threshold
			unit: 'GBP',
		},
		timeUnit: 'MONTHLY',
		budgetType: 'COST',
	},
	notificationsWithSubscribers: [
		{
			notification: {
				notificationType: 'FORECASTED',
				comparisonOperator: 'GREATER_THAN',
				threshold: 80, // Alert at 80% of budget
			},
			subscribers: [
				{
					subscriptionType: 'EMAIL',
					address: 'your-email@example.com',
				},
			],
		},
	],
})
```

### Usage Monitoring

**Service Dashboards:**

- **Lambda**: CloudWatch metrics for invocations, duration, errors
- **Neon**: Built-in dashboard for connections, storage, compute usage
- **Upstash**: Dashboard for requests, memory usage, hit rates
- **AWS Amplify**: Console analytics for page views, bandwidth, build minutes
- **API Gateway**: Request count, latency, error rates

**Key Metrics to Monitor:**

- Daily API requests (target: <1000/day)
- Database storage usage (limit: 512MB)
- Cache memory usage (limit: 256MB)
- Lambda execution duration (optimize for cost)
- Error rates across all services

## 🔐 Security Considerations

### Free Tier Security

**AWS Cognito:**

- Multi-factor authentication available
- Password policies and account recovery
- JWT token validation
- Rate limiting on auth endpoints

**API Security:**

- HTTPS only (enforced by API Gateway)
- CORS configuration
- Request validation with Zod schemas
- Rate limiting via API Gateway

**Database Security:**

- SSL/TLS encryption in transit (Neon default)
- Connection string security
- No direct database access from frontend

**Environment Security:**

- Environment variables in AWS Amplify/Lambda
- No secrets in code repository
- Separate environments for dev/prod

### Parameter Store Security Best Practices

**Parameter Organization:**

- **Critical Secrets**: Use Advanced Parameters with customer-managed KMS keys
- **Standard Secrets**: Use Standard Parameters with AWS-managed keys
- **Hierarchical Structure**: Organize by environment and sensitivity level
- **Naming Convention**: `/macro-ai/{environment}/{tier}/{secret-name}`

**Access Control:**

- **Principle of Least Privilege**: Grant minimal required permissions
- **Resource-Based Policies**: Restrict access to specific parameter paths
- **IAM Conditions**: Use conditions for additional security constraints
- **Regular Access Reviews**: Quarterly review of parameter access permissions

**Operational Security:**

- **Manual Rotation Schedule**: Monthly for API keys, quarterly for database credentials
- **Access Logging**: Monitor parameter access through CloudTrail
- **Cache Management**: Implement secure caching with appropriate TTL
- **Error Handling**: Avoid logging sensitive parameter values

**Security Monitoring:**

```typescript
// src/utils/security-monitoring.ts
export class SecurityMonitoring {
	static logParameterAccess(parameterName: string, success: boolean): void {
		const logEntry = {
			timestamp: new Date().toISOString(),
			event: 'parameter_access',
			parameter: parameterName,
			success,
			source: 'lambda',
			environment: process.env.NODE_ENV || 'unknown',
		}

		// Log to CloudWatch (avoid logging actual values)
		console.log('Parameter access:', JSON.stringify(logEntry))
	}

	static async validateParameterIntegrity(): Promise<boolean> {
		try {
			// Validate that critical parameters exist and are accessible
			const criticalParams = ['openai-api-key', 'neon-database-url']

			for (const param of criticalParams) {
				const value = await SecureHobbySecretsManager.getSecret(param, false)
				if (!value || value === 'PLACEHOLDER_VALUE') {
					console.error(
						`Critical parameter ${param} is missing or not configured`,
					)
					return false
				}
			}

			return true
		} catch (error) {
			console.error('Parameter integrity validation failed:', error)
			return false
		}
	}
}
```

## 📋 Implementation Checklist

### Week 1: Setup and Migration

- [ ] Sign up for Neon PostgreSQL free tier
- [ ] Sign up for Upstash Redis free tier
- [ ] Sign up for AWS Amplify free tier
- [ ] Set up AWS budget alerts (£5 threshold)
- [ ] Set up AWS Systems Manager Parameter Store
- [ ] Create parameter hierarchy for secrets management
- [ ] Configure IAM policies for Lambda parameter access
- [ ] Create Neon database with pgvector extension
- [ ] Create Upstash Redis database
- [ ] Test database and cache connections
- [ ] Test Parameter Store secret retrieval

### Week 2: API Conversion

- [ ] Install Serverless Framework
- [ ] Convert Express app to Lambda handler
- [ ] Update database connections for serverless
- [ ] Implement Redis connection pooling
- [ ] Test API endpoints locally with serverless-offline
- [ ] Deploy Lambda functions to AWS
- [ ] Configure API Gateway endpoints

### Week 3: Frontend Deployment

- [ ] Update API URLs in React app
- [ ] Deploy React app to AWS Amplify
- [ ] Configure custom domain (optional)
- [ ] Test end-to-end functionality
- [ ] Set up monitoring dashboards
- [ ] Document deployment procedures

### Week 4: Optimization and Monitoring

- [ ] Monitor costs for first month
- [ ] Optimize Lambda memory allocation
- [ ] Implement cache warming strategies
- [ ] Set up error alerting
- [ ] Performance test with expected load
- [ ] Create backup and recovery procedures

## 💻 Code Examples and Configuration

### Database Connection (Serverless-Optimized)

```typescript
// src/config/database.ts
import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'

// Optimized for Lambda - no connection pooling needed
const sql = neon(process.env.NEON_DATABASE_URL!)
export const db = drizzle(sql)

// Connection test function
export async function testDatabaseConnection() {
	try {
		const result = await sql`SELECT version()`
		console.log('Database connected:', result[0].version)
		return true
	} catch (error) {
		console.error('Database connection failed:', error)
		return false
	}
}
```

### Redis Connection (Upstash)

```typescript
// src/config/redis.ts
import { Redis } from '@upstash/redis'

export const redis = new Redis({
	url: process.env.UPSTASH_REDIS_URL!,
	token: process.env.UPSTASH_REDIS_TOKEN!,
})

// Cache helper functions
export const cache = {
	async get<T>(key: string): Promise<T | null> {
		try {
			return await redis.get(key)
		} catch (error) {
			console.error('Cache get error:', error)
			return null
		}
	},

	async set(key: string, value: any, ttl: number = 3600): Promise<boolean> {
		try {
			await redis.setex(key, ttl, JSON.stringify(value))
			return true
		} catch (error) {
			console.error('Cache set error:', error)
			return false
		}
	},

	async del(key: string): Promise<boolean> {
		try {
			await redis.del(key)
			return true
		} catch (error) {
			console.error('Cache delete error:', error)
			return false
		}
	},
}
```

### Lambda Handler with Error Handling

```typescript
// src/lambda.ts
import serverless from 'serverless-http'
import {
	APIGatewayProxyEvent,
	APIGatewayProxyResult,
	Context,
} from 'aws-lambda'
import app from './app'
import { testDatabaseConnection } from './config/database'

// Wrap Express app for Lambda
const serverlessApp = serverless(app, {
	binary: false,
	request: (request: any, event: APIGatewayProxyEvent, context: Context) => {
		request.context = context
		request.event = event
	},
})

// Main Lambda handler with health checks
export const handler = async (
	event: APIGatewayProxyEvent,
	context: Context,
): Promise<APIGatewayProxyResult> => {
	// Set Lambda context timeout
	context.callbackWaitsForEmptyEventLoop = false

	try {
		// Health check for database on cold start
		if (event.path === '/health') {
			const dbHealthy = await testDatabaseConnection()
			if (!dbHealthy) {
				return {
					statusCode: 503,
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
					},
					body: JSON.stringify({
						status: 'unhealthy',
						error: 'Database connection failed',
						timestamp: new Date().toISOString(),
					}),
				}
			}
		}

		return await serverlessApp(event, context)
	} catch (error) {
		console.error('Lambda handler error:', error)
		return {
			statusCode: 500,
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*',
			},
			body: JSON.stringify({
				error: 'Internal server error',
				timestamp: new Date().toISOString(),
			}),
		}
	}
}
```

### Optimized Package.json Scripts

```json
{
	"scripts": {
		"build": "tsc && tsx src/utils/swagger/generate-swagger.ts",
		"build:lambda": "tsc && webpack --mode=production",
		"deploy": "serverless deploy",
		"deploy:dev": "serverless deploy --stage dev",
		"deploy:prod": "serverless deploy --stage prod",
		"local": "serverless offline",
		"logs": "serverless logs -f api -t",
		"remove": "serverless remove",
		"test:lambda": "npm run build:lambda && serverless invoke local -f api"
	}
}
```

### Webpack Configuration for Lambda

```javascript
// webpack.config.js
const path = require('path')
const nodeExternals = require('webpack-node-externals')

module.exports = {
	entry: './src/lambda.ts',
	target: 'node',
	mode: 'production',
	externals: [nodeExternals()],
	module: {
		rules: [
			{
				test: /\.ts$/,
				use: 'ts-loader',
				exclude: /node_modules/,
			},
		],
	},
	resolve: {
		extensions: ['.ts', '.js'],
	},
	output: {
		filename: 'lambda.js',
		path: path.resolve(__dirname, 'dist'),
		libraryTarget: 'commonjs2',
	},
	optimization: {
		minimize: true,
	},
}
```

## 🔄 CI/CD Pipeline for Hobby Projects

### GitHub Actions Workflow

```yaml
# .github/workflows/hobby-deploy.yml
name: Deploy Hobby Architecture

on:
  push:
    branches: [main]
    paths: ['apps/express-api/**', 'apps/client-ui/**']

env:
  AWS_REGION: us-east-1

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run tests
        run: pnpm test

      - name: Type check
        run: pnpm type-check

  deploy-api:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Update Parameter Store secrets
        run: |
          # Update critical parameters (Advanced tier)
          aws ssm put-parameter \
            --name "/macro-ai/prod/critical/neon-database-url" \
            --value "${{ secrets.NEON_DATABASE_URL }}" \
            --type "SecureString" \
            --tier "Advanced" \
            --overwrite

          aws ssm put-parameter \
            --name "/macro-ai/prod/critical/openai-api-key" \
            --value "${{ secrets.OPENAI_API_KEY }}" \
            --type "SecureString" \
            --tier "Advanced" \
            --overwrite

          # Update standard parameters
          aws ssm put-parameter \
            --name "/macro-ai/prod/standard/upstash-redis-url" \
            --value "${{ secrets.UPSTASH_REDIS_URL }}" \
            --type "SecureString" \
            --overwrite

          aws ssm put-parameter \
            --name "/macro-ai/prod/standard/cognito-user-pool-id" \
            --value "${{ secrets.COGNITO_USER_POOL_ID }}" \
            --type "String" \
            --overwrite

          aws ssm put-parameter \
            --name "/macro-ai/prod/standard/cognito-user-pool-client-id" \
            --value "${{ secrets.COGNITO_USER_POOL_CLIENT_ID }}" \
            --type "String" \
            --overwrite

      - name: Build API
        run: |
          cd apps/express-api
          pnpm build:lambda

      - name: Deploy Lambda
        run: |
          cd apps/express-api
          npx serverless deploy --stage prod

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build frontend
        run: |
          cd apps/client-ui
          pnpm build
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}

      - name: Deploy to AWS Amplify
        run: |
          cd apps/client-ui
          npx @aws-amplify/cli publish --yes
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

## 📈 Performance Optimization for Free Tier

### Lambda Cold Start Mitigation

```typescript
// src/utils/warmup.ts
export const warmupHandler = async (event: any) => {
  if (event.source === 'aws.events') {
    console.log('Warmup event received');
    return { statusCode: 200, body: 'Warmed up' };
  }
  return null;
};

// Add to serverless.yml
functions:
  api:
    handler: dist/lambda.handler
    events:
      - schedule: rate(5 minutes) # Keep warm during active hours
    warmup:
      enabled: true
      prewarm: true
```

### Database Query Optimization

```typescript
// src/utils/database-optimizer.ts
import { db } from '../config/database'

// Connection pooling for Neon
export class DatabaseOptimizer {
	private static queryCache = new Map<string, any>()

	static async cachedQuery<T>(
		key: string,
		query: () => Promise<T>,
		ttl: number = 300, // 5 minutes
	): Promise<T> {
		const cached = this.queryCache.get(key)
		if (cached && Date.now() - cached.timestamp < ttl * 1000) {
			return cached.data
		}

		const data = await query()
		this.queryCache.set(key, {
			data,
			timestamp: Date.now(),
		})

		return data
	}

	static clearCache(pattern?: string) {
		if (pattern) {
			for (const key of this.queryCache.keys()) {
				if (key.includes(pattern)) {
					this.queryCache.delete(key)
				}
			}
		} else {
			this.queryCache.clear()
		}
	}
}
```

### Redis Cache Strategies

```typescript
// src/utils/cache-strategies.ts
import { cache } from '../config/redis'

export class CacheStrategies {
	// Cache-aside pattern
	static async getOrSet<T>(
		key: string,
		fetcher: () => Promise<T>,
		ttl: number = 3600,
	): Promise<T> {
		const cached = await cache.get<T>(key)
		if (cached) return cached

		const data = await fetcher()
		await cache.set(key, data, ttl)
		return data
	}

	// Write-through pattern
	static async setAndCache<T>(
		key: string,
		data: T,
		persister: (data: T) => Promise<void>,
		ttl: number = 3600,
	): Promise<void> {
		await persister(data)
		await cache.set(key, data, ttl)
	}

	// Cache warming for frequently accessed data
	static async warmCache() {
		const commonQueries = ['user_preferences', 'system_config', 'popular_chats']

		for (const query of commonQueries) {
			try {
				// Implement your cache warming logic here
				console.log(`Warming cache for: ${query}`)
			} catch (error) {
				console.error(`Cache warming failed for ${query}:`, error)
			}
		}
	}
}
```

## 🚨 Troubleshooting Common Issues

### Lambda Timeout Issues

```typescript
// src/middleware/timeout-handler.ts
import { Request, Response, NextFunction } from 'express'

export const timeoutHandler = (timeoutMs: number = 25000) => {
	return (req: Request, res: Response, next: NextFunction) => {
		const timeout = setTimeout(() => {
			if (!res.headersSent) {
				res.status(408).json({
					error: 'Request timeout',
					message: 'Request took too long to process',
				})
			}
		}, timeoutMs)

		res.on('finish', () => clearTimeout(timeout))
		res.on('close', () => clearTimeout(timeout))

		next()
	}
}
```

### Database Connection Issues

```typescript
// src/utils/database-health.ts
import { db } from '../config/database'

export class DatabaseHealth {
	static async checkConnection(): Promise<boolean> {
		try {
			await db.execute('SELECT 1')
			return true
		} catch (error) {
			console.error('Database health check failed:', error)
			return false
		}
	}

	static async retryConnection(maxRetries: number = 3): Promise<boolean> {
		for (let i = 0; i < maxRetries; i++) {
			if (await this.checkConnection()) {
				return true
			}

			// Exponential backoff
			await new Promise((resolve) => setTimeout(resolve, Math.pow(2, i) * 1000))
		}

		return false
	}
}
```

### Memory Optimization

```typescript
// src/utils/memory-optimizer.ts
export class MemoryOptimizer {
	static monitorMemoryUsage() {
		const used = process.memoryUsage()
		console.log('Memory usage:', {
			rss: `${Math.round(used.rss / 1024 / 1024)} MB`,
			heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`,
			heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`,
			external: `${Math.round(used.external / 1024 / 1024)} MB`,
		})
	}

	static forceGarbageCollection() {
		if (global.gc) {
			global.gc()
			console.log('Garbage collection forced')
		}
	}

	static setupMemoryMonitoring() {
		setInterval(() => {
			this.monitorMemoryUsage()

			const usage = process.memoryUsage()
			if (usage.heapUsed > 400 * 1024 * 1024) {
				// 400MB threshold
				console.warn('High memory usage detected')
				this.forceGarbageCollection()
			}
		}, 30000) // Check every 30 seconds
	}
}
```

---

**Next Steps**: Review hobby deployment plan and begin implementation.

**Estimated Timeline**: 3-4 weeks for complete migration
**Estimated Cost**: £0.83/month (domain only) for personal use
**Risk Level**: Low (proven free-tier services with clear upgrade paths)

**Key Success Metrics**:

- Monthly Cost: <£10 (target: <£1)
- API Response Time: <500ms (including cold starts)
- Page Load Time: <2 seconds
- Uptime: >99% (free tier SLAs)
- Zero Surprise Bills: Comprehensive cost monitoring

**Migration Support**: This hobby architecture provides a clear path to scale up to the full production architecture
when your project grows beyond personal use.

## 🔄 Migration Path to Production

### When to Migrate from Parameter Store to Secrets Manager

**Trigger Points:**

- **User Growth**: >100 active users per month
- **Security Requirements**: Need for automatic secret rotation
- **Compliance Needs**: Enterprise security standards required
- **Operational Complexity**: Manual rotation becomes burdensome
- **Budget Flexibility**: Can accommodate $7/month for enhanced security

### Migration Strategy

**Phase 1: Parallel Implementation (Week 1)**

```typescript
// src/config/hybrid-secrets.ts
import { SecureHobbySecretsManager } from './secure-secrets'
import { ProductionSecretsManager } from './production-secrets'

export class HybridSecretsManager {
	private static useSecretsManager = process.env.USE_SECRETS_MANAGER === 'true'

	static async getSecret(secretName: string): Promise<string> {
		if (this.useSecretsManager) {
			// Use Secrets Manager for production
			return await ProductionSecretsManager.getSecret(
				`macro-ai/prod/${secretName}`,
			)
		} else {
			// Use Parameter Store for hobby
			return await SecureHobbySecretsManager.getSecret(secretName)
		}
	}
}
```

**Phase 2: Data Migration (Week 2)**

```bash
# Migration script: migrate-to-secrets-manager.sh
#!/bin/bash

# Get values from Parameter Store
OPENAI_KEY=$(aws ssm get-parameter --name "/macro-ai/prod/critical/openai-api-key" --with-decryption --query 'Parameter.Value' --output text)
DATABASE_URL=$(aws ssm get-parameter --name "/macro-ai/prod/critical/neon-database-url" --with-decryption --query 'Parameter.Value' --output text)
REDIS_URL=$(aws ssm get-parameter --name "/macro-ai/prod/standard/upstash-redis-url" --with-decryption --query 'Parameter.Value' --output text)

# Create secrets in Secrets Manager
aws secretsmanager create-secret \
  --name "macro-ai/prod/openai-api-key" \
  --description "OpenAI API key for macro-ai production" \
  --secret-string "$OPENAI_KEY"

aws secretsmanager create-secret \
  --name "macro-ai/prod/database" \
  --description "Database credentials for macro-ai production" \
  --secret-string "{\"url\":\"$DATABASE_URL\"}"

aws secretsmanager create-secret \
  --name "macro-ai/prod/redis-url" \
  --description "Redis connection string for macro-ai production" \
  --secret-string "$REDIS_URL"

echo "Migration to Secrets Manager completed"
```

**Phase 3: Validation and Cutover (Week 3)**

```typescript
// src/utils/migration-validator.ts
export class MigrationValidator {
	static async validateMigration(): Promise<boolean> {
		try {
			// Test Parameter Store access
			const parameterStoreValue =
				await SecureHobbySecretsManager.getSecret('openai-api-key')

			// Test Secrets Manager access
			const secretsManagerValue = await ProductionSecretsManager.getSecret(
				'macro-ai/prod/openai-api-key',
			)

			// Validate values match (for non-rotated secrets)
			if (parameterStoreValue !== secretsManagerValue) {
				console.warn(
					'Secret values differ between Parameter Store and Secrets Manager',
				)
			}

			console.log('Migration validation successful')
			return true
		} catch (error) {
			console.error('Migration validation failed:', error)
			return false
		}
	}
}
```

### Cost Impact of Migration

**Before Migration (Parameter Store):**

```text
Parameter Store:                             £0.00/month
Total Secrets Management Cost:               £0.00/month
```

**After Migration (Secrets Manager):**

```text
Secrets Manager Storage (5 secrets):         £2.00/month
Secrets Manager API Calls:                   £0.15/month
Total Secrets Management Cost:               £2.15/month
```

**Migration Timeline:**

- **Week 1**: Implement hybrid secrets manager
- **Week 2**: Migrate secrets data
- **Week 3**: Validate and enable automatic rotation
- **Week 4**: Remove Parameter Store dependencies

This migration path ensures zero downtime while upgrading to enterprise-grade secrets management capabilities.
