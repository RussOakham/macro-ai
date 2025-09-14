# 🚀 CloudFormation → Pulumi + Doppler Migration Plan

## Overview

This migration will transform your infrastructure from CloudFormation + AWS Parameter Store to Pulumi + Doppler,
significantly improving developer experience and simplifying secret management across your ephemeral preview, staging,
and production environments.

## Current State Analysis

**Current Architecture:**

- AWS CDK (CloudFormation) for infrastructure
- AWS Parameter Store for secrets management
- Complex parameter hierarchy: `/macro-ai/{environment}/critical|standard/{param}`
- Manual parameter updates via scripts
- ECS Fargate for containerized deployments
- Preview environments sharing development parameters

**Pain Points Identified:**

- Complex Parameter Store management across environments
- Manual secret injection and debugging
- CloudFormation deployment failures requiring retries
- Limited developer experience with infrastructure debugging

## Migration Strategy

### Phase 1: Setup and Preparation (1-2 days)

#### 1.1 Install Required Tools

**Manual Steps Required:**

```bash
# Install Doppler CLI
brew install doppler

# Install Pulumi CLI
brew install pulumi

# Verify installations
doppler --version
pulumi version
```

#### 1.2 Create Doppler Account and Projects

**Manual Steps Required:**

1. Go to [doppler.com](https://doppler.com) and create account
2. Create projects for each environment:

```bash
# Login to Doppler
doppler login

# Create projects
doppler projects create macro-ai-dev
doppler projects create macro-ai-staging
doppler projects create macro-ai-prod

# Create configs for each project
doppler configs create dev --project macro-ai-dev
doppler configs create staging --project macro-ai-staging
doppler configs create prod --project macro-ai-prod
```

#### 1.3 Migrate Secrets from Parameter Store

**Manual Steps Required:**

```bash
# Create migration script
cat > migrate-secrets.sh << 'EOF'
#!/bin/bash
set -e

# Function to migrate secrets from Parameter Store to Doppler
migrate_secrets() {
    local env=$1
    local doppler_project=$2
    local doppler_config=$3
    local param_prefix="/macro-ai/$env"

    echo "Migrating secrets for $env environment..."

    # Get all parameters from Parameter Store
    aws ssm get-parameters-by-path \
        --path "$param_prefix" \
        --recursive \
        --with-decryption \
        --region us-east-1 \
        --output json | \
    jq -r '.Parameters[] | "\(.Name | gsub("^'$param_prefix'/"; ""))=\(.Value)"' | \
    while IFS='=' read -r key value; do
        if [ -n "$key" ] && [ -n "$value" ]; then
            echo "Setting $key in Doppler..."
            echo "$value" | doppler secrets set "$key" --project "$doppler_project" --config "$doppler_config" --stdin
        fi
    done

    echo "✅ Migration completed for $env"
}

# Migrate each environment
migrate_secrets "development" "macro-ai-dev" "dev"
migrate_secrets "staging" "macro-ai-staging" "staging"
migrate_secrets "production" "macro-ai-prod" "prod"

echo "🎉 All secrets migrated successfully!"
EOF

chmod +x migrate-secrets.sh
./migrate-secrets.sh
```

### Phase 2: Create Pulumi Infrastructure (2-3 days)

#### 2.1 Initialize Pulumi Project

**Automated Steps:**

```bash
# Create new Pulumi infrastructure directory
mkdir -p infrastructure-pulumi
cd infrastructure-pulumi

# Initialize Pulumi with TypeScript
pulumi new typescript --yes

# Install required dependencies
pnpm add @pulumi/aws @pulumi/doppler @pulumi/pulumi
pnpm add -D @types/node typescript
```

#### 2.2 Create Pulumi Configuration

**Automated Steps:**

```typescript
// infrastructure-pulumi/Pulumi.yaml
name: macro-ai-infrastructure
runtime: nodejs
description: Macro AI Infrastructure with Pulumi and Doppler
```

```typescript
// infrastructure-pulumi/index.ts
import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import { DopplerSecret } from '@pulumi/doppler'

// Get environment from Pulumi config
const config = new pulumi.Config()
const environment = config.require('environment')

// Create Doppler secret reference
const dopplerSecrets = new DopplerSecret('macro-ai-secrets', {
	project: `macro-ai-${environment}`,
	config: environment === 'pr' ? 'dev' : environment,
})

// Export the secret reference for use in other files
export const secrets = dopplerSecrets
export const environmentName = environment
```

#### 2.3 Create Environment-Specific Stacks

**Automated Steps:**

```typescript
// infrastructure-pulumi/environments/preview.ts
import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import { createEcsCluster } from '../constructs/ecs-cluster'
import { createLoadBalancer } from '../constructs/load-balancer'
import { createVpc } from '../constructs/vpc'
import { secrets } from '../index'

const config = new pulumi.Config()
const prNumber = config.requireNumber('prNumber')
const branchName = config.require('branchName')

// Create VPC
const vpc = createVpc(`macro-ai-pr-${prNumber}`, {
	enableNatGateway: false, // Cost optimization
	maxAzs: 2,
})

// Create ECS cluster
const cluster = createEcsCluster(`macro-ai-pr-${prNumber}`, {
	vpcId: vpc.id,
})

// Create load balancer
const loadBalancer = createLoadBalancer(`macro-ai-pr-${prNumber}`, {
	vpcId: vpc.id,
	subnets: vpc.privateSubnetIds,
})

// Create ECS service with Doppler secrets
const service = new aws.ecs.Service(`macro-ai-pr-${prNumber}-service`, {
	cluster: cluster.arn,
	taskDefinition: createTaskDefinition(prNumber, secrets).arn,
	desiredCount: 1,
	// ... other configuration
})

export const apiUrl = loadBalancer.dnsName
export const serviceName = service.name
```

#### 2.4 Create Reusable Constructs

**Automated Steps:**

```typescript
// infrastructure-pulumi/constructs/ecs-task-definition.ts
import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'

interface TaskDefinitionProps {
	environmentName: string
	secrets: any // Doppler secret reference
	cpu?: number
	memory?: number
}

export function createTaskDefinition(
	name: string,
	props: TaskDefinitionProps,
): aws.ecs.TaskDefinition {
	return new aws.ecs.TaskDefinition(`${name}-task`, {
		family: name,
		cpu: props.cpu || '256',
		memory: props.memory || '512',
		networkMode: 'awsvpc',
		requiresCompatibilities: ['FARGATE'],
		executionRoleArn: createExecutionRole(name).arn,
		taskRoleArn: createTaskRole(name).arn,
		containerDefinitions: JSON.stringify([
			{
				name: 'api',
				image: 'your-ecr-repo:latest',
				portMappings: [
					{
						containerPort: 3040,
						protocol: 'tcp',
					},
				],
				environment: [
					{ name: 'NODE_ENV', value: 'production' },
					{ name: 'APP_ENV', value: props.environmentName },
				],
				secrets: [
					{
						name: 'API_KEY',
						valueFrom: props.secrets.secrets['API_KEY'],
					},
					{
						name: 'DATABASE_URL',
						valueFrom: props.secrets.secrets['RELATIONAL_DATABASE_URL'],
					},
					{
						name: 'REDIS_URL',
						valueFrom: props.secrets.secrets['REDIS_URL'],
					},
					{
						name: 'OPENAI_API_KEY',
						valueFrom: props.secrets.secrets['OPENAI_API_KEY'],
					},
				],
				logConfiguration: {
					logDriver: 'awslogs',
					options: {
						'awslogs-group': `/aws/ecs/${name}`,
						'awslogs-region': 'us-east-1',
						'awslogs-stream-prefix': 'ecs',
					},
				},
			},
		]),
	})
}
```

### Phase 3: Update Application Code (1 day)

#### 3.1 Remove Parameter Store Dependencies

**Automated Steps:**

```bash
# Remove old parameter store scripts
rm apps/express-api/scripts/generate-env-from-parameter-store.sh

# Remove parameter store related code from environment config construct
# (This will be handled in the Pulumi migration)
```

#### 3.2 Update Docker Configuration

**Automated Steps:**

```dockerfile
# apps/express-api/Dockerfile.distroless
FROM node:20-alpine AS base
WORKDIR /app

# Install Doppler CLI
RUN wget -O doppler.tar.gz https://cli.doppler.com/download?os=linux&arch=amd64&format=tar.gz && \
    tar -xzf doppler.tar.gz && \
    mv doppler /usr/local/bin/ && \
    rm doppler.tar.gz

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Use Doppler for secret injection at runtime
ENTRYPOINT ["doppler", "run", "--", "node", "dist/index.js"]
```

#### 3.3 Update GitHub Workflows

**Manual Steps Required:**

1. Update workflow files to use Pulumi instead of CDK
2. Add Doppler authentication to workflows

**Automated Steps:**

```yaml
# .github/workflows/deploy-preview-pulumi.yml
name: Deploy Preview Environment (Pulumi)

on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches: [develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: |
          cd infrastructure-pulumi
          npm install

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: us-east-1

      - name: Configure Doppler
        run: |
          echo "${{ secrets.DOPPLER_TOKEN }}" | doppler configure set token --stdin

      - name: Deploy with Pulumi
        run: |
          cd infrastructure-pulumi
          pulumi stack select pr-${{ github.event.pull_request.number }}
          pulumi config set environment pr
          pulumi config set prNumber ${{ github.event.pull_request.number }}
          pulumi config set branchName ${{ github.head_ref }}
          pulumi up --yes
```

### Phase 4: Testing and Validation (1-2 days)

#### 4.1 Create Test Environments

**Manual Steps Required:**

```bash
# Test development environment
cd infrastructure-pulumi
pulumi stack init dev
pulumi config set environment dev
pulumi up

# Test preview environment
pulumi stack init pr-123
pulumi config set environment pr
pulumi config set prNumber 123
pulumi config set branchName feature/test
pulumi up
```

#### 4.2 Validate Secret Management

**Manual Steps Required:**

```bash
# Test secret access in development
doppler run --project macro-ai-dev --config dev -- node -e "console.log(process.env.API_KEY)"

# Test secret access in preview
doppler run --project macro-ai-dev --config dev -- node -e "console.log(process.env.API_KEY)"
```

### Phase 5: Production Migration (1 day)

#### 5.1 Deploy Production Infrastructure

**Manual Steps Required:**

```bash
# Deploy production stack
cd infrastructure-pulumi
pulumi stack init prod
pulumi config set environment prod
pulumi up
```

#### 5.2 Update DNS and Monitoring

**Manual Steps Required:**

1. Update DNS records to point to new load balancer
2. Update monitoring dashboards
3. Verify all services are working

### Phase 6: Cleanup (1 day)

#### 6.1 Remove Old Infrastructure

**Manual Steps Required:**

```bash
# Destroy old CloudFormation stacks
cd infrastructure
pnpm cdk destroy --all

# Clean up Parameter Store (after verifying new system works)
aws ssm delete-parameters --names \
  "/macro-ai/development/critical/api-key" \
  "/macro-ai/development/critical/cookie-encryption-key" \
  # ... other parameters
```

## Configuration Files

### Pulumi Stack Configuration

```yaml
# infrastructure-pulumi/Pulumi.dev.yaml
config:
  macro-ai-infrastructure:environment: dev
  macro-ai-infrastructure:prNumber: 0
  macro-ai-infrastructure:branchName: develop

# infrastructure-pulumi/Pulumi.pr-123.yaml
config:
  macro-ai-infrastructure:environment: pr
  macro-ai-infrastructure:prNumber: 123
  macro-ai-infrastructure:branchName: feature/new-feature
```

### Doppler Configuration

```bash
# Doppler project structure
macro-ai-dev/
├── dev/          # Development config
├── staging/      # Staging config (shared with dev for previews)
└── prod/         # Production config

macro-ai-staging/
├── staging/      # Staging-specific config

macro-ai-prod/
├── prod/         # Production-specific config
```

## Benefits After Migration

1. **Simplified Secret Management**: One place for all secrets, easy environment branching
2. **Better Developer Experience**: TypeScript infrastructure code with full IDE support
3. **Easier Debugging**: Real programming language with proper error messages
4. **Simplified Preview Environments**: Automatic secret sharing between dev and preview
5. **Cost Optimization**: Easier to implement your cost controls
6. **No AWS Lock-in**: Can easily migrate to other clouds if needed

## Rollback Plan

If issues arise during migration:

1. **Immediate Rollback**: Keep old CloudFormation stacks running during migration
2. **DNS Rollback**: Switch DNS back to old load balancer
3. **Secret Rollback**: Parameter Store values remain as backup
4. **Full Rollback**: Destroy new Pulumi stacks and restore CloudFormation

## Timeline Summary

- **Week 1**: Phases 1-3 (Setup, Infrastructure, Application Updates)
- **Week 2**: Phases 4-6 (Testing, Production Migration, Cleanup)

**Total Estimated Time**: 5-7 days of focused work

## Next Steps

1. **Review this plan** and identify any specific concerns or modifications needed
2. **Set up Doppler account** and begin secret migration
3. **Create Pulumi proof-of-concept** for one environment
4. **Test the migration** with a preview environment
5. **Plan production migration** during a maintenance window

## Related Documentation

- [AWS Deployment](./aws-deployment.md) - Current CloudFormation setup
- [Environment Setup](./environment-setup.md) - Current Parameter Store configuration
- [CI/CD Pipeline](./ci-cd-pipeline.md) - Current deployment workflows

---

**Status**: 📋 Planning Phase  
**Last Updated**: 2024-12-19  
**Next Review**: After Phase 1 completion
