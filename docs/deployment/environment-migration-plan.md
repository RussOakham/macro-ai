# Environment Migration Plan: hobby → development

## 📋 Overview

This document outlines the migration plan for renaming the `hobby` environment to `development` across all AWS resources,
configuration files, and documentation.

## 🎯 Migration Goals

1. **Rename Environment**: Change `hobby` → `development` for clearer environment hierarchy
2. **Maintain Infrastructure Scale**: Keep `hobby` as infrastructure scale designation
3. **Zero Downtime**: Ensure continuous service availability during migration
4. **Data Preservation**: Migrate all Parameter Store values and configurations

## 🔄 Migration Strategy

### **Phase 1: Code and Configuration Updates** ✅ COMPLETE

- [x] GitHub Actions workflows updated
- [x] CDK app configuration updated
- [x] Infrastructure scripts updated
- [x] Configuration schemas updated
- [x] Documentation files updated
- [x] Client environment files created

### **Phase 2: AWS Resource Migration** 📋 PLANNED

#### **2.1 CloudFormation Stack Migration**

**Current State:**

- Stack Name: `MacroAiHobbyStack`
- Resources: Lambda, API Gateway, IAM roles, Parameter Store parameters

**Target State:**

- Stack Name: `MacroAiDevelopmentStack`
- Same resources with updated naming

**Migration Steps:**

1. Deploy new `MacroAiDevelopmentStack` alongside existing stack
2. Migrate Parameter Store values to new paths
3. Update DNS/routing (if applicable)
4. Validate new stack functionality
5. Delete old `MacroAiHobbyStack`

#### **2.2 Parameter Store Migration**

**Current Paths:**

```text
/macro-ai/hobby/critical/
├── openai-api-key
└── neon-database-url

/macro-ai/hobby/standard/
├── upstash-redis-url
├── cognito-user-pool-id
└── cognito-user-pool-client-id
```

**Target Paths:**

```text
/macro-ai/development/critical/
├── openai-api-key
└── neon-database-url

/macro-ai/development/standard/
├── upstash-redis-url
├── cognito-user-pool-id
└── cognito-user-pool-client-id
```

**Migration Script:**

```bash
#!/bin/bash
# migrate-parameters.sh

SOURCE_PREFIX="/macro-ai/hobby"
TARGET_PREFIX="/macro-ai/development"

# Get all parameters from source
aws ssm get-parameters-by-path \
  --path "$SOURCE_PREFIX" \
  --recursive \
  --with-decryption \
  --query 'Parameters[*].[Name,Value,Type]' \
  --output text | while read name value type; do

  # Calculate new parameter name
  new_name="${name/$SOURCE_PREFIX/$TARGET_PREFIX}"

  # Copy parameter to new location
  aws ssm put-parameter \
    --name "$new_name" \
    --value "$value" \
    --type "$type" \
    --overwrite

  echo "Migrated: $name → $new_name"
done
```

#### **2.3 Lambda Function Migration**

**Current:**

- Function Name: `macro-ai-hobby-api`
- Log Group: `/aws/lambda/macro-ai-hobby-api`

**Target:**

- Function Name: `macro-ai-development-api`
- Log Group: `/aws/lambda/macro-ai-development-api`

**Migration:** Handled automatically by CDK stack deployment

#### **2.4 API Gateway Migration**

**Current:**

- API Name: `macro-ai-hobby-api`
- Stage: `hobby`

**Target:**

- API Name: `macro-ai-development-api`
- Stage: `development`

**Migration:** New API Gateway created by CDK stack

## ⚠️ Migration Risks & Mitigation

### **Risk 1: Service Downtime**

- **Mitigation**: Deploy new stack before deleting old stack
- **Rollback**: Keep old stack until new stack is validated

### **Risk 2: Parameter Store Data Loss**

- **Mitigation**: Backup all parameters before migration
- **Validation**: Verify all parameters copied correctly

### **Risk 3: DNS/Routing Issues**

- **Mitigation**: Update frontend configuration after backend migration
- **Testing**: Validate API endpoints before switching traffic

## 📝 Migration Checklist

### **Pre-Migration**

- [ ] Backup current Parameter Store values
- [ ] Document current API Gateway endpoints
- [ ] Verify GitHub Actions workflows are updated
- [ ] Test deployment with new environment name locally

### **Migration Execution**

- [ ] Deploy new `MacroAiDevelopmentStack`
- [ ] Run parameter migration script
- [ ] Validate new stack functionality
- [ ] Update frontend environment variables
- [ ] Test end-to-end functionality

### **Post-Migration**

- [ ] Delete old `MacroAiHobbyStack`
- [ ] Clean up old Parameter Store parameters
- [ ] Update monitoring dashboards
- [ ] Update documentation with new resource names

## 🔧 Migration Commands

### **Deploy New Stack**

```bash
cd infrastructure
CDK_DEPLOY_ENV=development pnpm deploy
```

### **Migrate Parameters**

```bash
./scripts/migrate-parameters.sh
```

### **Validate Migration**

```bash
# Test new API endpoint
curl $(aws cloudformation describe-stacks \
  --stack-name MacroAiDevelopmentStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text)api/health

# Verify parameters
aws ssm get-parameters-by-path \
  --path "/macro-ai/development" \
  --recursive \
  --query 'Parameters[*].Name' \
  --output table
```

### **Cleanup Old Resources**

```bash
# Delete old stack
aws cloudformation delete-stack --stack-name MacroAiHobbyStack

# Delete old parameters (after validation)
aws ssm delete-parameters \
  --names $(aws ssm get-parameters-by-path \
    --path "/macro-ai/hobby" \
    --recursive \
    --query 'Parameters[*].Name' \
    --output text)
```

## 📊 Expected Timeline

- **Phase 1**: Code Updates - ✅ Complete
- **Phase 2**: AWS Migration - 2-3 hours
  - Stack deployment: 30 minutes
  - Parameter migration: 15 minutes
  - Validation: 30 minutes
  - Frontend updates: 30 minutes
  - Cleanup: 30 minutes

## 🎉 Success Criteria

- [ ] New `MacroAiDevelopmentStack` deployed successfully
- [ ] All Parameter Store values migrated
- [ ] API endpoints responding correctly
- [ ] Frontend connecting to new backend
- [ ] Old resources cleaned up
- [ ] Documentation updated with new resource names

## 📞 Rollback Plan

If issues occur during migration:

1. **Immediate**: Switch frontend back to old API endpoint
2. **Parameter Issues**: Restore from Parameter Store backup
3. **Stack Issues**: Delete new stack, keep old stack running
4. **Complete Rollback**: Revert all code changes to use `hobby` environment
