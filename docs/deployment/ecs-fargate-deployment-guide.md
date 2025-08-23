# ECS Fargate Deployment Guide

## 🎯 **Overview**

This guide covers deploying the Macro AI Express API to AWS ECS Fargate,
replacing the current EC2-based deployment with a modern containerized approach.

## 🏗️ **Architecture**

### **Current State (EC2)**

- EC2 instances with Auto Scaling Groups
- User data scripts for application deployment
- Manual dependency management
- Complex instance lifecycle management

### **Target State (ECS Fargate)**

- Containerized applications in ECS Fargate
- Automated scaling based on CPU/memory
- Integrated logging and monitoring
- Simplified deployment and rollback

## 📋 **Prerequisites**

### **Local Development**

- Docker Desktop installed and running
- AWS CLI configured with appropriate permissions
- Node.js 20+ and pnpm installed
- Turbo CLI installed globally

### **AWS Permissions**

The following IAM permissions are required:

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": [
				"ecr:CreateRepository",
				"ecr:DescribeRepositories",
				"ecr:GetAuthorizationToken",
				"ecr:BatchCheckLayerAvailability",
				"ecr:GetDownloadUrlForLayer",
				"ecr:BatchGetImage",
				"ecr:InitiateLayerUpload",
				"ecr:UploadLayerPart",
				"ecr:CompleteLayerUpload",
				"ecr:PutImage"
			],
			"Resource": "*"
		},
		{
			"Effect": "Allow",
			"Action": [
				"ecs:CreateCluster",
				"ecs:DescribeClusters",
				"ecs:CreateTaskDefinition",
				"ecs:DescribeTaskDefinition",
				"ecs:CreateService",
				"ecs:DescribeServices",
				"ecs:UpdateService"
			],
			"Resource": "*"
		}
	]
}
```

## 🚀 **Quick Start**

### **1. Build and Push to ECR**

```bash
# From the project root
cd apps/express-api/scripts

# Build and push to ECR
./build-and-push-ecr.sh latest development
```

### **2. Deploy ECS Infrastructure**

```bash
# From the infrastructure directory
cd infrastructure

# Deploy development environment
pnpm cdk deploy MacroAiDevelopmentStack

# Deploy preview environment
pnpm cdk deploy MacroAiPreviewStack --context prNumber=123 --context branchName=feature/example
```

### **3. Monitor Deployment**

```bash
# Check ECS service status
aws ecs describe-services \
  --cluster macro-ai-development-cluster \
  --services macro-ai-development-service \
  --region us-east-1

# View service logs
aws logs tail /macro-ai/development/macro-ai-development --follow
```

## 🔧 **Configuration**

### **Environment Variables**

The following environment variables are automatically injected from Parameter Store:

```bash
# Core Configuration
NODE_ENV=development|staging|production
APP_ENV=development|staging|production|pr-123

# Database Configuration
RELATIONAL_DATABASE_URL=postgresql://...
NON_RELATIONAL_DATABASE_URL=redis://...

# AWS Configuration
AWS_COGNITO_REGION=us-east-1
AWS_COGNITO_USER_POOL_ID=us-east-1_...
AWS_COGNITO_USER_POOL_CLIENT_ID=...

# API Configuration
API_KEY=...
COOKIE_ENCRYPTION_KEY=...
OPENAI_API_KEY=...

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### **Task Definition Sizing**

| Environment | CPU  | Memory | Use Case                   |
| ----------- | ---- | ------ | -------------------------- |
| Development | 256  | 512MB  | Local testing, development |
| Preview     | 256  | 512MB  | PR environments, testing   |
| Staging     | 512  | 1GB    | Pre-production validation  |
| Production  | 1024 | 2GB    | Production workloads       |

### **Auto-scaling Configuration**

```typescript
autoScaling: {
  minCapacity: 1,
  maxCapacity: 5,
  targetCpuUtilization: 70
}
```

- **CPU Scaling**: Triggers when CPU utilization exceeds 70%
- **Memory Scaling**: Triggers when memory utilization exceeds 80%
- **Cooldown**: 60 seconds between scaling actions

## 📊 **Monitoring and Observability**

### **CloudWatch Metrics**

The following metrics are automatically collected:

- **ECS Service Metrics**
  - `CPUUtilization`
  - `MemoryUtilization`
  - `RunningTaskCount`
  - `PendingTaskCount`

