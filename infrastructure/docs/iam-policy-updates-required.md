# IAM Policy Updates Required

## Overview

Due to significant changes in our deployment architecture and Parameter Store naming conventions, several IAM policies
need to be updated to ensure proper access control and security.

## 🔴 **Critical Changes Made**

### 1. **Parameter Store Naming Convention Change**

- **Before**: `/macro-ai/development/` (slash-based hierarchy)
- **After**: `macro-ai-development-` (hyphen-based hierarchy)
- **Impact**: All IAM policies referencing Parameter Store paths need updates

### 2. **Deployment Architecture Change**

- **Before**: Lambda functions with runtime Parameter Store access
- **After**: ECS services with CDK synthesis time configuration injection
- **Impact**: ECS services no longer need Parameter Store read permissions

### 3. **Security Model Improvement**

- **Before**: ECS services had broad Parameter Store access for runtime configuration
- **After**: ECS services receive configuration at deployment time, eliminating runtime access needs
- **Impact**: Reduced attack surface and improved security posture

## 📋 **Required IAM Policy Updates**

### **GitHub Actions Policy** (`enhanced-github-actions-policy.json`)

#### ✅ **Already Updated**

- **ParameterStoreManagement**: Added support for both naming conventions

  ```json
  "Resource": [
    "arn:aws:ssm:*:*:parameter/macro-ai/*",
    "arn:aws:ssm:*:*:parameter/macro-ai-*"
  ]
  ```

#### ✅ **New Permissions Added**

- **ECSDeploymentPermissions**: Full ECS service management capabilities
  - Instance creation, termination, modification
  - VPC, subnet, security group management
  - Instance monitoring and tagging

### **ECS Task Role** (`ecs-construct.ts`)

#### ✅ **Already Updated**

- **Parameter Store permissions removed entirely**
- **KMS decryption permissions removed**
- **Security improvement**: ECS services no longer have access to sensitive configuration

#### **Benefits of This Change**

1. **Reduced Attack Surface**: Compromised ECS services cannot access Parameter Store
2. **Simplified IAM**: Fewer permissions to manage and audit
3. **Better Security**: Configuration injected at deployment time, not runtime

### **Parameter Store Construct** (`parameter-store-construct.ts`)

#### ✅ **Already Updated**

- **Backward compatibility**: Supports both naming conventions
- **Flexible parameter naming**: Automatically detects format and applies appropriate naming

## 🔧 **Additional IAM Policy Considerations**

### **Environment Configuration Construct**

The new `EnvironmentConfigConstruct` runs during CDK synthesis and needs:

- **Parameter Store read access** during deployment
- **KMS decrypt permissions** for SecureString parameters
- **Access to both naming conventions** for migration support

### **Migration Support**

During the transition period, we need policies that support:

- **Legacy paths**: `/macro-ai/development/*`
- **New paths**: `macro-ai-development-*`
- **Cross-format operations**: Copying parameters between conventions

## 🚨 **Immediate Action Required**

### **1. Update Existing IAM Policies**

```bash
# Update GitHub Actions role with new policy
aws iam put-role-policy \
  --role-name macro-ai-github-actions-role \
  --policy-name enhanced-github-actions-policy \
  --policy-document file://infrastructure/iam-policies/enhanced-github-actions-policy.json
```

### **2. Verify ECS Task Roles**

Ensure all ECS services are using the updated role without Parameter Store permissions:

```bash
# Check ECS task role
aws ecs describe-services --cluster macro-ai-development-cluster --services macro-ai-development-service \
  --query 'Reservations[0].Instances[0].IamInstanceProfile.Arn'
```

### **3. Test Parameter Store Access**

Verify GitHub Actions can access both naming conventions:

```bash
# Test legacy format
aws ssm get-parameters-by-path --path "/macro-ai/development" --recursive

# Test new format
aws ssm get-parameters-by-path --path "macro-ai-development" --recursive
```

## 🔒 **Security Benefits Achieved**

### **Before (Lambda + Runtime Access)**

- Lambda functions had broad Parameter Store access
- Runtime configuration loading created potential attack vectors
- IAM policies were complex with many permissions

### **After (ECS + CDK Synthesis Time)**

- ECS services have minimal required permissions
- Configuration injected at deployment time, not runtime
- Simplified IAM policies with reduced attack surface
- Better separation of concerns

## 📊 **Policy Comparison**

| Permission Category       | Before            | After             | Change       |
| ------------------------- | ----------------- | ----------------- | ------------ |
| **Parameter Store Read**  | ✅ ECS services   | ❌ ECS services   | **Removed**  |
| **Parameter Store Write** | ✅ GitHub Actions | ✅ GitHub Actions | **Enhanced** |
| **ECS Management**        | ❌ Limited        | ✅ Full           | **Added**    |
| **KMS Decrypt**           | ✅ ECS services   | ❌ ECS services   | **Removed**  |
| **Security Groups**       | ❌ Limited        | ✅ Full           | **Added**    |

## 🎯 **Next Steps**

1. **Deploy Updated IAM Policies** ✅
2. **Test GitHub Actions Deployment** 🔄
3. **Verify ECS Service Security** 🔄
4. **Monitor Parameter Store Access** 🔄
5. **Complete Migration to New Naming** 🔄

## ⚠️ **Important Notes**

- **Backward Compatibility**: Both naming conventions are supported during transition
- **Security Improvement**: ECS services are now more secure with reduced permissions
- **Deployment Impact**: No downtime required for IAM policy updates
- **Monitoring**: Enhanced logging and monitoring for ECS deployments

## 🔍 **Verification Commands**

```bash
# Verify GitHub Actions can access both naming conventions
aws ssm describe-parameters --parameter-filters "Key=Name,Option=BeginsWith,Values=macro-ai"

# Verify ECS services don't have Parameter Store access
aws iam get-role-policy --role-name macro-ai-development-ecs-task-role --policy-name inline-policy

# Test deployment workflow
gh workflow run deploy-preview.yml --ref feature/iam-policy-updates
```

## 📚 **Related Documentation**

- [Parameter Store Management Guide](./parameter-store-management.md)
- [ECS Fargate Deployment Guide](../deployment/ecs-fargate-deployment-guide.md)
- [Security Best Practices](./security-best-practices.md)
- [Migration Guide](./migration-guide.md)
