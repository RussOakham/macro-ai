# Frontend-Backend Integration Guide

This guide covers the complete integration between the AWS Amplify-hosted React frontend and the AWS Lambda-based backend API.

## 🎯 Architecture Overview

```text
Users ──► AWS Amplify ──► React UI (CloudFront CDN)
   │           │
   │           └──► API Gateway ──► Lambda Function ──► Parameter Store
   │                    │                │                    │
   │                    │                └──► Neon Database   │
   │                    │                                     │
   │                    └──► Cognito ◄─────────────────────────┘
```

## 🚀 Complete Deployment Process

### Phase 1: Backend Deployment (Already Complete)

✅ **Infrastructure deployed** with:

- Lambda function with Express API
- API Gateway with CORS and authentication
- Parameter Store with secrets management
- IAM roles and permissions

### Phase 2: Frontend Deployment (Current)

#### Step 1: Deploy to AWS Amplify

```bash
cd apps/client-ui
pnpm deploy:amplify
```

This will:

- Initialize Amplify project
- Configure CloudFront + S3 hosting
- Build and deploy React application
- Provide Amplify URL (e.g., `https://main.d1234567890.amplifyapp.com`)

#### Step 2: Update API Gateway CORS

```bash
# Get your Amplify URL from deployment output
./scripts/update-api-cors.sh
```

This will:

- Generate CORS configuration patch
- Provide instructions to update infrastructure
- Enable cross-origin requests from Amplify domain

#### Step 3: Update Infrastructure CORS Settings

```bash
cd ../../infrastructure
# Apply the generated patch or manually update
git apply ../apps/client-ui/cors-update.patch
pnpm deploy
```

#### Step 4: Configure Environment Variables

Update Amplify environment variables in AWS Console:

```bash
# Production Environment Variables
VITE_API_URL=https://your-api-gateway-url.amazonaws.com/hobby/api
VITE_API_KEY=your-production-api-key-32-characters
VITE_APP_ENV=production
```

## 🔧 Environment Configuration

### API URL Configuration

The frontend needs to connect to the deployed Lambda API. Get the API Gateway URL:

```bash
# From infrastructure directory
aws cloudformation describe-stacks \
  --stack-name MacroAiHobbyStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text
```

### Environment Variables Setup

#### Development (.env.local)

```bash
VITE_API_URL=http://localhost:3040/api
VITE_API_KEY=your-development-api-key
VITE_APP_ENV=development
```

#### Production (Amplify Console)

```bash
VITE_API_URL=https://abcd1234.execute-api.us-east-1.amazonaws.com/hobby/api
VITE_API_KEY=your-production-api-key
VITE_APP_ENV=production
```

## 🔐 Authentication Integration

### Cognito Configuration

The frontend uses AWS Cognito for authentication. Ensure these parameters are set in Parameter Store:

```bash
# Required Cognito parameters
/macro-ai/hobby/standard/cognito-user-pool-id
/macro-ai/hobby/standard/cognito-user-pool-client-id
```

### Frontend Authentication Flow

1. **User Registration/Login**: Frontend → Cognito
2. **Token Validation**: Frontend → Lambda (via API Gateway)
3. **API Requests**: Frontend → API Gateway → Lambda (with JWT)

## 🌐 CORS Configuration

### Current CORS Settings

The API Gateway is configured with CORS for:

- `http://localhost:3000` (development)
- `https://localhost:3000` (development SSL)

### Adding Amplify Domain

Update `infrastructure/src/constructs/api-gateway-construct.ts`:

```typescript
allowOrigins: [
  'http://localhost:3000',
  'https://localhost:3000',
  'https://main.d1234567890.amplifyapp.com', // Your Amplify URL
],
```

## 🧪 Testing Integration

### Step 1: Health Check

```bash
# Test API Gateway health endpoint
curl https://your-api-gateway-url.amazonaws.com/hobby/api/health

# Expected response:
{
  "message": "Api Health Status: OK"
}
```

### Step 2: CORS Validation

```bash
# Test CORS preflight request
curl -H "Origin: https://your-amplify-url.amplifyapp.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type,Authorization" \
     -X OPTIONS \
     https://your-api-gateway-url.amazonaws.com/hobby/api/health
```

### Step 3: Frontend-Backend Connection

1. **Open Amplify URL** in browser
2. **Check Network Tab** for API calls
3. **Verify Authentication** flow works
4. **Test API Endpoints** through UI

## 📊 Monitoring and Debugging

### Frontend Monitoring

**Amplify Console**:

- Build logs and status
- Access logs and analytics
- Performance metrics

**Browser DevTools**:

- Network requests to API
- Console errors and warnings
- Authentication token validation

### Backend Monitoring

**CloudWatch Logs**:

```bash
# View Lambda logs
aws logs tail /aws/lambda/macro-ai-hobby-api --follow
```

**API Gateway Logs**:

- Request/response logging
- CORS error tracking
- Authentication failures

## 🚨 Common Issues and Solutions

### Issue 1: CORS Errors

**Symptoms**: `Access-Control-Allow-Origin` errors in browser console

**Solutions**:

1. Verify Amplify URL is in API Gateway CORS settings
2. Redeploy infrastructure after CORS updates
3. Check API Gateway stage deployment

### Issue 2: API Connection Failures

**Symptoms**: Network errors, 404 responses

**Solutions**:

1. Verify `VITE_API_URL` is correct and includes `/api` path
2. Check API Gateway deployment status
3. Validate Lambda function is active

### Issue 3: Authentication Issues

**Symptoms**: 401 Unauthorized errors

**Solutions**:

1. Verify Cognito configuration in Parameter Store
2. Check JWT token format and expiration
3. Validate API key configuration

### Issue 4: Environment Variable Issues

**Symptoms**: `undefined` API URL or key

**Solutions**:

1. Ensure variables are prefixed with `VITE_`
2. Set variables in Amplify Console, not just .env files
3. Rebuild and redeploy after variable changes

## 💰 Cost Optimization

### Amplify Free Tier Usage

- **Build minutes**: 1,000/month (monitor in Amplify Console)
- **Bandwidth**: 15GB/month (sufficient for hobby use)
- **Requests**: Unlimited

### Backend Cost Optimization

- Lambda ARM64 architecture (20% cheaper)
- Parameter Store caching (reduces API calls)
- Conservative API Gateway throttling

## 🔄 CI/CD Integration

### Automatic Deployments

1. **Connect GitHub**: Link repository to Amplify
2. **Branch Strategy**:
   - `main` → Production environment
   - `develop` → Staging environment
3. **Build Triggers**: Automatic on push to connected branches

### Manual Deployments

```bash
# Deploy specific environment
pnpm deploy:staging
pnpm deploy:production
```

## 📞 Support and Troubleshooting

### Debug Checklist

1. ✅ Backend infrastructure deployed and healthy
2. ✅ Frontend built and deployed to Amplify
3. ✅ CORS configured for Amplify domain
4. ✅ Environment variables set correctly
5. ✅ API Gateway endpoints accessible
6. ✅ Authentication flow working

### Useful Commands

```bash
# Check Amplify status
amplify status

# View API Gateway info
aws apigateway get-rest-apis

# Test Lambda function
aws lambda invoke --function-name macro-ai-hobby-api response.json

# Check Parameter Store values
aws ssm get-parameters-by-path --path "/macro-ai/hobby"
```

---

**Next Steps**: After successful integration, configure custom domains, set up monitoring alerts, and implement
comprehensive end-to-end testing.
