# EC2 Construct Bloat Analysis

## Overview

Current file: `infrastructure/src/constructs/ec2-construct.ts` (1012 lines)
Target: ~400 lines (60% reduction)

## Detailed Bloat Analysis

### 1. Fallback Application Serving Logic (Lines 574-638) - **64 lines to REMOVE**

**Location**: `addApplicationDeployment()` method
**Issue**: Creates a minimal Express health check server when S3 deployment fails
**Bloat Type**: Unnecessary fallback logic that violates fail-fast principle

```typescript
// Lines 574-638: Complex fallback server creation
'else',
'    echo "$(date): ⚠️ Failed to download deployment artifact, creating minimal health check server..."',
'    echo "$(date): This means either:"',
'    echo "  1. S3 connectivity issues"',
'    echo "  2. Deployment artifact not yet uploaded"',
'    echo "  3. S3 permissions issues"',
'    echo "  4. Build job may have failed"',
'    mkdir -p dist',
// ... 60+ lines of fallback server code
```

**Replacement**: Simple fail-fast approach - exit with error if S3 download fails

### 2. Spot Instance Configuration (Lines 317-324, 352-356) - **14 lines to REMOVE**

**Location**: `createLaunchTemplate()` and `isPreviewEnvironment()` methods
**Issue**: Adds complexity for marginal cost savings
**Bloat Type**: Premature optimization

```typescript
// Lines 317-324: Spot instance configuration
const spotOptions = this.isPreviewEnvironment(environmentName)
    ? {
            requestType: ec2.SpotRequestType.ONE_TIME,
            maxPrice: 0.005, // Maximum price for t3.nano spot instances ($0.005/hour)
        }
    : undefined

// Lines 352-356: Helper method
private isPreviewEnvironment(environmentName: string): boolean {
    return (
        environmentName.startsWith('pr-') || environmentName.includes('preview')
    )
}
```

**Replacement**: Use standard on-demand instances for reliability

### 3. Extensive CloudWatch Monitoring Setup (Lines 756-855) - **99 lines to SIMPLIFY**

**Location**: `addMonitoringSetup()` method
**Issue**: Overly complex monitoring configuration for preview environments
**Bloat Type**: Over-engineering

```typescript
// Lines 756-855: Complex CloudWatch agent configuration
private addMonitoringSetup(userData: ec2.UserData): void {
    userData.addCommands(
        // 99 lines of detailed monitoring configuration
        // Multiple log streams, detailed metrics, log rotation
    )
}
```

**Replacement**: Basic CloudWatch integration (~20 lines)

### 4. PM2 Configuration (Lines 712-737) - **25 lines to REMOVE**

**Location**: `addServiceConfiguration()` method
**Issue**: Dual process management (systemd + PM2) adds complexity
**Bloat Type**: Redundant process management

```typescript
// Lines 712-737: PM2 ecosystem configuration
'# Create PM2 ecosystem file for advanced process management',
'cat > /opt/macro-ai/ecosystem.config.js << EOF',
'module.exports = {',
'  apps: [{',
'    name: "macro-ai-api",',
'    script: "dist/index.js",',
// ... 25+ lines of PM2 configuration
```

**Replacement**: Use systemd only for process management

### 5. Phase 4 Monitoring Integration (Lines 965-1011) - **47 lines to REMOVE**

**Location**: `enableComprehensiveMonitoring()` method
**Issue**: Complex monitoring integration not needed for preview environments
**Bloat Type**: Unused feature complexity

```typescript
// Lines 965-1011: Phase 4 monitoring integration
public enableComprehensiveMonitoring(props: {
    criticalAlertEmails?: string[]
    warningAlertEmails?: string[]
    enableCostMonitoring?: boolean
    customMetricNamespace?: string
}): void {
    // 47 lines of monitoring tag configuration
}
```

**Replacement**: Remove entirely - not used in preview deployments

### 6. Complex User Data Helper Methods - **200+ lines to SIMPLIFY**

**Current Structure**:

- `addUserSetup()` - 44 lines (lines 458-502)
- `addApplicationDeployment()` - 141 lines (lines 507-648)
- `addServiceConfiguration()` - 94 lines (lines 653-751)
- `addMonitoringSetup()` - 99 lines (lines 756-855)

**Total**: ~378 lines of user data script generation
**Target**: ~100 lines total with simplified approach

### 7. Verbose Error Handling and Logging (Lines 383-408) - **25 lines to SIMPLIFY**

**Location**: `createUserData()` method
**Issue**: Overly complex error handling functions
**Bloat Type**: Over-engineering

```typescript
// Lines 383-408: Complex error handling functions
'# Error handling function',
'error_exit() {',
'  echo "$(date): ERROR: $1" >&2',
'  # Only send CloudFormation signal if running in CloudFormation context',
'  if [[ -n "${AWS::StackName:-}" && -n "${AWS::LogicalResourceId:-}" && -n "${AWS::Region:-}" ]]; then',
// ... complex CloudFormation signaling logic
```

**Replacement**: Basic error handling (~5 lines)

## Summary of Removals/Simplifications

