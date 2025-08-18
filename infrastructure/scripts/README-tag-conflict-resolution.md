# AWS Tag Conflict Resolution System

## Overview

This system provides comprehensive tools to identify, resolve, and prevent AWS tag conflicts that cause CloudFormation
deployment failures. The system addresses both template-level duplicate tags and historic conflicts from previous deployments.

## Problem Statement

AWS CloudFormation deployments were failing with the error:

```text
Duplicate tag keys found. Please note that Tag keys are case insensitive.
```

This occurs due to:

1. **Template-level duplicates**: Multiple constructs applying the same tag keys
2. **Historic conflicts**: Previous deployments leaving resources with conflicting tag keys
3. **Case sensitivity**: AWS IAM treats "Project" and "project" as duplicate keys

## Solution Components

### 1. Audit Script (`audit-tag-conflicts.sh`)

**Purpose**: Comprehensive scanning of AWS resources to identify tag conflicts

**Features**:

- Scans IAM roles, policies, EC2 instances, security groups, load balancers, CloudWatch logs, DynamoDB tables
- Identifies case-variant tag keys (e.g., "PrNumber" vs "PRNumber")
- Detects legacy tag formats conflicting with current TaggingStrategy
- Finds orphaned resources from failed deployments
- Supports PR-specific filtering

**Usage**:

```bash
# Audit all resources
./infrastructure/scripts/audit-tag-conflicts.sh --region us-east-1 --verbose

# Audit specific PR with detailed output
./infrastructure/scripts/audit-tag-conflicts.sh --pr-number 35 --output-file pr-35-audit.json

# Quick summary
./infrastructure/scripts/audit-tag-conflicts.sh
```

### 2. Cleanup Script (`cleanup-tag-conflicts.sh`)

**Purpose**: Safe resolution of tag conflicts with comprehensive safety features

**Safety Features**:

- **Dry-run mode** (default): Preview changes before execution
- **Environment filtering**: Only targets preview/PR environments, never production
- **Backup capability**: Logs all existing tags before modification for rollback
- **Incremental processing**: Handles resources in batches to avoid API rate limits
- **Confirmation prompts**: Requires explicit confirmation for execution

**Usage**:

```bash
# Preview cleanup (dry-run mode)
./infrastructure/scripts/cleanup-tag-conflicts.sh --dry-run --pr-number 35 --verbose

# Execute cleanup with backup
./infrastructure/scripts/cleanup-tag-conflicts.sh --execute --pr-number 35 --backup-file pr-35-backup.json

# Force cleanup without confirmation (use carefully)
./infrastructure/scripts/cleanup-tag-conflicts.sh --execute --pr-number 35 --force
```

**Tag Standardization**:
The script standardizes tags to match `TaggingStrategy` constants:

- `project` → `Project`
- `environment` → `Environment`
- `PrNumber` → `PRNumber`
- `managedby` → `ManagedBy`
- And many more case variants

### 3. Verification Script (`verify-tag-cleanup.sh`)

**Purpose**: Confirms cleanup success and validates CloudFormation deployment readiness

**Verification Checks**:

- ✓ Scan for remaining tag conflicts
- ✓ Validate tag standardization compliance
- ✓ Check for orphaned resources
- ✓ Verify production resources were not affected
- ✓ Generate comprehensive report
- ✓ Optional CloudFormation template validation

**Usage**:

```bash
# Basic verification
./infrastructure/scripts/verify-tag-cleanup.sh --region us-east-1

# Verify specific PR with detailed report
./infrastructure/scripts/verify-tag-cleanup.sh --pr-number 35 --report-file pr-35-verification.json --verbose

# Full verification including CloudFormation test
./infrastructure/scripts/verify-tag-cleanup.sh --pr-number 35 --check-cloudformation
```

### 4. Integrated Deployment (`deploy-ec2-preview.sh`)

**Purpose**: Automatic tag conflict resolution integrated into deployment workflow

**Integration Points**:

1. **Pre-deployment**: Runs comprehensive cleanup before CloudFormation deployment
2. **Rollback handling**: Cleans up conflicts when recovering from failed deployments
3. **Post-deployment**: Verifies cleanup success and deployment health

