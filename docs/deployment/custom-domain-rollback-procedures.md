# Custom Domain Rollback Procedures

This document provides detailed procedures for rolling back custom domain functionality in case of issues.

## Overview

The custom domain implementation includes multiple rollback strategies depending on the severity and scope of issues:

1. **Emergency Rollback**: Immediate fallback to default URLs
2. **Partial Rollback**: Selective component rollback
3. **Complete Rollback**: Full removal of custom domain functionality
4. **Infrastructure Rollback**: CDK and AWS resource cleanup

## Emergency Rollback (Immediate)

Use this procedure for critical issues affecting production or when immediate fallback is required.

### Step 1: Disable Custom Domain Variables

**GitHub Repository Settings:**

1. Navigate to repository → Settings → Secrets and variables → Actions → Variables
2. Delete or rename these variables:
   - `CUSTOM_DOMAIN_NAME`
   - `HOSTED_ZONE_ID`

**Alternative - Comment Out Variables:**

```bash
# Temporarily disable by renaming
CUSTOM_DOMAIN_NAME_DISABLED=macro-ai.russoakham.dev
HOSTED_ZONE_ID_DISABLED=Z10081873B648ARROPNER
```

### Step 2: Trigger Redeployment

**For Active PRs:**

```bash
# Force redeployment by pushing empty commit
git commit --allow-empty -m "Emergency rollback: disable custom domains"
git push origin feature-branch
```

**For Multiple PRs:**

1. Close affected PRs
2. Reopen PRs to trigger fresh deployment
3. System automatically falls back to default URLs

### Step 3: Verify Fallback

**Check Frontend URLs:**

- Should use pattern: `https://{branch}.{app-id}.amplifyapp.com`
- Verify in GitHub Actions deployment logs
- Test application accessibility

**Check Backend URLs:**

- Should use CloudFormation stack outputs
- Verify API endpoints respond correctly
- Check CORS configuration works with default URLs

### Step 4: Communicate Status

```bash
# Example status update
echo "🚨 EMERGENCY ROLLBACK COMPLETE"
echo "✅ Custom domains disabled"
echo "✅ Applications using default URLs"
echo "✅ All services operational"
echo "📝 Investigation in progress"
```

## Partial Rollback (Selective)

Use this procedure to rollback specific components while maintaining others.

### Backend Only Rollback

**Disable Backend Custom Domain Support:**

1. **Update CORS Configuration**

   ```bash
   # Edit apps/express-api/src/utils/server.ts
   # Comment out custom domain logic
   ```

2. **Hardcode Development Origins**

   ```typescript
   // Temporary fallback configuration
   const corsOrigins = [
   	'http://localhost:3000',
   	'http://localhost:3040',
   	// Add specific Amplify URLs if known
   ]
   ```

3. **Redeploy Backend**

   ```bash
   cd infrastructure
   npx cdk deploy MacroAiPr-{number}Stack
   ```

### Frontend Only Rollback

**Disable Frontend Custom Domain:**

1. **Update Amplify Templates**

   ```bash
   # Edit apps/client-ui/amplify-templates/amplify.preview.yml
   # Remove custom domain references
   ```

2. **Hardcode API URLs**

   ```yaml
   # In amplify template
   environmentVariables:
     VITE_API_URL: 'https://api-gateway-url.execute-api.us-east-1.amazonaws.com/api'
   ```

3. **Redeploy Frontend**

   ```bash
   # Trigger Amplify redeployment
   git commit -am "Frontend rollback: disable custom domain"
   git push
   ```

### GitHub Actions Rollback

**Disable Workflow Custom Domain Logic:**

1. **Comment Out Custom Domain Steps**

   ```yaml
   # In .github/workflows/deploy-preview.yml
   # Comment out custom domain URL calculation
   # Use default Amplify URL patterns only
   ```

2. **Remove Environment Variables**

   ```yaml
   # Remove from workflow env section
   # CUSTOM_DOMAIN_NAME: ${{ vars.CUSTOM_DOMAIN_NAME }}
   # HOSTED_ZONE_ID: ${{ vars.HOSTED_ZONE_ID }}
   ```

## Complete Rollback (Full Removal)

Use this procedure to completely remove custom domain functionality.

### Step 1: Remove Environment Variables

**GitHub Repository:**

1. Delete `CUSTOM_DOMAIN_NAME` and `HOSTED_ZONE_ID` variables
2. Verify no other workflows reference these variables

### Step 2: Revert Code Changes

**Option A - Git Revert (Recommended):**

```bash
# Identify commit range for custom domain implementation
git log --oneline --grep="custom domain"

# Revert the commits (replace with actual commit hashes)
git revert abc123..def456

# Push reverted changes
git push origin main
```

**Option B - Manual Code Removal:**

1. **Remove Custom Domain Props from CDK**

   ```typescript
   // In infrastructure/src/stacks/macro-ai-preview-stack.ts
   // Remove customDomain prop and related logic
   ```

2. **Remove Backend Custom Domain Logic**

   ```typescript
   // In apps/express-api/src/utils/server.ts
   // Remove customDomainName logic, use hardcoded origins
   ```

3. **Remove Frontend Custom Domain Support**

   ```yaml
   # In amplify templates
   # Remove ${VITE_API_URL} references
   # Use hardcoded API URLs
   ```

4. **Remove GitHub Actions Custom Domain Logic**

   ```yaml
   # In .github/workflows/deploy-preview.yml
   # Remove custom domain URL calculation
   # Remove custom domain configuration steps
   ```

### Step 3: Clean Up Infrastructure

**Remove Amplify Domain Associations:**