| Component                    | Current Lines | Target Lines | Reduction |
| ---------------------------- | ------------- | ------------ | --------- |
| Fallback application serving | 64            | 0            | -64       |
| Spot instance configuration  | 14            | 0            | -14       |
| CloudWatch monitoring setup  | 99            | 20           | -79       |
| PM2 configuration            | 25            | 0            | -25       |
| Phase 4 monitoring           | 47            | 0            | -47       |
| User data helper methods     | 378           | 100          | -278      |
| Error handling/logging       | 25            | 5            | -20       |
| **TOTAL**                    | **652**       | **125**      | **-527**  |

## Simplified Target Architecture

### New User Data Script Structure (~100 lines total)

```bash
#!/bin/bash
set -e

# Install Node.js 20 LTS
dnf update -y
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs

# Download and extract S3 artifact
aws s3 cp s3://${DEPLOYMENT_BUCKET}/${DEPLOYMENT_KEY} /tmp/app.tar.gz || exit 1
mkdir -p /opt/macro-ai
tar -xzf /tmp/app.tar.gz -C /opt/macro-ai
cd /opt/macro-ai

# Install dependencies and start app
npm install --production
systemctl enable macro-ai.service
systemctl start macro-ai.service
```

### Simplified Methods

- `createUserData()` - Single method, ~80 lines
- `createInstanceRole()` - Keep as-is (essential)
- `createLaunchTemplate()` - Simplified, ~30 lines
- Remove all helper methods for user data generation

## Expected Results

- **File size**: 1012 lines → ~400 lines (60% reduction)
- **Complexity**: Eliminate fallback logic, dual process management, extensive monitoring
- **Reliability**: Fail-fast approach, simpler debugging
- **Maintainability**: Easier to understand and modify

## Legacy Lambda Constructs Analysis

### Files Identified for Removal

#### 1. **deployment-pipeline-construct.ts** (584 lines)

**Purpose**: Complex blue-green deployment pipeline with Step Functions and Lambda
**Components**:

- Step Functions state machine for deployment orchestration
- Lambda functions for health checks and deployment validation
- CloudWatch alarms for rollback triggers
- Integration with AutoScalingConstruct and MonitoringConstruct

**Usage Analysis**:

- ❌ **NOT used in production stacks** (macro-ai-preview-stack.ts, macro-ai-hobby-stack.ts)
- ✅ **Only used in examples/** directory (demonstration/integration examples)
- **Safe to remove**: No production dependencies

#### 2. **deployment-status-construct.ts** (988 lines)

**Purpose**: Deployment status tracking with DynamoDB and Lambda functions
**Components**:

- DynamoDB table for deployment history
- Lambda functions for event processing and status queries
- CloudWatch logging and metrics
- SNS integration for notifications

**Usage Analysis**:

- ⚠️ **USED in macro-ai-preview-stack.ts** (lines 7, 72, 158, 232)
- ✅ **NOT used in macro-ai-hobby-stack.ts**
- **Requires careful removal**: Need to update preview stack

#### 3. **performance-optimization-construct.ts** (1578 lines)

**Purpose**: Advanced performance monitoring and ML-based optimization
**Components**:

- Lambda functions for performance analysis and cost optimization
- DynamoDB table for optimization recommendations
- CloudWatch dashboard for performance metrics
- EventBridge rules for automated optimization

**Usage Analysis**:

- ❌ **NOT used in production stacks**
- ✅ **Only used in examples/** directory
- **Safe to remove**: No production dependencies

### Dependencies to Update

#### macro-ai-preview-stack.ts Changes Required

1. **Remove import** (line 7):

   ```typescript
   import { DeploymentStatusConstruct } from '../constructs/deployment-status-construct.js'
   ```

2. **Remove property** (line 72):

   ```typescript
   public readonly deploymentStatus: DeploymentStatusConstruct
   ```

3. **Remove instantiation** (lines 158-167):

   ```typescript
   this.deploymentStatus = new DeploymentStatusConstruct(...)
   ```

4. **Remove CloudFormation output** (lines 232-236):

   ```typescript
   new cdk.CfnOutput(this, 'DeploymentStatusTableName', {...})
   ```

### Files Safe to Delete (No Production Usage)

- `infrastructure/src/constructs/deployment-pipeline-construct.ts`
- `infrastructure/src/constructs/performance-optimization-construct.ts`
- `infrastructure/examples/deployment-pipeline-integration.ts`
- `infrastructure/examples/deployment-status-integration.ts`
- `infrastructure/examples/enhanced-health-rollback-integration.ts`
- `infrastructure/src/examples/performance-optimization-integration.ts`

### Expected Impact

- **Remove 3,150+ lines** of complex Lambda-based infrastructure code
- **Eliminate Lambda functions**: ~6-8 Lambda functions removed
- **Remove DynamoDB tables**: 2-3 tables for optimization and deployment tracking
- **Simplify deployment**: Focus on direct EC2 deployment without complex orchestration
- **Reduce costs**: No Lambda execution costs, reduced DynamoDB usage

## Next Steps

1. ✅ Remove fallback application serving logic
2. ✅ Remove spot instance configuration
3. ✅ Simplify user data script creation
4. ✅ Remove PM2 configuration
5. ✅ Remove extensive monitoring setup
6. ✅ Remove Phase 4 monitoring integration
7. 🔄 Remove legacy Lambda constructs
8. Test simplified deployment
