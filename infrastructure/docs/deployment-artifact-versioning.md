# Deployment Artifact Versioning & Race Condition Fix

## Overview

This document describes the comprehensive solution implemented to fix deployment artifact race conditions and ensure consistent
ECS Fargate deployments across all tasks in a preview environment.

## Problem Statement

### Original Issue: Deployment Artifact Race Condition

During PR preview deployments, we discovered a critical race condition where ECS tasks could pull different versions
of the deployment artifact, leading to inconsistent application deployments:

**Symptoms:**

- Different ECS tasks running different versions of the application code
- Some tasks using old artifacts with workspace dependencies (causing npm errors)
- Other tasks using new artifacts with resolved catalog dependencies (working correctly)

**Root Cause:**

1. **ECR Image Reuse**: All deployments for the same PR used the same ECR image tag (`pr-{number}:latest`)
2. **Race Condition**: ECS tasks could pull images before the new ECR push completed
3. **No Dependency Verification**: CDK deployment started immediately after ECR push without verifying completion

## Solution: Versioned Artifact System

### 1. Artifact Versioning Strategy

**New ECR Image Tag Pattern:**

```bash
{environment}/{commit-sha}-{timestamp}
```

**Example:**

```bash
pr-51/622d2103-20250820-124500
```

**Benefits:**

- **Unique per deployment**: Each GitHub Actions run creates a unique image tag
- **Immutable**: Once pushed, images are never overwritten
- **Traceable**: Commit SHA and timestamp provide clear lineage
- **Rollback-friendly**: Previous versions remain available

### 2. Enhanced Build and Push Process

**GitHub Actions Workflow Changes:**

```yaml
# Generate versioned image tag
COMMIT_SHORT="${{ github.sha }}"
COMMIT_SHORT="${COMMIT_SHORT:0:8}"
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
IMAGE_TAG="${{ env-name }}/${COMMIT_SHORT}-${TIMESTAMP}"

# Build and push with enhanced metadata
docker build \
  --build-arg BUILD_TIME=${TIMESTAMP} \
  --build-arg COMMIT_SHA=${{ github.sha }} \
  --build-arg BRANCH=${{ github.ref_name }} \
  --build-arg WORKFLOW_RUN_ID=${{ github.run_id }} \
  --build-arg PR_NUMBER=${{ github.event.pull_request.number }} \
  -t ${ECR_REPOSITORY}:${IMAGE_TAG} \
  -t ${ECR_REPOSITORY}:${{ env-name }}-latest \
  .

# Push to ECR with versioned tag
docker push ${ECR_REPOSITORY}:${IMAGE_TAG}
docker push ${ECR_REPOSITORY}:${{ env-name }}-latest

# Verify push completion
aws ecr describe-images \
  --repository-name macro-ai-express-api \
  --image-ids imageTag=${IMAGE_TAG}
```

### 3. Deployment Verification

**Pre-CDK Deployment Checks:**

```bash
# Verify image exists before starting infrastructure deployment
if aws ecr describe-images \
  --repository-name macro-ai-express-api \
  --image-ids imageTag=${IMAGE_TAG} >/dev/null 2>&1; then
  IMAGE_DIGEST=$(aws ecr describe-images \
    --repository-name macro-ai-express-api \
    --image-ids imageTag=${IMAGE_TAG} \
    --query 'imageDetails[0].imageDigest' \
    --output text)
  echo "✅ Image verified - Tag: ${IMAGE_TAG}, Digest: ${IMAGE_DIGEST}"
else
  echo "❌ Image verification failed - cannot proceed with deployment"
  exit 1
fi
```

### 4. ECS Task Configuration

**Enhanced Task Definition:**