```bash
# List existing domain associations
aws amplify list-domain-associations --app-id <app-id>

# Remove custom domain associations
aws amplify delete-domain-association \
  --app-id <app-id> \
  --domain-name pr-123.macro-ai.russoakham.dev
```

**Clean Up Route 53 Records (Optional):**

```bash
# List records in hosted zone
aws route53 list-resource-record-sets \
  --hosted-zone-id Z10081873B648ARROPNER

# Remove specific records if needed
# Note: Keep hosted zone for future use
```

### Step 4: Update Documentation

1. **Remove Custom Domain References**
   - Update deployment guides
   - Remove custom domain configuration steps
   - Update troubleshooting guides

2. **Archive Custom Domain Documentation**

   ```bash
   mkdir docs/archived/custom-domain-implementation
   mv docs/deployment/custom-domain-*.md docs/archived/custom-domain-implementation/
   ```

## Infrastructure Rollback (AWS Resources)

Use this procedure to clean up AWS resources related to custom domains.

### CDK Stack Rollback

**Remove Custom Domain from CDK:**

```bash
cd infrastructure

# Remove custom domain environment variables
unset CUSTOM_DOMAIN_NAME
unset HOSTED_ZONE_ID

# Deploy stack without custom domain
npx cdk deploy MacroAiPr-{number}Stack

# Verify stack deployment
aws cloudformation describe-stacks \
  --stack-name MacroAiPr-{number}Stack
```

### Amplify Resource Cleanup

**Remove Domain Associations:**

```bash
# Get all Amplify apps
aws amplify list-apps

# For each app with custom domains
aws amplify list-domain-associations --app-id <app-id>

# Remove domain associations
aws amplify delete-domain-association \
  --app-id <app-id> \
  --domain-name <custom-domain>
```

### Certificate Cleanup

**Check Certificate Usage:**

```bash
# List certificates
aws acm list-certificates --region us-east-1

# Check certificate details
aws acm describe-certificate \
  --certificate-arn <certificate-arn>

# Note: Don't delete certificates that might be in use
# ACM certificates are free and can be left for future use
```

## Verification Procedures

### Post-Rollback Verification

**1. Application Functionality**

```bash
# Test frontend accessibility
curl -I https://{branch}.{app-id}.amplifyapp.com

# Test backend API
curl -I https://{api-gateway-url}/api/health

# Test CORS functionality
curl -H "Origin: https://{frontend-url}" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS https://{backend-url}/api/health
```

**2. DNS Resolution**

```bash
# Verify custom domains no longer resolve (if completely removed)
dig pr-123.macro-ai.russoakham.dev

# Should return NXDOMAIN or no records
```

**3. SSL Certificate Status**

```bash
# Check if certificates are still in use
aws acm list-certificates --region us-east-1 \
  --query 'CertificateSummaryList[?DomainName==`pr-123.macro-ai.russoakham.dev`]'
```

**4. Application Integration**

- Test complete user workflows
- Verify authentication flows
- Check API functionality
- Validate frontend-backend communication

## Rollback Decision Matrix

| Issue Severity        | Scope              | Recommended Rollback    | Complexity |
| --------------------- | ------------------ | ----------------------- | ---------- |
| Critical Production   | All environments   | Emergency Rollback      | Low        |
| Major Functionality   | Single component   | Partial Rollback        | Medium     |
| Performance Issues    | Specific feature   | Partial Rollback        | Medium     |
| Security Concerns     | All custom domains | Complete Rollback       | High       |
| Infrastructure Issues | AWS resources      | Infrastructure Rollback | Medium     |

## Communication Templates

### Emergency Rollback Notification

```text
🚨 EMERGENCY ROLLBACK - Custom Domains Disabled

ISSUE: [Brief description of the issue]
ACTION: Custom domain functionality has been disabled
STATUS: All applications now using default URLs
IMPACT: No user-facing functionality affected
ETA: Investigating root cause, updates in 30 minutes

Default URLs:
- Frontend: https://{branch}.{app-id}.amplifyapp.com
- Backend: https://{api-gateway-url}/api
```

### Rollback Completion Notification

```text
✅ ROLLBACK COMPLETE - Custom Domains

SUMMARY: Custom domain rollback completed successfully
VERIFICATION: All applications tested and operational
NEXT STEPS: [Root cause analysis/fix timeline]

If you experience any issues, please report immediately.
```

## Prevention Strategies

### Pre-Deployment Testing

- Test custom domain configuration in isolated environment
- Verify rollback procedures work correctly
- Validate monitoring and alerting systems

### Monitoring and Alerting

- Set up alerts for DNS resolution failures
- Monitor SSL certificate status
- Track application performance metrics
- Alert on custom domain configuration failures

### Documentation Maintenance

- Keep rollback procedures updated
- Test rollback procedures regularly
- Document lessons learned from incidents
- Maintain emergency contact information

## Recovery Procedures

### After Successful Rollback

1. **Root Cause Analysis**
   - Identify the cause of the issue
   - Document findings and lessons learned
   - Update procedures based on learnings

2. **Fix Development**
   - Develop fix for the identified issue
   - Test fix in isolated environment
   - Validate fix doesn't introduce new issues

3. **Gradual Re-deployment**
   - Re-enable custom domains in test environment
   - Gradually roll out to preview environments
   - Monitor closely for any issues

4. **Documentation Updates**
   - Update rollback procedures if needed
   - Document new monitoring requirements
   - Share learnings with team

This comprehensive rollback strategy ensures that custom domain issues can be quickly resolved with minimal
impact to users and development workflows.