**Automatic Features**:

- Detects PR number from stack name
- Creates backup files with timestamps
- Falls back to basic cleanup if comprehensive script unavailable
- Non-blocking verification (doesn't fail deployment on verification issues)

## Workflow Integration

### GitHub Actions Integration

The tag conflict resolution is automatically integrated into the CI/CD pipeline:

1. **PR Creation**: Deployment script automatically runs tag cleanup
2. **Failed Deployment Recovery**: Cleanup runs during rollback handling
3. **Post-Deployment**: Verification ensures no conflicts remain

### Manual Usage Scenarios

#### Scenario 1: New PR Deployment Failing

```bash
# 1. Audit the conflicts
./infrastructure/scripts/audit-tag-conflicts.sh --pr-number 35 --verbose

# 2. Preview cleanup
./infrastructure/scripts/cleanup-tag-conflicts.sh --dry-run --pr-number 35

# 3. Execute cleanup with backup
./infrastructure/scripts/cleanup-tag-conflicts.sh --execute --pr-number 35 --backup-file backup.json

# 4. Verify cleanup
./infrastructure/scripts/verify-tag-cleanup.sh --pr-number 35

# 5. Retry deployment
./infrastructure/scripts/deploy-ec2-preview.sh pr-35
```

#### Scenario 2: General Environment Cleanup

```bash
# 1. Audit all preview environments
./infrastructure/scripts/audit-tag-conflicts.sh --verbose --output-file full-audit.json

# 2. Clean up all preview resources
./infrastructure/scripts/cleanup-tag-conflicts.sh --execute --backup-file full-backup.json

# 3. Verify cleanup
./infrastructure/scripts/verify-tag-cleanup.sh --report-file verification-report.json
```

#### Scenario 3: Rollback from Backup

```bash
# If cleanup caused issues, restore from backup
# (Manual process - restore tags from backup JSON file)
```

## Safety Measures

### Production Protection

- **Environment filtering**: Scripts only target preview/PR environments
- **Production detection**: Automatically skips resources tagged with production indicators
- **AWS managed resources**: Skips AWS service roles and managed resources

### Backup and Recovery

- **Automatic backups**: Original tags saved before modification
- **Timestamped files**: Backup files include timestamps for tracking
- **JSON format**: Structured backup format for easy restoration

### Error Handling

- **Graceful degradation**: Falls back to basic cleanup if comprehensive script fails
- **Non-blocking verification**: Deployment succeeds even if verification finds issues
- **Detailed logging**: Comprehensive logging for troubleshooting

## Troubleshooting

### Common Issues

1. **Script not found errors**

   ```bash
   # Ensure scripts are executable
   chmod +x infrastructure/scripts/*.sh
   ```

2. **AWS CLI access errors**

   ```bash
   # Verify AWS credentials
   aws sts get-caller-identity
   ```

3. **Permission errors**

   ```bash
   # Ensure IAM permissions for tagging operations
   # Required: iam:TagRole, iam:UntagRole, ec2:CreateTags, ec2:DeleteTags
   ```

4. **Backup file issues**

   ```bash
   # Ensure directory exists and is writable
   mkdir -p backups/
   ```

### Debug Mode

Enable verbose logging for detailed troubleshooting:

```bash
./infrastructure/scripts/audit-tag-conflicts.sh --verbose
./infrastructure/scripts/cleanup-tag-conflicts.sh --verbose
./infrastructure/scripts/verify-tag-cleanup.sh --verbose
```

## Best Practices

1. **Always run audit first** to understand the scope of conflicts
2. **Use dry-run mode** to preview changes before execution
3. **Create backups** before running cleanup operations
4. **Verify cleanup success** before attempting deployments
5. **Monitor deployment logs** for any remaining tag-related errors
6. **Keep backup files** for at least one deployment cycle

## Future Enhancements

- **Automated CI/CD integration**: Run cleanup automatically on PR creation
- **Tag policy enforcement**: Prevent future tag conflicts through AWS Config rules
- **Cross-region support**: Extend cleanup to multiple AWS regions
- **Resource type expansion**: Add support for additional AWS resource types
- **Rollback automation**: Automated restoration from backup files
