# Custom Domain Testing Guide

This guide provides comprehensive testing procedures for the custom domain implementation for preview environments.

## Overview

The custom domain feature enables preview environments to use custom subdomains like
`pr-123.macro-ai.russoakham.dev` instead of default Amplify URLs.

## Prerequisites

### Required Environment Variables

Set these in your GitHub repository variables:

```bash
CUSTOM_DOMAIN_NAME=macro-ai.russoakham.dev
HOSTED_ZONE_ID=Z10081873B648ARROPNER
```

### DNS Configuration

1. **Domain purchased and configured** with domain registrar
2. **Route 53 hosted zone** created and nameservers updated
3. **DNS propagation** completed (verify with `dig` or `nslookup`)

## Testing Scenarios

### 1. Basic Custom Domain Functionality

#### Test Case: Deploy Preview with Custom Domain

**Steps:**

1. Create a new PR with changes to trigger preview deployment
2. Verify environment variables are set in GitHub repository
3. Monitor GitHub Actions workflow execution
4. Check deployment logs for custom domain configuration

**Expected Results:**

- ✅ Frontend URL uses custom domain pattern: `https://pr-{number}.macro-ai.russoakham.dev`
- ✅ Backend URL uses custom domain pattern: `https://pr-{number}-api.macro-ai.russoakham.dev`
- ✅ SSL certificates are automatically created
- ✅ CORS configuration includes custom domain origins

**Verification Commands:**

```bash
# Check DNS resolution
dig pr-123.macro-ai.russoakham.dev
dig pr-123-api.macro-ai.russoakham.dev

# Test SSL certificate
curl -I https://pr-123.macro-ai.russoakham.dev
curl -I https://pr-123-api.macro-ai.russoakham.dev/api/health

# Verify CORS headers
curl -H "Origin: https://pr-123.macro-ai.russoakham.dev" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS https://pr-123-api.macro-ai.russoakham.dev/api/health
```

### 2. Fallback Behavior Testing

#### Test Case: Deploy Without Custom Domain Variables

**Steps:**

1. Temporarily remove `CUSTOM_DOMAIN_NAME` and `HOSTED_ZONE_ID` variables
2. Create a new PR to trigger deployment
3. Monitor deployment process

**Expected Results:**

- ✅ Deployment succeeds using default Amplify URLs
- ✅ Frontend URL: `https://{branch}.{app-id}.amplifyapp.com`
- ✅ Backend URL: CloudFormation stack output
- ✅ No custom domain configuration attempted

### 3. Error Handling Testing

#### Test Case: Invalid Custom Domain Configuration

**Steps:**

1. Set invalid `HOSTED_ZONE_ID` (e.g., `Z1234567890INVALID`)
2. Create a PR to trigger deployment
3. Monitor deployment logs

**Expected Results:**

- ✅ Custom domain configuration fails gracefully
- ✅ Deployment falls back to default Amplify URL
- ✅ Clear error messages in logs
- ✅ Overall deployment still succeeds

### 4. SSL Certificate Verification

#### Test Case: SSL Certificate Creation and Validation

**Steps:**

1. Deploy with custom domain configuration
2. Wait for SSL certificate verification (may take 5-10 minutes)
3. Test HTTPS connectivity

**Expected Results:**

- ✅ SSL certificate is automatically created via ACM
- ✅ Certificate covers the custom subdomain
- ✅ HTTPS connections work without warnings
- ✅ Certificate is valid and trusted

**Verification:**

```bash
# Check SSL certificate details
openssl s_client -connect pr-123.macro-ai.russoakham.dev:443 -servername pr-123.macro-ai.russoakham.dev < /dev/null 2>/dev/null | openssl x509 -text -noout

# Verify certificate chain
curl -vI https://pr-123.macro-ai.russoakham.dev 2>&1 | grep -E "(SSL|TLS|certificate)"
```

### 5. CORS Configuration Testing

#### Test Case: Cross-Origin Requests

**Steps:**

1. Deploy preview environment with custom domain
2. Test CORS from frontend to backend
3. Verify preflight requests work correctly

**Expected Results:**

- ✅ Frontend can make API requests to custom domain backend
- ✅ CORS headers include custom domain origins
- ✅ Preflight OPTIONS requests succeed
- ✅ Authentication cookies work across custom domains

### 6. End-to-End Application Testing

#### Test Case: Full Application Functionality

**Steps:**

1. Deploy preview environment with custom domain
2. Navigate to custom domain frontend URL
3. Test complete user workflows

**Expected Results:**

- ✅ Application loads correctly on custom domain
- ✅ Authentication flows work
- ✅ API requests succeed
- ✅ Real-time features function properly
- ✅ No mixed content warnings

## Manual Testing Checklist

### Pre-Deployment Verification

- [ ] GitHub repository variables are set correctly
- [ ] DNS configuration is complete and propagated
- [ ] Route 53 hosted zone is accessible
- [ ] AWS permissions are configured for Amplify and Route 53

### During Deployment

- [ ] GitHub Actions workflow starts successfully
- [ ] Backend deployment completes with custom domain support
- [ ] Frontend deployment completes successfully
- [ ] Custom domain configuration script executes
- [ ] SSL certificate creation is initiated

