# Infrastructure Documentation

## 🎯 **Overview**

This directory contains comprehensive documentation for the Macro AI infrastructure, which has been
**fully migrated to ECS Fargate** deployment strategy.

All documentation reflects the current containerized architecture and eliminates outdated EC2 references.

## 🏗️ **Current Architecture: ECS Fargate**

The infrastructure uses **AWS ECS Fargate** for compute, providing:

- **Containerized applications** with automatic scaling
- **Integrated load balancing** with Application Load Balancer
- **Managed compute** with no server management overhead
- **Cost optimization** through pay-per-use pricing

## 📚 **Documentation Categories**

### **🚀 Deployment & Operations**

#### **ECS Fargate Deployment**

- **`ecs-fargate-deployment-guide.md`** - Comprehensive ECS deployment guide
- **`deployment-artifact-versioning.md`** - ECR image versioning and race condition prevention
- \*\*`ci-deployment-troubleshooting.md` - ECS deployment troubleshooting and best practices

#### **Infrastructure Management**

- **`parameter-store-management.md`** - AWS Parameter Store configuration and management
- **`auto-shutdown-preview-environments.md`** - Cost optimization through automatic shutdown
- **`deployment-artifact-versioning.md`** - Container image versioning strategy

### **🔐 Security & Permissions**

#### **IAM & Access Control**

- **`github-actions-iam-permissions.md`** - GitHub Actions OIDC role permissions
- **`route53-iam-permissions.md`** - Route53 DNS management permissions
- **`iam-policy-updates-required.md`** - Required IAM policy updates

### **🏷️ Operations & Management**

#### **Tagging & Organization**

- **`tagging-strategy.md`** - AWS resource tagging strategy and standards
- **`infrastructure-lambda-functions.md`** - Lambda functions for infrastructure automation

### **📊 Monitoring & Troubleshooting**

#### **Deployment & CI/CD**

- **`ci-deployment-troubleshooting.md`** - Common deployment issues and solutions
- **`ci-deployment-troubleshooting.md`** - CI/CD pipeline troubleshooting

## 🔄 **Migration Status**

### **✅ Completed Migrations**

- **EC2 → ECS Fargate**: All compute resources migrated
- **S3 Artifacts → ECR Images**: Deployment artifacts containerized
- **User Data Scripts → Container Definitions**: Application deployment simplified
- **Auto Scaling Groups → ECS Service Scaling**: Automatic scaling implemented

### **📋 Legacy Documentation Removed**

- ~~`ec2-deployment.md`~~ - **REMOVED** (outdated EC2 deployment guide)
- ~~`ec2-deployment-utilities.md`~~ - **REMOVED** (outdated EC2 utilities)
- ~~`ec2-construct-bloat-analysis.md`~~ - **REMOVED** (outdated EC2 analysis)

## 🚀 **Quick Start Guides**

### **1. Deploy Preview Environment**

```bash
# From infrastructure directory
cd infrastructure

# Deploy preview environment for PR 123
pnpm cdk deploy MacroAiPreviewStack \
  --context prNumber=123 \
  --context branchName=feature/example
```

### **2. Monitor ECS Service**

```bash
# Check service status
aws ecs describe-services \
  --cluster macro-ai-preview-cluster \
  --services macro-ai-preview-service

# View logs
aws logs tail /ecs/macro-ai-preview --follow
```

### **3. Scale Service**

```bash
# Scale to 3 tasks
aws ecs update-service \
  --cluster macro-ai-preview-cluster \
  --service macro-ai-preview-service \
  --desired-count 3
```

## 🔍 **Common Operations**

### **ECS Service Management**

- **Service Updates**: Rolling deployments with zero downtime
- **Scaling**: Automatic scaling based on CPU/memory utilization
- **Health Checks**: Integrated load balancer health checks
- **Logging**: CloudWatch integration for centralized logging

### **Infrastructure Updates**

- **CDK Deployments**: Infrastructure as Code updates
- **Parameter Store**: Environment configuration management
- **Security Groups**: Network security configuration
- **Load Balancer**: Traffic routing and SSL termination

## 🛠️ **Development Workflow**

