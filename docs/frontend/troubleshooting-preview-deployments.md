# Troubleshooting Frontend Preview Deployments

Comprehensive troubleshooting guide for the frontend preview deployment system.

## 🚨 Quick Diagnosis

### Deployment Status Check

**Step 1: Check GitHub Actions**

1. Go to your repository's **Actions** tab
2. Find the "Deploy Frontend Preview" workflow run
3. Look for red ❌ (failed), yellow 🟡 (in progress), or green ✅ (success)

**Step 2: Check PR Comments**

1. Look for automated comments on your PR
2. Check for error messages or status updates
3. Note any warning messages about backend discovery

**Step 3: Check Preview URL**

1. Try accessing the preview URL from the PR comment
2. Check browser developer tools for console errors
3. Test API calls and network requests

## 🔧 Common Issues and Solutions

### 1. Deployment Workflow Failures

#### Issue: "Deploy Frontend Preview" Workflow Fails

**Symptoms**:

- Red ❌ on the workflow check
- Error messages in GitHub Actions logs
- No preview URL generated

**Diagnosis Steps**:

```bash
# Check the workflow logs in GitHub Actions
# Look for specific error messages in these steps:
# - Validate Access
# - Discover Backend Environment
# - Generate Environment Configuration
# - Build React Application
# - Deploy to Amplify
```

**Common Causes & Solutions**:

**A. Access Validation Failure**

```text
Error: PR author does not have write access
```

**Solution**: Ensure you have write access to the repository or ask a maintainer to trigger the deployment.

**B. AWS Credentials Issue**

```text
Error: Unable to locate credentials
```

**Solution**:

- Check that AWS IAM role is properly configured
- Verify OIDC trust relationship is set up correctly
- Ensure `AWS_ROLE_ARN` secret is configured

**C. Build Failure**

```text
Error: Build failed with exit code 1
```

**Solution**:

```bash
# Test build locally first
cd apps/client-ui
pnpm install
pnpm type-check  # Check for TypeScript errors
pnpm lint        # Check for linting errors
pnpm build       # Test the build process
```

**D. Amplify Deployment Failure**

```text
Error: Failed to create Amplify app
```

**Solution**:

- Check AWS Amplify service limits
- Verify IAM permissions for Amplify operations
- Check for naming conflicts with existing apps

### 2. Backend Discovery Issues

#### Issue: Backend Not Found, Using Fallback

**Symptoms**:

- Warning message: "No backend found - will use fallback API URL"
- API calls may fail or return unexpected data
- Preview works but with limited functionality

**Diagnosis Steps**:

```bash
# Test backend discovery locally
cd apps/client-ui
./scripts/backend-discovery-service.sh discover pr-123 --pr-number 123 --debug

# Check for available backend stacks
./scripts/backend-discovery-service.sh list-stacks
```

**Common Causes & Solutions**:

**A. Backend Stack Doesn't Exist**

```text
No CloudFormation stack found for PR 123
```

**Solution**:

- Deploy the backend for your PR first
- Use the full-stack deployment workflow
- Or continue with fallback API for frontend-only changes

**B. Backend Stack in Wrong State**

```text
Stack exists but status is CREATE_IN_PROGRESS
```

**Solution**: Wait for backend deployment to complete before deploying frontend.

**C. Stack Naming Mismatch**

```text
Expected MacroAiPr123Stack but found MacroAi-PR-123-Stack
```

**Solution**: Update the stack naming patterns in `env-mapping.json` or ensure consistent naming.

### 3. Environment Variable Issues

#### Issue: API Calls Failing in Preview

**Symptoms**:

- Frontend loads but API calls return 404 or CORS errors
- Console errors about failed network requests
- Authentication failures

**Diagnosis Steps**:

```bash
# Check the build info endpoint
curl https://pr123.d1234567890.amplifyapp.com/build-info.json

# Test API endpoint directly
curl https://api-pr123.example.com/api/health

# Check environment variables in deployment logs
# Look for "Environment Configuration Summary" section
```

**Common Causes & Solutions**:

**A. Wrong API Endpoint**

```json
{
	"api_url": "https://api-development.macro-ai.com/api",
	"resolution_method": "fallback_url"
}
```

