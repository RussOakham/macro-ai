# Doppler Workflow Integration

## Status: ✅ PRODUCTION-READY

This document explains how Doppler is integrated into GitHub Actions workflows for centralized,
secure environment variable management across all CI/CD pipelines.

## 🎯 Overview

The Macro AI project uses **Doppler** as the single source of truth for application environment
variables across all environments (development, staging, and production). This approach provides:

- **Centralized Management**: All environment variables managed in one place
- **Environment Separation**: Different configs for dev, staging, and production
- **Branch-Based Selection**: Workflows automatically select the correct config based on
  the branch
- **Security**: Sensitive values never stored in code or GitHub Actions workflow files
- **Consistency**: Same variables available locally and in CI/CD
- **Audit Trail**: Changes to environment variables are tracked in Doppler

## 🏗️ Architecture

### Doppler Configuration Structure

```text
Doppler Project: macro-ai
├── dev (Development/PR Previews)
│   └── dev_personal (Local Development - sub-config)
├── stg (Staging/develop branch)
└── prd (Production/main branch)
```

### GitHub Secrets Required

Only **three** GitHub Secrets are required for Doppler authentication:

```bash
DOPPLER_TOKEN_DEV      # Token for 'dev' config
DOPPLER_TOKEN_STAGING  # Token for 'stg' config
DOPPLER_TOKEN_PROD     # Token for 'prd' config
```

All other environment variables are managed in Doppler and automatically injected.

## 🔄 Workflow Integration Pattern

### Branch-Based Config Selection

All workflows use a standardized pattern to select the appropriate Doppler config:

```yaml
- name: Set Doppler config based on branch
  run: |
    if [[ "${{ github.event_name }}" == "pull_request" ]]; then
      # PR context - use dev
      echo "DOPPLER_TOKEN=${{ secrets.DOPPLER_TOKEN_DEV }}" >> "$GITHUB_ENV"
      echo "DOPPLER_CONFIG=dev" >> "$GITHUB_ENV"
      echo "🔑 Using DEV Doppler token for PR"
    elif [[ "${{ github.ref_name }}" == "develop" ]]; then
      # Develop branch - use staging
      echo "DOPPLER_TOKEN=${{ secrets.DOPPLER_TOKEN_STAGING }}" >> "$GITHUB_ENV"
      echo "DOPPLER_CONFIG=stg" >> "$GITHUB_ENV"
      echo "🔑 Using STAGING Doppler token for develop"
    elif [[ "${{ github.ref_name }}" == "main" ]]; then
      # Main branch - use production
      echo "DOPPLER_TOKEN=${{ secrets.DOPPLER_TOKEN_PROD }}" >> "$GITHUB_ENV"
      echo "DOPPLER_CONFIG=prd" >> "$GITHUB_ENV"
      echo "🔑 Using PROD Doppler token for main"
    else
      # Default to dev for other branches
      echo "DOPPLER_TOKEN=${{ secrets.DOPPLER_TOKEN_DEV }}" >> "$GITHUB_ENV"
      echo "DOPPLER_CONFIG=dev" >> "$GITHUB_ENV"
      echo "🔑 Using DEV Doppler token (default)"
    fi

- name: Install Doppler CLI
  uses: dopplerhq/cli-action@v3
  with:
    token: ${{ env.DOPPLER_TOKEN }}

- name: Configure Doppler
  run: |
    doppler configure set project macro-ai
    doppler configure set config ${{ env.DOPPLER_CONFIG }}
```

### Minimal Environment Variables

After Doppler integration, workflow `env` blocks only contain:

```yaml
env:
  NODE_ENV: production # Explicitly set for build context
  APP_ENV: ${{ ... }} # Dynamic based on workflow
  DOPPLER_TOKEN: ${{ env.DOPPLER_TOKEN }} # For authentication
```

All other variables (API keys, database URLs, AWS Cognito config, etc.) are injected automatically.

## 📦 Environment Variables Managed by Doppler

### Application Core

- `API_KEY` - Application API key (32+ characters)
- `SERVER_PORT` - Express server port (default: 3040)
- `NODE_ENV` - Node environment (development/production/test)
- `APP_ENV` - Application environment (development/staging/production/pr-\*)

### AWS Cognito

- `AWS_COGNITO_REGION` - AWS region for Cognito
- `AWS_COGNITO_USER_POOL_ID` - Cognito User Pool ID
- `AWS_COGNITO_USER_POOL_CLIENT_ID` - Cognito Client ID
- `AWS_COGNITO_REFRESH_TOKEN_EXPIRY` - Token expiry in days

### Databases

- `REDIS_URL` - Redis connection string
- `RELATIONAL_DATABASE_URL` - PostgreSQL connection string with pgvector

### External Services

- `OPENAI_API_KEY` - OpenAI API key for AI features

### Cookies & Security

- `COOKIE_DOMAIN` - Cookie domain (localhost for dev_personal, macro-ai.russoakham.dev for remote)
- `COOKIE_ENCRYPTION_KEY` - Encryption key for secure cookies (32+ characters)
- `CORS_ALLOWED_ORIGINS` - Comma-separated allowed origins

### Rate Limiting

