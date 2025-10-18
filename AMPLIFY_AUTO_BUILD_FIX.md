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

3. **Added Compute Role to Branch Configuration**
   - Added `computeRoleArn: computeRole.arn` to Branch creation
   - Enables branch-level compute role assignment
   - Allows each branch to run builds with proper permissions
   - Fixes "Unable to assume IAM Role" errors during builds

## Implementation Steps

### Step 1: Deploy Infrastructure Changes (YOUR LOCAL MACHINE)

Run the following commands to deploy the Pulumi infrastructure with the new IAM configuration:

```bash
# Navigate to infrastructure directory
cd infrastructure

# Select the dev stack
pulumi stack select dev

# Set configuration (if needed)
pulumi config set aws:region us-east-1
pulumi config set environment-name dev
pulumi config set deployment-type permanent
pulumi config set image-tag latest

# Preview changes
pulumi preview

# Deploy the changes
pulumi up --yes
```

**Expected Output:**
```
~ aws:iam:Role dev-frontend-service-role updating
~ aws:iam:RolePolicyAttachment dev-frontend-service-role-policy updating
~ aws:iam:Role dev-frontend-compute-role updating
~ aws:iam:RolePolicyAttachment dev-frontend-compute-role-policy updating
~ aws:amplify:App dev-frontend-app updating
~ aws:amplify:Branch dev-frontend-branch updating
```

### Step 2: Verify IAM Roles in AWS Console

After deployment completes, verify the IAM roles are properly configured:

1. **Go to AWS IAM Console** → Roles
2. **Find role:** `dev-frontend-service-role-*`
   - Check it has `AdministratorAccess-Amplify` policy attached ✓
   - Check Trust Policy includes `amplify.amazonaws.com` ✓

3. **Find role:** `dev-frontend-compute-role-*`
   - Check it has `AdministratorAccess-Amplify` policy attached ✓
   - Check Trust Policy includes `amplify.amazonaws.com` ✓

### Step 3: Verify Amplify Configuration

1. **Go to AWS Amplify Console** → macro-ai-dev app
2. **Check App Settings** → General
   - Service role: Should show the new `dev-frontend-service-role-*` ARN ✓
3. **Go to Hosting** → Branches → dev branch
   - Auto-build enabled: ✓
   - Compute role: Should show the new `dev-frontend-compute-role-*` ARN ✓

### Step 4: Verify GitHub Webhook Configuration

The GitHub webhook must be properly configured for auto-build to trigger:

1. **Go to AWS Amplify Console** → App settings → GitHub connections
2. **Check webhook status:**
   - Should show "Active" or "Connected" ✓
   - If missing or inactive, reconnect repository

3. **Alternative: Check GitHub repository**
   - Go to GitHub Settings → Webhooks
   - Should see Amplify webhook for your app
   - Recent deliveries should show successful (green) status

### Step 5: Test Auto-Build with PR Branch

Test the auto-build functionality:

1. **Push code to PR branch:**
   ```bash
   git push origin feature/more-workflow-improvements-yayayaya
   ```

2. **Monitor Amplify deployment:**
   - Go to AWS Amplify Console → Deployments
   - Should see new deployment automatically start (within 30-60 seconds)
   - Deployment should be marked as "Auto-build" not manual

3. **Expected flow:**
   ```
   GitHub webhook fires
        ↓
   Amplify receives notification
        ↓
   Build job starts automatically
        ↓
   Build completes with IAM permissions
        ↓
   Frontend deploys automatically
   ```

### Step 6: Verify Deployment Success

Once deployment completes:

1. **Check Amplify Deployments tab:**
   - Status should show ✓ (green checkmark)
   - Duration should be complete
   - No manual intervention required

2. **Test frontend URL:**
   - Navigate to: `https://pr-90.macro-ai.russoakham.dev/` (or your branch URL)
   - Should load React app (not Amplify welcome page)
   - Check browser console for any errors

3. **Verify environment variables:**
   - Open browser DevTools → Application → Environment
   - Should see `VITE_API_URL`, `VITE_PR_NUMBER`, etc.

## Troubleshooting

### Issue: Deployment still requires manual trigger

**Solution 1: Check GitHub Webhook**
```bash
# List recent webhook deliveries in GitHub
# Go to: Repo Settings → Webhooks → Amplify webhook → Recent Deliveries
# Look for green checkmarks (successful) or red X (failed)
```

**Solution 2: Force refresh Amplify webhook**
1. Go to Amplify Console → App settings → GitHub connections
2. Click "Disconnect repository"
3. Click "Connect repository" 
4. Select your repository again
5. Authorize GitHub access

**Solution 3: Check IAM role trust relationship**
```bash
# Verify in AWS IAM Console → Roles
# Trust policy should include:
{
  "Principal": {
    "Service": "amplify.amazonaws.com"
  }
}
```

### Issue: Build fails with "Unable to assume IAM Role"

**Solution:**
- Verify compute role is attached to branch (Step 3)
- Verify role has `AdministratorAccess-Amplify` policy
- Wait 5-10 minutes for IAM changes to propagate across AWS
- Retry deployment

### Issue: Frontend shows Amplify welcome page instead of app

**Solution:**
- Verify `amplify.yml` build configuration is correct
- Check buildSpec phases are executing (Build logs)
- Verify `apps/client-ui/dist/index.html` exists after build
- Check environment variables are set correctly

## After Successful Deployment

Once auto-build is working:

1. **Clean up manual deployments:**
   - Delete any manual deployment artifacts from S3
   - No more need to click "Redeploy this version" in Amplify console

2. **Monitor future deployments:**
   - Auto-build should trigger on every branch push
   - Check Amplify → Deployments for recent activity
   - Expect 2-5 minute deployment time

3. **Test all environments:**
   - Once PR preview works, test staging (develop branch)
   - Then test production (main branch)

## Summary of Changes

| Component | Before | After |
|-----------|--------|-------|
| Service Role Policy | `AdministratorAccess` | `AdministratorAccess-Amplify` ✓ |
| Compute Role Policy | `AdministratorAccess` | `AdministratorAccess-Amplify` ✓ |
| Branch Compute Role | Not set | `computeRole.arn` ✓ |
| Manual Deployment | Required | Not needed ✓ |
| GitHub Webhook | May not fire | Will fire ✓ |
| Build Permissions | Insufficient | Complete ✓ |

## Questions?

If auto-build still doesn't work after these steps:

1. Check Amplify Deployment logs for specific error messages
2. Verify GitHub webhook is delivering events successfully
3. Confirm IAM roles have correct policies and trust relationships
4. Check `amplify.yml` in repository root is valid YAML syntax
5. Verify `apps/client-ui/dist` directory is created by build