**Solution**:

- Verify backend stack exists and is accessible
- Check CloudFormation stack outputs for correct API endpoint
- Manually override API endpoint if needed

**B. Missing API Key**

```text
Error: API key not configured
```

**Solution**:

- Verify `FRONTEND_API_KEY` secret is configured in repository
- Check that the secret value is correct and not expired
- Ensure the API key has appropriate permissions

**C. CORS Issues**

```text
Access to fetch at 'https://api.example.com' from origin 'https://pr123.amplifyapp.com' has been blocked by CORS policy
```

**Solution**:

- Ensure backend CORS configuration includes preview domains
- Check if backend allows `*.amplifyapp.com` origins
- Verify API endpoint is accessible from browser

### 4. Preview URL Issues

#### Issue: Preview URL Returns 404 or Blank Page

**Symptoms**:

- Preview URL shows "Page Not Found" or blank page
- Browser developer tools show 404 errors
- Preview worked before but now broken

**Diagnosis Steps**:

```bash
# Check if Amplify app exists
aws amplify list-apps --query 'apps[?contains(name, `pr-123`)]'

# Check deployment status
aws amplify list-jobs --app-id YOUR_APP_ID --branch-name main

# Test different paths
curl -I https://pr123.d1234567890.amplifyapp.com/
curl -I https://pr123.d1234567890.amplifyapp.com/index.html
```

**Common Causes & Solutions**:

**A. DNS Propagation Delay**

```text
DNS resolution failed for pr123.d1234567890.amplifyapp.com
```

**Solution**: Wait 5-10 minutes for DNS propagation, then try again.

**B. Amplify App Deleted**

```text
App not found or has been deleted
```

**Solution**:

- Check if someone manually deleted the app
- Redeploy using the manual workflow
- Check cleanup workflows for premature deletion

**C. Build Artifacts Missing**

```text
Index.html not found in deployment
```

**Solution**:

- Check build logs for successful completion
- Verify `dist` directory is created and contains files
- Check Amplify configuration for correct `baseDirectory`

### 5. Performance Issues

#### Issue: Slow Preview Loading

**Symptoms**:

- Preview takes a long time to load
- Large bundle sizes
- Poor performance metrics

**Diagnosis Steps**:

```bash
# Check bundle size
cd apps/client-ui
pnpm build
du -sh dist/

# Analyze bundle
pnpm build:analyze  # if available

# Check network tab in browser developer tools
```

**Solutions**:

- Enable code splitting and lazy loading
- Optimize images and assets
- Check for unnecessary dependencies
- Use production build optimizations

### 6. Cache Issues

#### Issue: Old Content Showing in Preview

**Symptoms**:

- Preview shows old version despite new deployment
- Changes not reflected in preview
- Stale API responses

**Solutions**:

**A. Browser Cache**

```bash
# Hard refresh
Ctrl+F5 (Windows/Linux) or Cmd+Shift+R (Mac)

# Clear browser cache
# Or use incognito/private browsing mode
```

**B. CDN Cache**

```bash
# Check cache headers
curl -I https://pr123.d1234567890.amplifyapp.com/

# Wait for cache TTL to expire (usually 5-15 minutes)
```

**C. Build Cache**

```bash
# Force rebuild without cache
# Use manual workflow with "force-rebuild: true"
```

## 🔍 Debugging Tools and Commands

### Local Testing Scripts

```bash
# Test complete integration
cd apps/client-ui
./scripts/test-backend-integration.sh

# Test backend discovery
./scripts/backend-discovery-service.sh discover pr-123 --pr-number 123 --debug

# Test API resolution
./scripts/api-resolution-service.sh --environment pr-123 --pr-number 123 --debug

# Test environment generation
./scripts/inject-preview-env.sh --environment pr-123 --pr-number 123 --debug

# Validate Amplify configuration
./scripts/validate-amplify-config.sh --config-file amplify.yml --environment preview
```

### AWS CLI Commands

