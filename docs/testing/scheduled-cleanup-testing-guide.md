# Scheduled Cleanup Workflow Testing Guide

This guide provides comprehensive testing procedures for validating the scheduled cleanup workflow and ensuring it works
correctly with proper safety checks, error handling, and doesn't interfere with active development.

## Overview

The scheduled cleanup system consists of:

- **Scheduled workflow**: `scheduled-cleanup.yml` (runs nightly at 10:00 PM UTC)
- **Environment discovery**: `discover-preview-environments.sh` (finds environments to clean)
- **Cost optimization reporting**: `cost-optimization-reporter.sh` (tracks savings)
- **Centralized verification**: `verify-ec2-cleanup.sh` (validates cleanup)

## Pre-Testing Validation

### 1. Workflow Syntax Validation

```bash
# Validate YAML syntax (if Python is available)
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/scheduled-cleanup.yml'))"

# Alternative: Use online YAML validators or IDE validation
```

### 2. Testing Scripts Validation

```bash
# Test all scripts are executable and functional
cd infrastructure

# Test discovery script
./scripts/discover-preview-environments.sh --help
./scripts/discover-preview-environments.sh --max-age 48 --output-format summary

# Test cost optimization reporter
./scripts/cost-optimization-reporter.sh --help

# Test verification script
./scripts/verify-ec2-cleanup.sh --help

# Test scheduled cleanup testing script
./scripts/test-scheduled-cleanup.sh --help
```

### 3. Content Validation Checklist

#### scheduled-cleanup.yml Checklist

- [ ] ✅ Contains cron schedule: `'0 22 * * *'` (10:00 PM UTC)
- [ ] ✅ Has workflow_dispatch with dry_run default: true
- [ ] ✅ Uses matrix strategy with max-parallel: 3
- [ ] ✅ Has fail-fast: false for cleanup operations
- [ ] ✅ Integrates with verify-ec2-cleanup.sh
- [ ] ✅ Includes cost optimization reporting
- [ ] ✅ Has comprehensive error handling and logging
- [ ] ✅ Supports configurable max age (default: 24 hours)

## Safety Mechanisms Testing

### Test Scenario 1: Dry Run Mode (Default)

**Prerequisites:**

- Scheduled cleanup workflow deployed
- Manual workflow dispatch permissions

**Test Steps:**

1. Navigate to Actions → "Scheduled Preview Environment Cleanup"
2. Click "Run workflow"
3. Leave "Dry run mode" checked (default)
4. Set "Maximum age in hours" to 1 (to catch more environments)
5. Run the workflow
6. Monitor execution and verify results

**Expected Results:**

- [ ] Workflow discovers all preview environments
- [ ] Shows what would be cleaned up without actual deletion
- [ ] Reports "DRY RUN MODE" in all outputs
- [ ] No actual resources are destroyed
- [ ] Cost savings are calculated but not recorded
- [ ] No notifications are sent

### Test Scenario 2: Age-Based Filtering

**Test Cases:**

1. **Young environments**: Set max age to 1 hour, verify recent environments are skipped
2. **Old environments**: Set max age to 72 hours, verify old environments are selected
3. **Mixed ages**: Test with environments of various ages

**Expected Results:**

- [ ] Only environments older than max age are selected for cleanup
- [ ] Age calculations are accurate based on CloudFormation stack creation time
- [ ] Environments within age limits are preserved
- [ ] Clear logging shows age-based decisions

### Test Scenario 3: Force Cleanup Mode

**Test Steps:**

1. Run workflow with "Force cleanup" enabled
2. Set max age to a high value (e.g., 168 hours)
3. Monitor which environments are selected

**Expected Results:**

- [ ] All environments are selected regardless of age
- [ ] Clear indication that force mode is active
- [ ] Appropriate warnings about force cleanup

## Error Handling Testing

### Test Scenario 4: No Environments Found

**Test Steps:**

1. Run workflow when no preview environments exist
2. Monitor workflow execution

**Expected Results:**

- [ ] Workflow completes successfully
- [ ] "No cleanup required" job runs
- [ ] Appropriate messaging about no environments found
- [ ] No error states or failures

### Test Scenario 5: Partial Cleanup Failures

**Simulation:**

- Create test environments with complex dependencies
- Simulate cleanup failures for some environments

**Expected Results:**

- [ ] Workflow continues processing other environments
- [ ] Failed cleanups are properly logged
- [ ] Verification reports partial success
- [ ] Overall workflow doesn't fail due to individual failures

### Test Scenario 6: AWS API Throttling

**Test Steps:**

1. Run workflow with many environments (if available)
2. Monitor for API throttling issues

**Expected Results:**

- [ ] max-parallel: 3 prevents excessive concurrent operations
- [ ] Appropriate delays and retries handle throttling
- [ ] No workflow failures due to API limits

## Cost Optimization Testing

### Test Scenario 7: Cost Tracking Integration

**Test Steps:**

1. Run workflow in live mode (not dry run) with environments to clean
2. Verify cost data is recorded
3. Generate cost reports

**Expected Results:**