- **Application Metrics**
  - Custom metrics via CloudWatch SDK
  - Health check status
  - Request latency and throughput

### **Logging**

- **Container Logs**: Streamed to CloudWatch Logs
- **Log Retention**: 7 days for production, 3 days for previews
- **Log Format**: Structured JSON with correlation IDs

### **Health Checks**

```typescript
healthCheck: {
  path: '/health',
  interval: Duration.seconds(30),
  timeout: Duration.seconds(5),
  healthyThresholdCount: 2,
  unhealthyThresholdCount: 3
}
```

## 🔄 **Deployment Process**

### **Blue-Green Deployment**

ECS Fargate supports blue-green deployments with automatic rollback:

```typescript
circuitBreaker: {
	rollback: true
}
```

### **Deployment Steps**

1. **Build Image**: Docker image built with turbo prune
2. **Push to ECR**: Image pushed to environment-specific repository
3. **Update Service**: ECS service updated with new task definition
4. **Health Check**: New tasks must pass health checks
5. **Traffic Shift**: Traffic gradually shifted to new tasks
6. **Rollback**: Automatic rollback if health checks fail

### **Rollback Procedure**

```bash
# Force rollback to previous deployment
aws ecs update-service \
  --cluster macro-ai-development-cluster \
  --service macro-ai-development-service \
  --force-new-deployment \
  --region us-east-1
```

## 🧪 **Testing**

### **Local Testing**

```bash
# Build and run locally
cd apps/express-api
./scripts/setup-docker-dev.sh

# Test health endpoint
curl http://localhost:3000/health
```

### **Integration Testing**

```bash
# Run integration tests
pnpm test:integration

# Test Parameter Store integration
pnpm test:config
```

### **Load Testing**

```bash
# Run load tests against ECS service
npx artillery run load-tests/ecs-load-test.yml
```

## 🚨 **Troubleshooting**

### **Common Issues**

#### **Task Failing to Start**

```bash
# Check task definition
aws ecs describe-task-definition \
  --task-definition macro-ai-development-task

# Check service events
aws ecs describe-services \
  --cluster macro-ai-development-cluster \
  --services macro-ai-development-service
```

#### **Container Health Check Failures**

```bash
# Check container logs
aws logs tail /macro-ai/development/macro-ai-development --follow

# Verify health endpoint
curl -f http://your-ecs-service-url/health
```

#### **Parameter Store Access Issues**

```bash
# Test Parameter Store access
aws ssm get-parameter \
  --name "/development/API_KEY" \
  --region us-east-1
```

### **Debug Commands**

```bash
# Execute command in running container
aws ecs execute-command \
  --cluster macro-ai-development-cluster \
  --task <task-id> \
  --container express-api \
  --interactive \
  --command "/bin/bash"

# Check ECS service status
aws ecs describe-services \
  --cluster macro-ai-development-cluster \
  --services macro-ai-development-service
```

## 💰 **Cost Optimization**

### **Resource Sizing**

- **Development/Preview**: Use minimum viable resources (256 CPU, 512MB RAM)
- **Staging**: Moderate resources for validation (512 CPU, 1GB RAM)
- **Production**: Right-sized based on actual usage patterns

### **Auto-scaling**

- Set appropriate min/max capacity limits
- Use target tracking policies for predictable scaling
- Monitor and adjust scaling thresholds

### **Log Retention**

- Development: 3 days
- Staging: 7 days
- Production: 30 days

## 🔐 **Security**

### **IAM Roles**

- **Task Role**: Minimal permissions for application runtime
- **Execution Role**: Permissions for ECR and Parameter Store access
- **Service Role**: Permissions for ECS service management

### **Network Security**

- Security groups restrict access to necessary ports only
- VPC isolation for different environments
- Private subnets for production workloads

### **Container Security**

- Non-root user execution
- Image vulnerability scanning with Trivy
- Regular base image updates

## 📚 **Additional Resources**

- [ECS Fargate Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/userguide/best-practices.html)
- [ECS Task Definition Parameters](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html)
- [ECS Service Auto Scaling](https://docs.aws.amazon.com/AmazonECS/latest/userguide/service-auto-scaling.html)
- [CloudWatch Container Insights](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/ContainerInsights.html)

## 🆘 **Support**

For issues or questions:

1. Check the troubleshooting section above
2. Review CloudWatch logs and metrics
3. Check ECS service events
4. Consult AWS ECS documentation
5. Create an issue in the project repository