```bash
# List Amplify apps
aws amplify list-apps --query 'apps[?contains(name, `macro-ai-frontend`)]'

# Check CloudFormation stacks
aws cloudformation list-stacks --query 'StackSummaries[?contains(StackName, `MacroAi`)]'

# Get stack outputs
aws cloudformation describe-stacks --stack-name MacroAiPr123Stack --query 'Stacks[0].Outputs'

# Check Amplify deployment status
aws amplify get-app --app-id YOUR_APP_ID
```

### GitHub CLI Commands

```bash
# Check workflow runs
gh run list --workflow="Deploy Frontend Preview"

# View workflow logs
gh run view RUN_ID --log

# Trigger manual deployment
gh workflow run "Deploy Frontend Preview" --ref feature/my-branch
```

## 📊 Monitoring and Alerts

### Key Metrics to Monitor

1. **Deployment Success Rate**
   - Target: >95% success rate
   - Alert if <90% over 24 hours

2. **Deployment Duration**
   - Target: <10 minutes end-to-end
   - Alert if >15 minutes consistently

3. **Backend Discovery Rate**
   - Target: >80% successful discovery
   - Alert if <70% over 24 hours

4. **API Response Times**
   - Target: <500ms for health checks
   - Alert if >2 seconds consistently

### Setting Up Alerts

**GitHub Actions Notifications**:

- Enable email notifications for workflow failures
- Set up Slack integration for team notifications
- Configure status checks for PR protection

**AWS CloudWatch Alarms**:

- Monitor Amplify deployment failures
- Track API Gateway error rates
- Alert on CloudFormation stack failures

## 🆘 Getting Help

### Self-Service Resources

1. **Documentation**
   - [Getting Started Guide](./getting-started-preview-deployments.md)
   - [User Manual](./preview-deployment-user-manual.md)
   - [Configuration Reference](./preview-deployment-configuration.md)

2. **Logs and Debugging**
   - GitHub Actions logs
   - AWS Amplify console
   - Browser developer tools

3. **Testing Tools**
   - Local integration tests
   - Backend discovery scripts
   - Environment validation tools

### Escalation Process

**Level 1: Self-Diagnosis**

- Check this troubleshooting guide
- Run local testing scripts
- Review deployment logs

**Level 2: Team Support**

- Comment on your PR with issue description
- Include relevant error messages and logs
- Tag team members familiar with the system

**Level 3: System Issues**

- Create repository issue for system-wide problems
- Include steps to reproduce
- Attach logs, screenshots, and configuration details

### Emergency Procedures

**Critical System Failure**:

1. Check AWS service status
2. Verify GitHub Actions status
3. Test manual deployment workflows
4. Escalate to DevOps team if needed

**Security Issues**:

1. Immediately report security concerns
2. Do not share sensitive information in public issues
3. Contact maintainers directly for security issues

## 📋 Troubleshooting Checklist

### Before Reporting Issues

- [ ] Checked GitHub Actions logs for specific errors
- [ ] Verified local build works (`pnpm build`)
- [ ] Tested with hard browser refresh
- [ ] Checked AWS service status
- [ ] Reviewed recent changes that might affect deployment
- [ ] Tried manual deployment workflow
- [ ] Checked similar issues in repository

### Information to Include When Reporting

- [ ] PR number and branch name
- [ ] Error messages from GitHub Actions logs
- [ ] Screenshots of issues
- [ ] Browser and version
- [ ] Steps to reproduce the problem
- [ ] Expected vs actual behavior
- [ ] Relevant configuration changes

## 🔄 Recovery Procedures

### Recovering from Failed Deployment

1. **Identify Root Cause**
   - Review error logs
   - Check system dependencies
   - Verify configuration

2. **Fix Issues**
   - Address code/configuration problems
   - Update secrets if needed
   - Resolve AWS resource issues

3. **Redeploy**
   - Push new commit to trigger automatic deployment
   - Or use manual workflow trigger
   - Monitor deployment progress

4. **Verify Recovery**
   - Test preview URL functionality
   - Verify API integration
   - Check performance metrics

### Disaster Recovery

**Complete System Failure**:

1. Assess scope of failure
2. Implement emergency fixes
3. Communicate with team
4. Document lessons learned
5. Improve system resilience

**Data Loss Prevention**:

- Regular backups of configuration
- Version control for all code
- Infrastructure as Code for reproducibility
- Monitoring and alerting for early detection
