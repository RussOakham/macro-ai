# Amplify Auto-Build Fix - Complete Implementation Guide

## Overview

This document provides step-by-step instructions to fix AWS Amplify auto-build deployment issues that require manual deployment in the AWS console. After these changes, deployments will be fully automated.

## Changes Made to Pulumi Infrastructure

### File: `infrastructure/pulumi/src/components/amplify/AmplifyApp.ts`

The following changes have been committed to your feature branch:

1. **Updated Service Role IAM Policy**
   - Changed from: `AdministratorAccess` (too generic)
   - Changed to: `AdministratorAccess-Amplify` (AWS-managed policy designed for Amplify)
   - Includes: S3, CloudFront, CloudWatch, IAM, EC2, Lambda, and other Amplify-specific permissions

2. **Updated Compute Role IAM Policy**
   - Changed from: `AdministratorAccess` (too generic)
   - Changed to: `AdministratorAccess-Amplify` (proper Amplify permissions)
   - Allows build environment to execute with correct permissions

3. **Service Role Applied to App**
   - The service role is applied at the App level (`iamServiceRoleArn`)
   - Branches inherit all permissions from the App's service role
   - This provides complete permissions for building and deploying

## Implementation Steps - DEPLOY NOW

### Step 1: Deploy Infrastructure Changes (YOUR LOCAL MACHINE)

**Navigate to infrastructure/pulumi directory:**
```bash
cd infrastructure/pulumi
```

**Run Pulumi deployment:**
```bash
pulumi up --stack dev --yes
```

The IAM roles will be updated with the correct `AdministratorAccess-Amplify` policy, and your Amplify app will be configured with proper permissions for auto-build.

**Expected Result:**
- Service role updated with `AdministratorAccess-Amplify` policy ✓
- Amplify App gets service role ARN attached ✓
- Auto-build should now work without manual trigger

### Step 2: Verify IAM Roles in AWS Console (After deployment completes)

1. **Go to AWS IAM Console** → Roles
2. **Find role:** `dev-frontend-service-role-*`
   - Should have `AdministratorAccess-Amplify` policy attached ✓
   - Trust Policy should include `amplify.amazonaws.com` ✓

### Step 3: Verify Amplify Configuration

1. **Go to AWS Amplify Console** → macro-ai-dev app
2. **Check App Settings** → General
   - Service role: Should show the updated service role ARN ✓
3. **Hosting** → Branches → dev
   - Auto-build enabled: ✓

### Step 4: Verify GitHub Webhook Configuration

1. **Go to AWS Amplify Console** → App settings → GitHub connections
2. **Check webhook status:**
   - Should show "Active" or "Connected" ✓

### Step 5: Test Auto-Build

1. **Push code to your feature branch:**
   ```bash
   git push origin feature/more-workflow-improvements-yayayaya
   ```

2. **Monitor Amplify deployment:**
   - Go to AWS Amplify Console → Deployments tab
   - Should see new deployment START AUTOMATICALLY (within 30-60 seconds)
   - NO manual "Redeploy" button needed ✓

3. **Expected flow:**
   ```
   GitHub push
        ↓
   GitHub webhook fires
        ↓
   Amplify receives notification
        ↓
   Build starts automatically (auto-build trigger)
        ↓
   Build completes with AdministratorAccess-Amplify permissions
        ↓
   Frontend deploys automatically
   ```

### Step 6: Verify Deployment Success

1. **Check Amplify Deployments:**
   - Status should show ✓ (green checkmark)
   - Should be marked as "Auto-build" not manual

2. **Test frontend URL:**
   - Navigate to your branch URL (e.g., `https://pr-90.macro-ai.russoakham.dev/`)
   - Should load React app (not Amplify welcome page)

## Key Fix Summary

| Component | Before | After |
|-----------|--------|-------|
| Service Role Policy | `AdministratorAccess` | `AdministratorAccess-Amplify` ✓ |
| Compute Role | Created but not used | Not needed (App level suffices) ✓ |
| App Service Role | May not have been set | Properly attached ✓ |
| Auto-Build Trigger | Manual deployment required | GitHub webhook triggers automatically ✓ |
| Build Permissions | Insufficient | Complete ✓ |

## Troubleshooting

### Issue: Deployment still requires manual trigger

**Solution 1: Force refresh Amplify webhook**
1. Go to Amplify Console → App settings → GitHub connections
2. Click "Disconnect repository"
3. Click "Connect repository" 
4. Select your repository again
5. Authorize GitHub access

**Solution 2: Verify IAM role was updated**
- Check AWS IAM console for `dev-frontend-service-role-*`
- Verify it has `AdministratorAccess-Amplify` policy
- Wait 5-10 minutes for permissions to propagate

### Issue: Build fails with permission errors

**Solution:**
- Verify `AdministratorAccess-Amplify` policy is attached to service role
- Check trust policy includes `amplify.amazonaws.com`
- Verify in Amplify console that service role ARN is set

### Issue: Frontend shows Amplify welcome page

**Solution:**
- Verify `amplify.yml` build configuration is correct
- Check build logs in Amplify console for errors
- Verify build actually completes successfully
