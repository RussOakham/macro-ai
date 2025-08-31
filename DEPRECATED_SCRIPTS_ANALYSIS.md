# Deprecated Scripts Analysis - Phase 2C

This document analyzes the current state of scripts in the Macro AI codebase to identify deprecated, unused, and missing
scripts.

## 📊 **Script Inventory Summary**

### **Root Scripts Directory** (`/scripts/`)

- **Total Scripts**: 2
- **Status**: ✅ **ACTIVE** - Both scripts are actively used

### **Express API Scripts** (`/apps/express-api/scripts/`)

- **Total Scripts**: 10
- **Status**: 🔄 **MIXED** - Some actively used, some potentially deprecated

### **Infrastructure Scripts** (`/infrastructure/scripts/`)

- **Total Scripts**: 33
- **Status**: 🔄 **MIXED** - Many validation and testing scripts

### **Client UI Scripts** (`/apps/client-ui/scripts/`)

- **Total Scripts**: 18
- **Status**: ✅ **ACTIVE** - Most scripts are actively used in CI/CD

## 🚨 **Critical Issues Found**

### **Legacy EC2 Scripts Referenced in CI/CD** ⚠️ **LEGACY - REMOVE REFERENCES**

These scripts are referenced in GitHub Actions but are **legacy EC2 deployment scripts** that should not exist since the
project has migrated to ECS Fargate:

1. **`verify-ec2-cleanup.sh`** ❌ **LEGACY - REMOVE REFERENCES**
   - **Referenced in**: Multiple GitHub Actions workflows
   - **Status**: Legacy EC2 deployment script - project now uses ECS Fargate
   - **Action Required**: Remove references from workflows, not create the script
   - **Files affected**:
     - `.github/workflows/destroy-preview.yml`
     - `.github/workflows/scheduled-cleanup.yml`
     - `.github/workflows/teardown-dev.yml`

2. **`validate-ec2-api-health.sh`** ❌ **LEGACY - REMOVE REFERENCES**
   - **Referenced in**: Testing documentation and guides
   - **Status**: Legacy EC2 validation script - project now uses ECS Fargate
   - **Action Required**: Remove references from documentation, not create the script
   - **Files affected**:
     - `docs/testing/ec2-api-validation-guide.md`

3. **`validate-alb-api-routing.sh`** ❌ **LEGACY - REMOVE REFERENCES**
   - **Referenced in**: Testing documentation
   - **Status**: Legacy EC2 ALB validation script - project now uses ECS Fargate
   - **Action Required**: Remove references from documentation, not create the script

## 🔍 **Script Usage Analysis**

### **Actively Used Scripts** ✅

#### **Root Level**

- `resolve-catalog-references.ts` - Used in build processes
- `validate-workflow-integration.sh` - Used in CI validation

#### **Express API**

- `validate-env.js` - Used in package.json prebuild
- `generate-env-from-parameter-store.sh` - Used in GitHub Actions
- `build-docker-with-env.sh` - Used in Docker builds

#### **Infrastructure**

- `deploy.sh` - Main deployment script
- `github-actions-deploy.sh` - CI/CD deployment
- `manage-preview-stack.sh` - Preview environment management
- `cost-optimization-reporter.sh` - Cost tracking (referenced in workflows)

#### **Client UI**

- `deploy-amplify.sh` - Amplify deployment
- `configure-amplify-custom-domain.sh` - Domain configuration
- `inject-preview-env.sh` - Environment injection
- `backend-discovery-service.sh` - Backend discovery
- `api-resolution-service.sh` - API resolution

### **Potentially Deprecated Scripts** ⚠️

#### **Express API**

- `setup-docker-dev.sh` - May be replaced by newer Docker setup
- `deploy-docker-prod.sh` - May be replaced by ECS deployment
- `build-and-push-ecr.sh` - May be replaced by newer ECR scripts
- `test-cors-configuration.cjs` - Testing script, may not be needed in production
- `test-application-functionality.cjs` - Testing script, may not be needed in production

#### **Infrastructure**

- `emergency-cleanup-pr35.sh` - Emergency script, likely no longer needed
- `validate-pm2-process-management.sh` - PM2 validation, may not be relevant
- `test-fixes-validation.sh` - Temporary testing script

## 📋 **Action Items**

### **Immediate (High Priority)** 🔴 **CRITICAL - LEGACY CLEANUP**

1. **Remove EC2 script references** from GitHub Actions workflows
   - Update `.github/workflows/destroy-preview.yml` to remove EC2 cleanup verification
   - Update `.github/workflows/scheduled-cleanup.yml` to remove EC2 cleanup verification
   - Update `.github/workflows/teardown-dev.yml` to remove EC2 cleanup verification
   - Replace with ECS Fargate cleanup verification or remove entirely

2. **Remove EC2 script references** from testing documentation
   - Update `docs/testing/ec2-api-validation-guide.md` to remove EC2 validation references
   - Update `docs/testing/ec2-teardown-testing-guide.md` to remove EC2 teardown references
   - Replace with ECS Fargate validation documentation or remove entirely

3. **Update workflow logic** for ECS Fargate deployment
   - Replace EC2 cleanup verification with ECS service cleanup verification
   - Update resource cleanup descriptions from EC2 to ECS terminology

### **Short Term (Medium Priority)**

1. **Audit Express API scripts** for deprecation
2. **Remove emergency cleanup scripts** that are no longer needed
3. **Consolidate similar validation scripts** in infrastructure
4. **Create ECS Fargate cleanup verification** if needed

### **Long Term (Low Priority)**

1. **Create script documentation** for all active scripts
2. **Implement script versioning** for better maintenance
3. **Add script health checks** to CI/CD pipeline

## 🎯 **Success Criteria**

- [ ] All legacy EC2 script references removed from workflows
- [ ] All legacy EC2 script references removed from documentation
- [ ] Workflows updated for ECS Fargate deployment strategy
- [ ] No CI/CD failures due to missing legacy scripts
- [ ] Deprecated scripts are identified and removed
- [ ] Script documentation is comprehensive and up-to-date
- [ ] Script usage is tracked and monitored

## 📈 **Impact Assessment**

### **High Impact**

- **CI/CD Failures**: Legacy EC2 script references cause deployment failures
- **Deployment Strategy Mismatch**: Workflows still reference EC2 when using ECS
- **Developer Experience**: Confusion about current deployment strategy

### **Medium Impact**

- **Maintenance Overhead**: Legacy script references increase maintenance burden
- **Documentation Drift**: Script references become outdated
- **Security Risk**: Legacy scripts may contain outdated security practices

### **Low Impact**

- **Storage**: Legacy script references consume minimal storage
- **Build Time**: Minimal impact on build processes

## 🔄 **Next Steps**

1. **Remove legacy EC2 script references** from all workflows and documentation
2. **Update workflows** to use ECS Fargate cleanup verification
3. **Create ECS Fargate cleanup scripts** if needed (optional)
4. **Update documentation** to reflect current ECS deployment strategy
5. **Implement script health checks** in CI/CD pipeline

## 🏗️ **Architecture Context**

**Current State**: The project has fully migrated from EC2-based deployment to **ECS Fargate** with containerized applications.

**Migration Status**: ✅ **COMPLETED** - All infrastructure now uses ECS Fargate constructs

**Legacy Components**: EC2-related scripts, workflows, and documentation are **outdated** and should be **removed**, not
recreated.

---

**Phase 2C Status**: 🔄 **IN PROGRESS** - Legacy script analysis complete, cleanup action items identified
**Next Phase**: Phase 3A - Infrastructure Documentation Updates (ECS Fargate focus)
