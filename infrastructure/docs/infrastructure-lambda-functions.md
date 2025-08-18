# Infrastructure Lambda Functions Documentation

> **Important**: This document explains Lambda functions used for **infrastructure automation**,
> not application hosting. The application hosting Lambda has been removed and replaced with EC2 deployment.

## Overview

After migrating from Lambda-based application hosting to EC2 deployment, several Lambda functions remain
in the infrastructure for automation, monitoring, and operational tasks. These functions are essential
for managing the EC2-based deployment infrastructure.

## Infrastructure Lambda Functions

### 1. Deployment Status Management

**Location**: `infrastructure/src/constructs/deployment-status-construct.ts`

#### Deployment Event Processor

- **Function Name**: `{environment}-deployment-event-processor`
- **Purpose**: Processes deployment events and updates deployment history
- **Runtime**: Node.js 20.x
- **Timeout**: 5 minutes
- **Triggers**: CloudWatch Events, Step Functions
- **Resources**:
  - DynamoDB table for deployment history
  - CloudWatch Log Groups for deployment logs
  - SNS topics for notifications

#### Deployment Status Query

- **Function Name**: `{environment}-deployment-status-query`
- **Purpose**: Provides deployment status information via API calls
- **Runtime**: Node.js 20.x
- **Timeout**: 2 minutes
- **Usage**: CLI tools, monitoring dashboards, GitHub Actions

### 2. Advanced Health Check System

**Location**: `infrastructure/src/constructs/advanced-health-check-construct.ts`

#### Health Check Orchestrator

- **Function Name**: `{environment}-health-check-orchestrator`
- **Purpose**: Coordinates comprehensive health checks across EC2 instances and dependencies
- **Runtime**: Node.js 20.x
- **Timeout**: 5 minutes
- **Responsibilities**:
  - Invokes application health validators
  - Invokes dependency health validators
  - Aggregates health status from multiple sources
  - Updates CloudWatch metrics

#### Application Health Validator

- **Function Name**: `{environment}-application-health-validator`
- **Purpose**: Validates EC2 application health (API endpoints, service status)
- **Runtime**: Node.js 20.x
- **Timeout**: 3 minutes

#### Dependency Health Validator

- **Function Name**: `{environment}-dependency-health-validator`
- **Purpose**: Validates external dependencies (databases, APIs, Parameter Store)
- **Runtime**: Node.js 20.x
- **Timeout**: 2 minutes

### 3. Deployment Pipeline Automation

**Location**: `infrastructure/src/constructs/deployment-pipeline-construct.ts`

#### Deployment Health Check Function

- **Function Name**: `{environment}-deployment-health-check`
- **Purpose**: Validates deployment health during blue-green deployments to EC2 instances
- **Runtime**: Node.js 20.x
- **Timeout**: 5 minutes
- **Integration**: Step Functions state machine for deployment orchestration
- **Key Responsibilities**:
  - Validates new EC2 instance health before traffic switching
  - Performs comprehensive health checks on deployed applications
  - Integrates with ALB health checks for traffic management
  - Provides rollback triggers if health validation fails
  - Supports blue-green deployment strategy for zero-downtime deployments

### 4. Security Monitoring

**Location**: `infrastructure/src/constructs/advanced-security-monitoring-construct.ts`

#### Security Event Processor

- **Function Name**: `{environment}-security-event-processor`
- **Purpose**: Processes security events and alerts
- **Runtime**: Node.js 20.x
- **Timeout**: 5 minutes

#### Security Analyzer

- **Function Name**: `{environment}-security-analyzer`
- **Purpose**: Analyzes security patterns and generates insights
- **Runtime**: Node.js 20.x
- **Timeout**: 10 minutes

#### Compliance Checker

- **Function Name**: `{environment}-compliance-checker`
- **Purpose**: Validates compliance with security policies
- **Runtime**: Node.js 20.x
- **Timeout**: 15 minutes

### 5. Performance Optimization and Cost Management

**Location**: `infrastructure/src/constructs/performance-optimization-construct.ts`

#### Performance Analyzer

- **Function Name**: `{environment}-performance-analyzer`
- **Purpose**: Analyzes EC2 instance performance metrics and identifies optimization opportunities
- **Runtime**: Node.js 20.x
- **Timeout**: 10 minutes
- **Schedule**: Every 4 hours
- **Key Responsibilities**:
  - Monitors EC2 instance CPU, memory, and network utilization
  - Analyzes Auto Scaling Group performance patterns
  - Identifies underutilized or overutilized instances
  - Stores performance data in DynamoDB for trend analysis
  - Generates CloudWatch custom metrics for dashboards

#### Optimization Engine

- **Function Name**: `{environment}-optimization-engine`
- **Purpose**: Automatically optimizes EC2 Auto Scaling Group configurations based on performance data
- **Runtime**: Node.js 20.x
- **Timeout**: 15 minutes
- **Schedule**: Every 6 hours
- **Key Responsibilities**:
  - Analyzes performance trends from DynamoDB
  - Adjusts Auto Scaling Group min/max/desired capacity
  - Optimizes scaling policies based on usage patterns
  - Implements cost-saving recommendations
  - Updates CloudWatch alarms and thresholds

#### Cost Optimizer

