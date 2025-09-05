# AWS Amplify Deployment Guide

This guide covers deploying the Macro AI React frontend using AWS Amplify hosting as specified in the hobby deployment strategy.

## 🎯 Overview

AWS Amplify provides:

- **Free Tier**: 1,000 build minutes/month, 15GB bandwidth, unlimited requests
- **Built-in CloudFront CDN**: Global edge caching
- **Git Integration**: Automatic deployments from GitHub
- **Environment Management**: Staging and production environments
- **Custom Domains**: SSL certificates and Route 53 integration

## 🚀 Quick Deployment

### Prerequisites

1. **AWS CLI configured** with appropriate permissions
2. **Node.js 20+** and **pnpm** installed
3. **Amplify CLI** (will be installed automatically if missing)

### One-Command Deployment

```bash
cd apps/client-ui
pnpm deploy:amplify
```

## 📋 Manual Setup Process

### Step 1: Install Amplify CLI

```bash
npm install -g @aws-amplify/cli
amplify configure
```

### Step 2: Initialize Amplify Project

```bash
cd apps/client-ui
amplify init
```

**Configuration Options:**

- Project name: `macro-ai-frontend`
- Environment name: `hobby` (or `staging`/`production`)
- Default editor: `Visual Studio Code`
- App type: `javascript`
- Framework: `react`
- Source directory: `src`
- Distribution directory: `dist`
- Build command: `pnpm build`
- Start command: `pnpm dev`

### Step 3: Add Hosting

```bash
amplify add hosting
```

**Hosting Options:**

- Service: `Amazon CloudFront and S3`
- Hosting bucket name: `macro-ai-frontend-hosting`

### Step 4: Configure Environment Variables

In the Amplify Console, set the following environment variables:

**Required Variables:**

```bash
VITE_API_URL=https://your-api-gateway-url.amazonaws.com/hobby/api
VITE_API_KEY=your-production-api-key-32-characters
```

**Optional Variables:**

```bash
VITE_APP_ENV=production
VITE_APP_NAME=Macro AI
VITE_ENABLE_DEVTOOLS=false
```

### Step 5: Deploy

```bash
amplify publish
```

## 🔧 Environment Configuration

### Development Environment

```bash
# .env.local (for local development)
VITE_API_URL=http://localhost:3040/api
VITE_API_KEY=your-development-api-key
VITE_APP_ENV=development
```

### Staging Environment

```bash
# Amplify Console Environment Variables (staging)
VITE_API_URL=https://api-staging.macro-ai.com/api
VITE_API_KEY=your-staging-api-key
VITE_APP_ENV=staging
VITE_ENABLE_DEVTOOLS=true
```

### Production Environment

```bash
# Amplify Console Environment Variables (production)
VITE_API_URL=https://api.macro-ai.com/api
VITE_API_KEY=your-production-api-key
VITE_APP_ENV=production
VITE_ENABLE_DEVTOOLS=false
```

## 🌐 Custom Domain Setup

### Step 1: Add Custom Domain

```bash
amplify add hosting
# Choose: Add a custom domain
```

### Step 2: Configure Domain

In Amplify Console:

1. Go to App Settings > Domain management
2. Add domain: `app.macro-ai.com`
3. Configure DNS settings
4. Wait for SSL certificate provisioning

## 🔄 CI/CD Integration

### GitHub Integration

1. **Connect Repository**:
   - In Amplify Console, connect to GitHub repository
   - Select branch: `main` for production, `develop` for staging

2. **Build Settings**:

   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm install -g pnpm
           - pnpm install --frozen-lockfile
       build:
         commands:
           - pnpm build
     artifacts:
       baseDirectory: dist
       files:
         - '**/*'
     cache:
       paths:
         - node_modules/**/*
   ```

3. **Environment Variables**:
   - Set in Amplify Console for each environment
   - Use different API URLs for staging/production

## 📊 Monitoring and Analytics

### Built-in Monitoring

Amplify provides:

- **Build logs**: Real-time build monitoring
- **Access logs**: Request analytics
- **Performance metrics**: Core Web Vitals
- **Error tracking**: Runtime error monitoring

### Custom Analytics

Add analytics configuration:

```typescript
// src/lib/analytics.ts
export const analytics = {
	track: (event: string, properties?: Record<string, any>) => {
		if (import.meta.env.VITE_ENABLE_ANALYTICS === 'true') {
			// Analytics implementation
		}
	},
}
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Build Failures

```bash
# Check build logs in Amplify Console
# Common fixes:
- Ensure all dependencies are in package.json
- Check environment variables are set
- Verify build command is correct
```

#### 2. API Connection Issues

```bash
# Check CORS configuration in API Gateway
# Ensure API URL is correct
# Verify API key is valid
```

#### 3. Environment Variable Issues

```bash
# Ensure variables are prefixed with VITE_
# Check variables are set in Amplify Console
# Verify variable names match exactly
```

### Debug Commands

```bash
# View app status
amplify status

# View build logs
amplify console

# Test local build
pnpm build && pnpm preview

# Check environment variables
amplify env list
```

## 💰 Cost Optimization

### Free Tier Limits

- **Build minutes**: 1,000/month (always free)
- **Bandwidth**: 15GB/month (always free)
- **Requests**: Unlimited (always free)

### Cost Management

1. **Optimize builds**: Use caching, minimize dependencies
2. **Monitor usage**: Check Amplify Console for usage metrics
3. **Branch strategy**: Use staging for testing, production for releases

## 🔐 Security Considerations

1. **Environment Variables**: Never commit sensitive values to Git
2. **API Keys**: Use different keys for staging/production
3. **CORS**: Configure API Gateway to allow only Amplify domains
4. **SSL**: Amplify provides automatic SSL certificates
5. **Access Control**: Use IAM roles for Amplify permissions

## 📞 Support

For deployment issues:

1. Check Amplify Console build logs
2. Review this deployment guide
3. Check AWS Amplify documentation
4. Verify API Gateway CORS settings

---

**Next Steps**: After successful deployment, update API Gateway CORS settings to allow the Amplify domain and test the
complete application flow.