```typescript
// Use environment variables from GitHub Actions for versioned images
const imageTag = process.env.IMAGE_TAG || `${environmentName}-latest`
const imageUri = `${ecrRepository.repositoryUri}:${imageTag}`

const taskDef = new ecs.FargateTaskDefinition(this, 'ApiTaskDef', {
	// ... other configuration
	containerDefinitions: [
		new ecs.ContainerDefinition(this, 'ApiContainer', {
			// ... other configuration
			image: ecs.ContainerImage.fromRegistry(imageUri),
			environment: [
				{
					name: 'IMAGE_TAG',
					value: imageTag,
				},
				{
					name: 'COMMIT_SHA',
					value: process.env.COMMIT_SHA || 'unknown',
				},
				{
					name: 'BUILD_TIME',
					value: process.env.BUILD_TIME || 'unknown',
				},
			],
		}),
	],
})
```

### 5. Docker Build Optimization

**Multi-stage Dockerfile with Build Arguments:**

```dockerfile
# Build stage
FROM node:20-alpine AS builder
ARG BUILD_TIME
ARG COMMIT_SHA
ARG BRANCH
ARG WORKFLOW_RUN_ID
ARG PR_NUMBER

# Set build-time environment variables
ENV BUILD_TIME=${BUILD_TIME}
ENV COMMIT_SHA=${COMMIT_SHA}
ENV BRANCH=${BRANCH}
ENV WORKFLOW_RUN_ID=${WORKFLOW_RUN_ID}
ENV PR_NUMBER=${PR_NUMBER}

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### 6. ECS Service Update Strategy

**Rolling Update Configuration:**

```typescript
const service = new ecs.FargateService(this, 'ApiService', {
	// ... other configuration
	deploymentController: ecs.DeploymentController.ECS,
	deploymentCircuitBreaker: {
		rollback: true,
	},
	enableExecuteCommand: true,
	enableServiceConnect: true,
	serviceConnectConfiguration: {
		services: [
			{
				portMappingName: 'api',
				discoveryName: 'api',
				clientAlias: {
					port: 3000,
					dnsName: 'api',
				},
			},
		],
	},
})
```

## Implementation Benefits

### 1. **Eliminated Race Conditions**

- Each deployment uses unique image tags
- No more conflicts between concurrent deployments
- Predictable deployment behavior

### 2. **Improved Traceability**

- Clear lineage from commit to deployment
- Build metadata embedded in images
- Easy rollback to previous versions

### 3. **Enhanced Reliability**

- Pre-deployment image verification
- Immutable image tags prevent overwrites
- Consistent application state across tasks

### 4. **Better Debugging**

- Image metadata available at runtime
- Clear correlation between code and deployment
- Simplified troubleshooting

## Monitoring and Validation

### 1. **Deployment Verification**

- Image existence verification before CDK deployment
- ECS service health monitoring
- Load balancer target health validation

### 2. **Runtime Validation**

- Environment variables contain build metadata
- Application can report its version information
- Health checks validate application state

### 3. **Rollback Procedures**

- Previous image tags remain available
- Quick rollback to known-good versions
- Minimal downtime during issues

## Best Practices

### 1. **Image Tagging Strategy**

- Use semantic versioning for production
- Include commit SHA for traceability
- Add timestamps for chronological ordering

### 2. **Build Optimization**

- Multi-stage Docker builds
- Layer caching for faster builds
- Minimal production images

### 3. **Deployment Strategy**

- Rolling updates for zero downtime
- Health check validation
- Automatic rollback on failures

### 4. **Monitoring and Alerting**

- ECS service metrics monitoring
- Application health monitoring
- Deployment success/failure alerts

## Future Enhancements

### 1. **Image Scanning**

- Security vulnerability scanning
- Dependency analysis
- Compliance checking

### 2. **Advanced Rollback**

- Automated rollback triggers
- Canary deployments
- Blue-green deployments

### 3. **Performance Optimization**

- Image layer optimization
- Build cache optimization
- Parallel build processes

---

**Status**: ✅ **IMPLEMENTED** - ECS Fargate deployment with versioned artifacts
**Next**: Phase 3B - API Client Documentation Consolidation
