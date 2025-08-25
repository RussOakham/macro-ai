# Deployment Artifact Versioning & Race Condition Fix

## Overview

This document describes the comprehensive solution implemented to fix deployment artifact race conditions and ensure consistent
EC2 deployments across all instances in a preview environment.

## Problem Statement

### Original Issue: Deployment Artifact Race Condition

During PR preview deployments, we discovered a critical race condition where EC2 instances could download different versions
of the deployment artifact, leading to inconsistent application deployments:

**Symptoms:**

- Different EC2 instances running different versions of the application code
- Some instances using old artifacts with workspace dependencies (causing npm errors)
- Other instances using new artifacts with resolved catalog dependencies (working correctly)

**Root Cause:**

1. **S3 Path Reuse**: All deployments for the same PR used the same S3 path (`express-api/pr-{number}/express-api-deployment.tar.gz`)
2. **Race Condition**: EC2 instances could launch and download artifacts before the new S3 upload completed
3. **No Dependency Verification**: CDK deployment started immediately after S3 upload without verifying completion

## Solution: Versioned Artifact System

### 1. Artifact Versioning Strategy

**New S3 Key Pattern:**

```bash
express-api/{environment}/{commit-sha}-{timestamp}/express-api-deployment.tar.gz
```

**Example:**

```bash
express-api/pr-51/622d2103-20250820-124500/express-api-deployment.tar.gz
```

**Benefits:**

- **Unique per deployment**: Each GitHub Actions run creates a unique artifact
- **Immutable**: Once uploaded, artifacts are never overwritten
- **Traceable**: Commit SHA and timestamp provide clear lineage
- **Rollback-friendly**: Previous versions remain available

### 2. Enhanced Upload Process

**GitHub Actions Workflow Changes:**

```yaml
# Generate versioned artifact key
COMMIT_SHORT="${{ github.sha }}"
COMMIT_SHORT="${COMMIT_SHORT:0:8}"
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
ARTIFACT_KEY="express-api/${{ env-name }}/${COMMIT_SHORT}-${TIMESTAMP}/express-api-deployment.tar.gz"

# Upload with enhanced metadata
aws s3 cp ./express-api-artifact/express-api-deployment.tar.gz \
  "s3://${BUCKET_NAME}/${ARTIFACT_KEY}" \
  --metadata "commit-sha=${{ github.sha }},branch=${{ github.ref_name }},build-time=${TIMESTAMP},workflow-run-id=${{ github.run_id }},pr-number=${{ github.event.pull_request.number }}"

# Verify upload completion
aws s3 ls "s3://${BUCKET_NAME}/${ARTIFACT_KEY}"
```

### 3. Deployment Verification

**Pre-CDK Deployment Checks:**

```bash
# Verify artifact exists before starting infrastructure deployment
if aws s3api head-object --bucket "${DEPLOYMENT_BUCKET}" --key "${DEPLOYMENT_KEY}" >/dev/null 2>&1; then
  ARTIFACT_SIZE=$(aws s3api head-object --bucket "${DEPLOYMENT_BUCKET}" --key "${DEPLOYMENT_KEY}" --query 'ContentLength' --output text)
  ARTIFACT_MODIFIED=$(aws s3api head-object --bucket "${DEPLOYMENT_BUCKET}" --key "${DEPLOYMENT_KEY}" --query 'LastModified' --output text)
  echo "✅ Artifact verified - Size: ${ARTIFACT_SIZE} bytes, Modified: ${ARTIFACT_MODIFIED}"
else
  echo "❌ Artifact verification failed - cannot proceed with deployment"
  exit 1
fi
```

### 4. EC2 Instance Configuration

**Enhanced User Data Script:**

```bash
# Use environment variables from GitHub Actions for versioned artifacts
if [[ -n "${DEPLOYMENT_BUCKET:-}" && -n "${DEPLOYMENT_KEY:-}" ]]; then
    echo "✅ Using deployment artifact from environment variables"
    echo "DEPLOYMENT_BUCKET=${DEPLOYMENT_BUCKET}"
    echo "DEPLOYMENT_KEY=${DEPLOYMENT_KEY}"
else
    echo "⚠️ Environment variables not set, using fallback configuration"
    # Fallback to legacy pattern for backward compatibility
    DEPLOYMENT_BUCKET="macro-ai-deployment-artifacts-${AWS_ACCOUNT_ID}"
    DEPLOYMENT_KEY="express-api/pr-${PR_NUMBER}/express-api-deployment.tar.gz"
fi
```

**Enhanced Artifact Verification:**