- **Function Name**: `{environment}-cost-optimizer`
- **Purpose**: Analyzes and implements cost optimization strategies for EC2 infrastructure
- **Runtime**: Node.js 20.x
- **Timeout**: 10 minutes
- **Schedule**: Every 12 hours
- **Key Responsibilities**:
  - Analyzes EC2 instance costs and usage patterns
  - Recommends instance type optimizations
  - Identifies opportunities for Reserved Instance purchases
  - Monitors and optimizes EBS volume usage
  - Generates cost optimization reports

## Key Differences from Application Lambda

| Aspect           | Application Lambda (Removed) | Infrastructure Lambda (Retained)   |
| ---------------- | ---------------------------- | ---------------------------------- |
| **Purpose**      | Host Express API application | Automate infrastructure operations |
| **Lifecycle**    | Handle HTTP requests         | Event-driven automation            |
| **Dependencies** | Express.js, business logic   | AWS SDK, monitoring tools          |
| **Scaling**      | Based on API traffic         | Based on operational events        |
| **Maintenance**  | Application code updates     | Infrastructure automation updates  |

## Maintenance Guidelines

### Regular Maintenance

1. **Monitor function performance** via CloudWatch metrics
2. **Update Node.js runtime** when new versions are available
3. **Review and optimize timeout settings** based on actual usage
4. **Update IAM permissions** as infrastructure evolves

### Security Considerations

1. **Least privilege IAM roles** for each function
2. **VPC configuration** where network isolation is required
3. **Environment variable encryption** for sensitive data
4. **Regular security audits** of function code and permissions

### Cost Optimization

1. **Right-size memory allocation** based on actual usage
2. **Optimize timeout settings** to prevent unnecessary charges
3. **Use ARM64 architecture** where possible for cost savings
4. **Monitor invocation patterns** and optimize triggers

## Integration with EC2 Deployment

These Lambda functions work together to support the EC2-based application deployment:

1. **Deployment Pipeline**: Orchestrates blue-green deployments to EC2 instances
2. **Health Monitoring**: Continuously monitors EC2 application health
3. **Status Tracking**: Provides deployment status for CI/CD pipelines
4. **Security Monitoring**: Monitors EC2 instances and application security

## CLI Tools Integration

Several CLI tools interact with these Lambda functions:

- **`deployment-status-cli.ts`**: Queries deployment status Lambda functions
- **`performance-optimization-cli.ts`**: Invokes performance monitoring functions
- **`security-monitoring-cli.ts`**: Interacts with security monitoring functions

## Future Considerations

1. **Containerization**: Consider migrating some functions to ECS/Fargate for better resource utilization
2. **Step Functions**: Expand use of Step Functions for complex orchestration workflows
3. **EventBridge**: Migrate from CloudWatch Events to EventBridge for better event routing
4. **Observability**: Enhance monitoring and tracing across all infrastructure functions

## Summary of Infrastructure Lambda Functions

| Function Category       | Function Name                | Purpose                          | Schedule       | Timeout |
| ----------------------- | ---------------------------- | -------------------------------- | -------------- | ------- |
| **Deployment Status**   | deployment-event-processor   | Process deployment events        | Event-driven   | 5 min   |
| **Deployment Status**   | deployment-status-query      | Query deployment status          | On-demand      | 2 min   |
| **Health Monitoring**   | health-check-orchestrator    | Coordinate health checks         | Event-driven   | 5 min   |
| **Health Monitoring**   | application-health-validator | Validate EC2 app health          | Event-driven   | 3 min   |
| **Health Monitoring**   | dependency-health-validator  | Validate dependencies            | Event-driven   | 2 min   |
| **Deployment Pipeline** | deployment-health-check      | Blue-green deployment validation | Event-driven   | 5 min   |
| **Security**            | security-event-processor     | Process security events          | Event-driven   | 5 min   |
| **Security**            | security-analyzer            | Analyze security patterns        | Event-driven   | 10 min  |
| **Security**            | compliance-checker           | Validate compliance              | Event-driven   | 15 min  |
| **Performance**         | performance-analyzer         | Analyze EC2 performance          | Every 4 hours  | 10 min  |
| **Performance**         | optimization-engine          | Optimize Auto Scaling            | Every 6 hours  | 15 min  |
| **Performance**         | cost-optimizer               | Optimize costs                   | Every 12 hours | 10 min  |

## Migration Impact Assessment

### ✅ **Retained Functions** (Infrastructure Automation)

- **12 Lambda functions** remain for infrastructure automation
- **All functions** are EC2-focused and support the new deployment architecture
- **No application hosting** Lambda functions remain
- **Clear separation** between infrastructure automation and application hosting

### ❌ **Removed Functions** (Application Hosting)

- **Express API hosting Lambda** - Replaced with EC2 instances
- **API Gateway Lambda proxy** - Replaced with Application Load Balancer
- **Serverless HTTP wrapper** - No longer needed with native Express server

### 🔄 **Updated Functions** (Modified for EC2)

- **Health check functions** now validate EC2 instances instead of Lambda functions
- **Performance optimization** now targets Auto Scaling Groups and EC2 instances
- **Deployment pipeline** now orchestrates blue-green deployments to EC2
- **Security monitoring** now monitors EC2 instances and ALB traffic

---

**Last Updated**: 2025-08-18
**Migration Status**: Post-Lambda-to-EC2 migration documentation
**Review Schedule**: Quarterly review recommended