- [ ] Cleanup operations are recorded in cost data file
- [ ] Cost savings calculations are accurate
- [ ] Historical data is maintained
- [ ] Reports show cumulative savings

### Test Scenario 8: Notification System

**Prerequisites:**

- Configure SLACK_WEBHOOK_URL secret (optional)
- Configure COST_REPORT_EMAIL secret (optional)

**Test Steps:**

1. Run workflow in live mode with successful cleanup
2. Verify notifications are sent

**Expected Results:**

- [ ] Slack notifications sent if webhook configured
- [ ] Email notifications sent if recipient configured
- [ ] Notifications contain accurate cost savings data
- [ ] Missing notification configs don't cause workflow failure

## Performance and Scalability Testing

### Test Scenario 9: Large Number of Environments

**Test Steps:**

1. Create multiple test preview environments (if possible)
2. Run scheduled cleanup workflow
3. Monitor execution time and resource usage

**Expected Results:**

- [ ] Workflow completes within reasonable time (< 30 minutes)
- [ ] Matrix strategy handles parallel processing correctly
- [ ] No timeout issues or resource exhaustion
- [ ] All environments are processed correctly

### Test Scenario 10: Concurrent Execution Prevention

**Test Steps:**

1. Trigger workflow manually while scheduled run is active
2. Monitor for conflicts or issues

**Expected Results:**

- [ ] GitHub Actions prevents concurrent runs appropriately
- [ ] No resource conflicts or data corruption
- [ ] Clear indication of concurrent execution handling

## Production Deployment Testing

### Pre-Production Checklist

1. **Workflow Validation**
   - [ ] YAML syntax is valid
   - [ ] All required secrets are configured
   - [ ] Cron schedule is correct (10:00 PM UTC)
   - [ ] Dry run mode is default for manual triggers

2. **Safety Mechanisms**
   - [ ] Age-based filtering works correctly
   - [ ] Dry run mode prevents actual deletion
   - [ ] Force cleanup requires explicit confirmation
   - [ ] Parallel execution limits are enforced

3. **Integration Testing**
   - [ ] Discovery logic finds environments correctly
   - [ ] Cost optimization reporting works
   - [ ] Verification scripts validate cleanup
   - [ ] Notification system functions properly

4. **Error Handling**
   - [ ] Graceful handling of no environments
   - [ ] Proper error reporting for failed cleanups
   - [ ] Non-critical failures don't block workflow
   - [ ] Comprehensive logging for troubleshooting

### Post-Deployment Monitoring

1. **First Week**
   - Monitor all scheduled runs for successful completion
   - Verify cost savings are being tracked accurately
   - Check that notifications are working correctly
   - Ensure no interference with active development

2. **Ongoing**
   - Weekly review of cleanup effectiveness
   - Monthly cost optimization reports
   - Quarterly review of age limits and schedules
   - Annual review of notification preferences

## Troubleshooting Guide

### Common Issues

1. **Discovery Script Fails**

   ```bash
   # Check AWS credentials and permissions
   aws sts get-caller-identity

   # Test discovery script manually
   cd infrastructure
   ./scripts/discover-preview-environments.sh --max-age 24 --verbose
   ```

2. **Cost Reporting Issues**

   ```bash
   # Check cost reporter functionality
   ./scripts/cost-optimization-reporter.sh --help

   # Test with mock data
   ./scripts/cost-optimization-reporter.sh --report-cleanup --environments-cleaned 0
   ```

3. **Notification Failures**

   ```bash
   # Verify secrets are configured
   # Check webhook URLs and email configurations
   # Test notifications manually
   ```

4. **Workflow Permissions Issues**

   ```bash
   # Verify GitHub Actions permissions
   # Check AWS role assumptions in workflow logs
   # Validate CloudFormation permissions
   ```

## Success Criteria

The scheduled cleanup workflow is considered successfully tested when:

- [ ] ✅ All scheduled runs complete successfully
- [ ] ✅ Dry run mode works correctly and is default
- [ ] ✅ Age-based filtering preserves active environments
- [ ] ✅ Cost optimization tracking provides accurate data
- [ ] ✅ Notifications work correctly when configured
- [ ] ✅ Error handling gracefully manages failures
- [ ] ✅ No interference with active development workflows
- [ ] ✅ Performance is acceptable for expected scale

## Next Steps

After successful testing:

1. Deploy workflow to production with initial dry run period
2. Monitor first week of scheduled runs closely
3. Gradually transition to live mode after validation
4. Implement regular cost optimization reporting
5. Fine-tune schedules and age limits based on usage patterns

## Automated Testing

Use the provided testing script for comprehensive validation:

```bash
cd infrastructure

# Run all tests
./scripts/test-scheduled-cleanup.sh --test-all --verbose

# Run specific test categories
./scripts/test-scheduled-cleanup.sh --test-syntax --test-safety-mechanisms

# Simulate complete workflow
./scripts/test-scheduled-cleanup.sh --simulate-workflow --dry-run
```

The automated testing script validates:

- Workflow YAML syntax and structure
- Environment discovery logic
- Safety mechanism configuration
- Cost optimization integration
- Error handling capabilities
- Complete workflow simulation