```bash
# Verify artifact exists before download
if aws s3api head-object --bucket "${DEPLOYMENT_BUCKET}" --key "${DEPLOYMENT_KEY}" >/dev/null 2>&1; then
    ARTIFACT_SIZE=$(aws s3api head-object --bucket "${DEPLOYMENT_BUCKET}" --key "${DEPLOYMENT_KEY}" --query 'ContentLength' --output text)
    ARTIFACT_MODIFIED=$(aws s3api head-object --bucket "${DEPLOYMENT_BUCKET}" --key "${DEPLOYMENT_KEY}" --query 'LastModified' --output text)
    echo "✅ Artifact verified in S3:"
    echo "  Size: ${ARTIFACT_SIZE} bytes"
    echo "  Last Modified: ${ARTIFACT_MODIFIED}"

    # Get artifact metadata for verification
    aws s3api head-object --bucket "${DEPLOYMENT_BUCKET}" --key "${DEPLOYMENT_KEY}" --query 'Metadata' --output table
else
    echo "❌ Artifact not found in S3: s3://${DEPLOYMENT_BUCKET}/${DEPLOYMENT_KEY}"
    echo "Available artifacts in bucket:"
    aws s3 ls "s3://${DEPLOYMENT_BUCKET}/" --recursive | grep "express-api" | tail -10
    exit 1
fi
```

## Artifact Lifecycle Management

### 1. Automatic Cleanup

**Cleanup Script:** `infrastructure/scripts/cleanup-deployment-artifacts.sh`

**Features:**

- Configurable retention policies (default: 7 days)
- Per-PR artifact count limits (default: keep 5 most recent)
- Dry-run mode for safe testing
- Size calculation and reporting

**Usage Examples:**

```bash
# Clean all artifacts older than 7 days (dry run)
./cleanup-deployment-artifacts.sh --bucket macro-ai-deployment-artifacts-123456789 --dry-run

# Clean artifacts for PR 51, keeping last 3 versions
./cleanup-deployment-artifacts.sh --bucket macro-ai-deployment-artifacts-123456789 --pr 51 --keep 3

# Clean all artifacts older than 3 days
./cleanup-deployment-artifacts.sh --bucket macro-ai-deployment-artifacts-123456789 --days 3
```

### 2. Integrated Cleanup

**GitHub Actions Integration:**

```yaml
- name: Cleanup old deployment artifacts
  run: |
    # Run cleanup for this specific PR to keep only last 3 versions
    infrastructure/scripts/cleanup-deployment-artifacts.sh \
      --bucket "${BUCKET_NAME}" \
      --pr "${PR_NUMBER}" \
      --keep 3
```

## Benefits & Impact

### 1. Deployment Consistency

- **Guaranteed artifact consistency**: All EC2 instances in a deployment use the same artifact version
- **Eliminated race conditions**: No more timing-dependent deployment failures
- **Improved reliability**: Deployments are now deterministic and repeatable

### 2. Debugging & Traceability

- **Clear artifact lineage**: Each artifact is tied to a specific commit and timestamp
- **Enhanced logging**: Comprehensive verification and metadata logging
- **Rollback capability**: Previous artifacts remain available for emergency rollbacks

### 3. Operational Efficiency

- **Automatic cleanup**: Prevents S3 bucket bloat while maintaining recent versions
- **Cost optimization**: Removes old artifacts to minimize storage costs
- **Monitoring friendly**: Rich metadata enables better monitoring and alerting

## Migration & Backward Compatibility

### 1. Gradual Rollout

- **Environment variable detection**: EC2 instances automatically detect new vs. legacy deployment patterns
- **Fallback mechanism**: Legacy artifact paths still work for existing deployments
- **Zero-downtime migration**: No service interruption during the transition

### 2. Monitoring

- **Deployment verification**: Each step includes comprehensive verification and logging
- **Failure detection**: Clear error messages and diagnostic information
- **Metrics collection**: Artifact sizes, download times, and success rates are logged

## Future Enhancements

### 1. Advanced Features

- **Artifact signing**: Cryptographic verification of artifact integrity
- **Multi-region replication**: Cross-region artifact availability for disaster recovery
- **Compression optimization**: Advanced compression for faster downloads

### 2. Monitoring & Alerting

- **CloudWatch integration**: Artifact download metrics and alerts
- **Dashboard creation**: Visual monitoring of deployment artifact health
- **Automated remediation**: Self-healing deployment pipelines

## Troubleshooting

### Common Issues

1. **Artifact not found**: Check GitHub Actions logs for S3 upload completion
2. **Permission errors**: Verify EC2 instance IAM role has S3 access
3. **Download timeouts**: Check network connectivity and artifact size

### Diagnostic Commands

```bash
# Check artifact availability
aws s3 ls s3://macro-ai-deployment-artifacts-{account-id}/express-api/pr-{number}/

# Verify artifact metadata
aws s3api head-object --bucket macro-ai-deployment-artifacts-{account-id} --key express-api/pr-{number}/{commit}-{timestamp}/express-api-deployment.tar.gz

# Check EC2 instance logs
sudo tail -f /var/log/user-data.log
```