### **1. Local Development**

```bash
# Build and test locally
cd apps/express-api
pnpm build
pnpm start

# Docker build
docker build -t macro-ai-api:local .
```

### **2. Preview Deployment**

```bash
# Build and push to ECR
cd apps/express-api/scripts
./build-and-push-ecr.sh latest development

# Deploy infrastructure
cd infrastructure
pnpm cdk deploy MacroAiPreviewStack --context prNumber=123
```

### **3. Production Deployment**

```bash
# Deploy to production
cd infrastructure
pnpm cdk deploy MacroAiProductionStack
```

## 📊 **Monitoring & Observability**

### **CloudWatch Metrics**

- **ECS Service Metrics**: CPU, memory, network utilization
- **Application Metrics**: Response times, error rates, throughput
- **Infrastructure Metrics**: Load balancer health, database performance

### **Logging Strategy**

- **ECS Task Logs**: Application logs in CloudWatch
- **Infrastructure Logs**: CDK deployment and operation logs
- **Access Logs**: Load balancer and API Gateway logs

### **Alerting**

- **Service Health**: ECS service health check failures
- **Performance**: High CPU/memory utilization
- **Errors**: Application error rate thresholds
- **Cost**: Unusual cost patterns

## 🔐 **Security Best Practices**

### **Network Security**

- **VPC Configuration**: Private subnets for ECS tasks
- **Security Groups**: Minimal required access
- **Network ACLs**: Additional network layer security

### **Access Control**

- **IAM Roles**: Principle of least privilege
- **Parameter Store**: Secure configuration management
- **Secrets Manager**: Sensitive data encryption

### **Container Security**

- **Image Scanning**: Vulnerability detection
- **Non-root Users**: Container security hardening
- **Resource Limits**: CPU and memory constraints

## 📈 **Performance Optimization**

### **ECS Task Configuration**

- **Resource Allocation**: Optimal CPU/memory allocation
- **Task Placement**: Efficient task distribution
- **Auto Scaling**: Responsive scaling policies

### **Load Balancer Optimization**

- **Health Check Configuration**: Appropriate intervals and timeouts
- **Target Group Settings**: Optimal routing configuration
- **SSL/TLS**: Certificate management and renewal

## 🚨 **Troubleshooting**

### **Common Issues**

- **Service Scaling Failures**: Check resource allocation and IAM permissions
- **Health Check Failures**: Verify health check endpoints and grace periods
- **Deployment Timeouts**: Check ECR image availability and permissions
- **Logging Issues**: Verify CloudWatch permissions and configuration

### **Debugging Commands**

```bash
# Check ECS service status
aws ecs describe-services --cluster <cluster> --services <service>

# View task logs
aws logs tail /ecs/<service-name> --follow

# Check load balancer health
aws elbv2 describe-target-health --target-group-arn <arn>

# Verify Parameter Store values
aws ssm get-parameter --name <parameter-name> --with-decryption
```

## 🔮 **Future Enhancements**

### **Planned Improvements**

- **Service Mesh**: Enhanced service-to-service communication
- **Advanced Monitoring**: Custom metrics and dashboards
- **Security Scanning**: Automated vulnerability assessment
- **Cost Optimization**: Spot instance integration

### **Architecture Evolution**

- **Multi-region**: Disaster recovery and global distribution
- **Microservices**: Service decomposition and optimization
- **Event-driven**: Asynchronous processing patterns

## 📞 **Support & Resources**

### **Documentation**

- **AWS ECS Documentation**: [ECS Fargate Guide](https://docs.aws.amazon.com/ecs/latest/userguide/ecs-fargate.html)
- **CDK Documentation**: [AWS CDK Guide](https://docs.aws.amazon.com/cdk/latest/guide/)
- **Parameter Store**: [Systems Manager Guide](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html)

### **Team Resources**

- **Infrastructure Team**: Contact for complex issues
- **DevOps Engineers**: Deployment and CI/CD support
- **Security Team**: Security configuration and compliance

---

**Last Updated**: 2025-01-XX
**Architecture**: ECS Fargate (Containerized)
**Status**: ✅ **PRODUCTION READY**