### Post-Deployment Verification

- [ ] Custom domain URLs are accessible
- [ ] SSL certificates are valid and trusted
- [ ] DNS resolution works correctly
- [ ] CORS configuration allows cross-origin requests
- [ ] Application functionality is complete
- [ ] Performance is acceptable

## Troubleshooting Common Issues

### Issue: DNS Resolution Fails

**Symptoms:**

- Custom domain URLs return DNS errors
- `dig` commands fail to resolve

**Solutions:**

1. Verify Route 53 hosted zone configuration
2. Check nameserver propagation with domain registrar
3. Wait for DNS propagation (up to 48 hours)
4. Verify `HOSTED_ZONE_ID` is correct

### Issue: SSL Certificate Not Created

**Symptoms:**

- HTTPS connections fail with certificate errors
- ACM shows no certificates for the domain

**Solutions:**

1. Check Amplify domain association status
2. Verify DNS validation records are created
3. Wait for certificate validation (5-10 minutes)
4. Check AWS permissions for ACM

### Issue: CORS Errors

**Symptoms:**

- Frontend cannot connect to backend API
- Browser console shows CORS errors

**Solutions:**

1. Verify `CUSTOM_DOMAIN_NAME` environment variable is set
2. Check backend CORS configuration includes custom domains
3. Restart backend service to pick up new configuration
4. Verify API endpoints are accessible

### Issue: Custom Domain Configuration Fails

**Symptoms:**

- Deployment falls back to default URLs
- Custom domain script reports errors

**Solutions:**

1. Check AWS permissions for Amplify domain management
2. Verify Route 53 hosted zone permissions
3. Check domain association limits in Amplify
4. Review script logs for specific error messages

## Performance Testing

### Load Testing Custom Domains

```bash
# Test frontend performance
curl -w "@curl-format.txt" -o /dev/null -s https://pr-123.macro-ai.russoakham.dev

# Test backend API performance
curl -w "@curl-format.txt" -o /dev/null -s https://pr-123-api.macro-ai.russoakham.dev/api/health

# Test with multiple concurrent requests
ab -n 100 -c 10 https://pr-123.macro-ai.russoakham.dev/
ab -n 100 -c 10 https://pr-123-api.macro-ai.russoakham.dev/api/health
```

### Monitoring and Metrics

- Monitor CloudWatch metrics for Amplify and API Gateway
- Check Route 53 query metrics
- Monitor SSL certificate status in ACM
- Track deployment times with custom domain configuration

## Security Testing

### SSL/TLS Configuration

```bash
# Test SSL configuration
testssl.sh https://pr-123.macro-ai.russoakham.dev
testssl.sh https://pr-123-api.macro-ai.russoakham.dev

# Check for security headers
curl -I https://pr-123.macro-ai.russoakham.dev | grep -E "(Strict-Transport-Security|Content-Security-Policy|X-Frame-Options)"
```

### Domain Security

- Verify subdomain isolation
- Test for subdomain takeover vulnerabilities
- Check certificate transparency logs
- Validate DNSSEC if configured

## Cleanup Testing

### Test Environment Cleanup

**Steps:**

1. Close/merge the PR
2. Verify cleanup workflow runs
3. Check that custom domain associations are removed
4. Confirm DNS records are cleaned up

**Expected Results:**

- ✅ Amplify domain associations are removed
- ✅ SSL certificates are cleaned up (if not shared)
- ✅ DNS records are removed from Route 53
- ✅ No orphaned resources remain

## Automated Testing Integration

### CI/CD Pipeline Tests

Add these tests to your CI/CD pipeline:

```yaml
- name: Test Custom Domain Resolution
  run: |
    if [[ -n "$CUSTOM_DOMAIN_NAME" ]]; then
      # Wait for DNS propagation
      sleep 30
      
      # Test DNS resolution
      dig +short pr-${{ github.event.pull_request.number }}.$CUSTOM_DOMAIN_NAME
      
      # Test HTTPS connectivity
      curl -f https://pr-${{ github.event.pull_request.number }}.$CUSTOM_DOMAIN_NAME/health
    fi
```

### Health Check Endpoints

Implement health checks that verify:

- Custom domain accessibility
- SSL certificate validity
- CORS configuration
- Backend API connectivity

## Success Criteria

A successful custom domain implementation should meet these criteria:

1. **Functionality**: All application features work on custom domains
2. **Security**: SSL certificates are valid and security headers are present
3. **Performance**: Response times are comparable to default URLs
4. **Reliability**: Deployments succeed consistently with custom domains
5. **Fallback**: System gracefully handles custom domain failures
6. **Cleanup**: Resources are properly cleaned up when environments are destroyed

## Reporting Issues

When reporting custom domain issues, include:

1. **Environment Details**: PR number, branch name, deployment timestamp
2. **Configuration**: Environment variables and DNS settings
3. **Error Messages**: Complete error logs from GitHub Actions
4. **Network Tests**: Results of DNS and connectivity tests
5. **Browser Information**: Console errors and network tab details

This comprehensive testing approach ensures the custom domain feature works reliably across all scenarios and environments.