- `RATE_LIMIT_WINDOW_MS` - Global rate limit window (default: 900000ms / 15min)
- `RATE_LIMIT_MAX_REQUESTS` - Global max requests per window (default: 100)
- `AUTH_RATE_LIMIT_WINDOW_MS` - Auth-specific window (default: 3600000ms / 1hr)
- `AUTH_RATE_LIMIT_MAX_REQUESTS` - Auth max requests (default: 10)
- `API_RATE_LIMIT_WINDOW_MS` - API-specific window (default: 60000ms / 1min)
- `API_RATE_LIMIT_MAX_REQUESTS` - API max requests (default: 60)

## 🔧 Workflows Using Doppler

### 1. Hygiene Checks (`hygiene-checks.yml`)

**Purpose**: Build, lint, and test validation

**Doppler Usage**:

- All jobs (build, lint, test, security-scan) use branch-based config selection
- Environment variables injected for: build validation, linting, testing, security scanning

### 2. Security Scan (`security-scan.yml`)

**Purpose**: Weekly security scanning with ESLint

**Doppler Usage**:

- Scheduled runs use `dev` config by default
- Branch pushes use branch-based config selection

### 3. Reusable Deploy Frontend (`reusable-deploy-frontend.yml`)

**Purpose**: Reusable workflow for frontend deployment to Amplify

**Doppler Usage**:

- Accepts `DOPPLER_TOKEN` and `doppler-config` as inputs
- Used for API client generation (swagger generation requires real env vars)
- Calling workflows (PR preview, staging, production) pass appropriate token/config

### 4. Deploy PR Preview (`deploy-pr-preview-pulumi.yml`)

**Purpose**: Ephemeral PR preview environments

**Doppler Usage**:

- Uses `DOPPLER_TOKEN_DEV` and `dev` config
- All PR previews share dev configuration

### 5. Deploy Staging (`deploy-staging-pulumi.yml`)

**Purpose**: Staging environment deployment (develop branch)

**Doppler Usage**:

- Uses `DOPPLER_TOKEN_STAGING` and `stg` config
- Staging-specific configuration

### 6. Deploy Production (`deploy-production-pulumi.yml`, `deploy-minimal-traffic-production.yml`)

**Purpose**: Production deployment workflows

**Doppler Usage**:

- Uses `DOPPLER_TOKEN_PROD` and `prd` config
- Production-specific configuration with production credentials

## 🚨 Troubleshooting

### Common Issues

#### "Doppler Error: you must provide a token"

**Cause**: The `DOPPLER_TOKEN` environment variable is not set or not accessible to the step

**Solution**:

```yaml
# Ensure DOPPLER_TOKEN is explicitly passed to steps that need it
env:
  DOPPLER_TOKEN: ${{ env.DOPPLER_TOKEN }}
```

#### "Doppler authentication failed" or "Invalid token"

**Cause**: The Doppler token in GitHub Secrets is invalid or expired

**Solution**:

1. Generate new service tokens in Doppler dashboard
2. Update GitHub Secrets: `DOPPLER_TOKEN_DEV`, `DOPPLER_TOKEN_STAGING`, `DOPPLER_TOKEN_PROD`

#### "Missing environment variable: X"

**Cause**: Variable not defined in Doppler config

**Solution**:

1. Check Doppler dashboard for the specific config (`dev`, `stg`, or `prd`)
2. Add the missing variable to the appropriate config
3. Verify the variable is not commented out or empty

#### "COOKIE_DOMAIN mismatch"

**Cause**: Incorrect `COOKIE_DOMAIN` for the environment

**Solution**:

- `dev_personal`: Should be `localhost`
- `dev`, `stg`, `prd`: Should be `macro-ai.russoakham.dev`

### Verification Commands

```bash
# Verify Doppler CLI is authenticated locally
doppler secrets --project macro-ai --config dev_personal

# List all secrets in a config
doppler secrets --project macro-ai --config dev

# Test Doppler injection locally
doppler run -- pnpm test

# Check which config is being used
doppler configure get
```

## 🔐 Security Best Practices

### Do's ✅

- **Do** use environment-specific Doppler tokens (`DOPPLER_TOKEN_DEV`, `DOPPLER_TOKEN_STAGING`, `DOPPLER_TOKEN_PROD`)
- **Do** use branch-based config selection to ensure correct environment
- **Do** rotate Doppler service tokens regularly
- **Do** use Doppler's audit log to track changes
- **Do** keep sensitive values (API keys, database URLs) in Doppler only

### Don'ts ❌

- **Don't** commit Doppler tokens to version control
- **Don't** hardcode environment variables in workflow files
- **Don't** use production tokens for development/testing
- **Don't** share service tokens across environments
- **Don't** store sensitive values in GitHub Secrets when they can be in Doppler

## 📚 Additional Resources

- [Doppler CLI Documentation](https://docs.doppler.com/docs/cli)
- [Doppler GitHub Action](https://github.com/DopplerHQ/cli-action)
- [Environment Configuration Guide](../getting-started/environment-configuration.md)
- [CI/CD Setup Guide](./ci-cd-setup-guide.md)
- [GitHub Workflows Overview](./github-workflows-overview.md)

---

**Last Updated**: 2025-01-30
