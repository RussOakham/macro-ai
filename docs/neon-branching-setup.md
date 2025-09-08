# Neon Database Branching Setup - Hybrid Approach 🎯 COMPLETED

## Current Branching Configuration

### Production Environment (Main Branch)

- **Project**: macro-ai (project-placeholder-12345678)
- **Branch**: main-production-branch (br-production-placeholder)
- **Status**: ✅ Active and ready
- **Connection String**: postgresql://user_placeholder:\*\*\*@ep-production-placeholder.us-east-1.aws.neon.tech/database_placeholder
- **Database**: users
- **Purpose**: Production database with live data and latest schema
- **Management**: Manual control (prevents automated deployments for security)
- **Cost**: £10-15/month (24/7 availability, high availability)

### Staging Environment (Auto-branch from Production)

- **Project**: macro-ai (project-placeholder-12345678)
- **Branch**: auto-branch-from-production (br-staging-placeholder)
- **Status**: ✅ Active and ready
- **Connection String**: postgresql://user_placeholder:\*\*\*@ep-staging-placeholder.us-east-1.aws.neon.tech/database_placeholder
- **Database**: users
- **Purpose**: Pre-deployment testing and schema validation
- **Management**: Hybrid (manual + automated via GitHub Actions)
- **Cost**: £8-12/month (cost-optimized with scheduled scaling)
- **Scaling**: Auto-scaling 2-10 instances, scheduled shutdown 10 PM - 6 AM UTC

### Feature Environment (Hybrid Management)

#### Manual Feature Branches

- **Branch**: auto-branch-from-staging
- **Status**: ✅ Template for manual feature development
- **Purpose**: Manual feature development with controlled deployments
- **Management**: Manual control via scripts
- **Cost**: Included in staging costs (no additional branches needed)

#### GitHub Actions PR Branches (NEW!)

- **Branch Pattern**: `preview/pr-{number}` (e.g., `preview/pr-123`)
- **Status**: ✅ Automated via GitHub Actions workflow
- **Purpose**: Automated database environments for PR testing
- **Management**: Fully automated (create on PR open, cleanup on merge/close)
- **Cost**: Free (auto-cleanup prevents accumulation)
- **Trigger**: PR opened/synchronized/closed events

#### GitHub Actions Feature Branches (NEW!)

- **Branch Pattern**: `feature/{branch-name}` (e.g., `feature/user-auth`)
- **Status**: ✅ Automated via GitHub Actions workflow
- **Purpose**: Automated environments for feature branch testing
- **Management**: Fully automated (create on push, cleanup on merge)
- **Cost**: Free (auto-cleanup prevents accumulation)

## Branching Hierarchy

```text
Production Branch (main-production-branch) [Manual Control]
    ↓ auto-branch
Staging Branch (auto-branch-from-production) [Hybrid Control]
    ↓ manual branch
├── Manual Feature Branch (auto-branch-from-staging) [Manual Control]
│   ↓ local development
│   └── Local Development (localhost)
└── GitHub Actions Automation
    ├── PR Branches (preview/pr-{number}) [Auto-created/cleanup]
    └── Feature Branches (feature/{branch-name}) [Auto-created/cleanup]
```

## Environment Database Mapping

```typescript
// Hybrid approach: Manual + GitHub Actions automation
const branches = {
	production: 'main-production-branch', // Manual control
	staging: 'auto-branch-from-production', // Hybrid control
	feature: 'auto-branch-from-staging', // Manual feature branches
	preview: 'preview/pr-{number}', // GitHub Actions PR branches
	githubFeature: 'feature/{branch-name}', // GitHub Actions feature branches
	development: 'localhost', // Local development
}
```

## GitHub Actions Integration

### Workflow Triggers

```yaml
# .github/workflows/neon-feature-branching.yml
on:
  pull_request:
    types: [opened, synchronize, closed]
    branches: [main, develop]
  push:
    branches: [main, develop]
  workflow_dispatch: # Manual actions
```

### Branch Lifecycle Management

| Trigger         | Action            | Branch Pattern                | Status       |
| --------------- | ----------------- | ----------------------------- | ------------ |
| PR Opened       | Create branch     | `preview/pr-{number}`         | ✅ Automated |
| PR Updated      | Validate schema   | `preview/pr-{number}`         | ✅ Automated |
| PR Closed       | Delete branch     | `preview/pr-{number}`         | ✅ Automated |
| Push to Main    | Update production | `main-production-branch`      | ✅ Manual    |
| Push to Develop | Update staging    | `auto-branch-from-production` | ✅ Manual    |

## Database Schema Status

- ✅ **Database**: `users`
- ✅ **Tables**: `__drizzle_migrations` (Drizzle ORM migrations)
- ✅ **PostgreSQL Version**: 17.5
- ✅ **Connection**: Working on production, staging, and all branch types
- ✅ **Hybrid Support**: Manual and GitHub Actions environments fully supported

## Environment Configuration Files

### Preview Environment (GitHub Actions)

```bash
# apps/express-api/config/examples/env.preview.example
NODE_ENV=production
APP_ENV=preview
GITHUB_ACTIONS=true
NEON_BRANCH_NAME=preview/pr-${PR_NUMBER}
```

### Feature Environment (Manual)

```bash
# apps/express-api/config/examples/env.feature.example
NODE_ENV=production
APP_ENV=feature
GITHUB_ACTIONS=false
NEON_BRANCH_NAME=auto-branch-from-staging
```

## Database Connection Configuration

The application automatically detects and configures the correct database connection:

```typescript
// apps/express-api/src/utils/neon-branching.ts - Hybrid Approach
export function getEnvironmentType():
	| 'production'
	| 'staging'
	| 'feature'
	| 'development'
	| 'preview' {
	// Check for GitHub Actions environment first (highest priority)
	if (isGitHubActions()) {
		const prNumber = getGitHubPRNumber()
		const branchName = getGitHubBranchName()

		// GitHub PR environment
		if (prNumber) return 'preview'

		// GitHub push to feature branch
		if (branchName && !['main', 'develop', 'master'].includes(branchName)) {
			return 'feature'
		}
	}

	// Manual environment detection (existing logic)
	if (config.APP_ENV === 'production') return 'production'
	if (config.APP_ENV === 'staging') return 'staging'
	if (config.APP_ENV === 'feature') return 'feature'

	return 'development'
}
```

## GitHub Integration Setup

### Required Secrets

```bash
# GitHub Repository Secrets
NEON_API_KEY=<your-neon-api-key>
NEON_PROJECT_ID=<your-project-id>
```

### Required Permissions

- ✅ **Neon Console**: GitHub App installed and configured
- ✅ **Repository**: Secrets configured with Neon credentials
- ✅ **Branch Protection**: Optional (recommended for main/develop)

## Branch Naming Conventions

| Environment    | Branch Pattern                | Example                       | Management |
| -------------- | ----------------------------- | ----------------------------- | ---------- |
| Production     | `main-production-branch`      | `main-production-branch`      | Manual     |
| Staging        | `auto-branch-from-production` | `auto-branch-from-production` | Hybrid     |
| Manual Feature | `auto-branch-from-staging`    | `auto-branch-from-staging`    | Manual     |
| PR Preview     | `preview/pr-{number}`         | `preview/pr-123`              | Automated  |
| Feature Branch | `feature/{name}`              | `feature/user-auth`           | Automated  |

## Cost Analysis

### Cost Breakdown (Hybrid Approach)

| Environment          | Management | Cost/Month | Notes                                 |
| -------------------- | ---------- | ---------- | ------------------------------------- |
| **Production**       | Manual     | £10-15     | 24/7 availability, high availability  |
| **Staging**          | Hybrid     | £8-12      | Cost-optimized with scheduled scaling |
| **Manual Feature**   | Manual     | £0         | Uses existing staging branch          |
| **PR Branches**      | Automated  | £0         | Free tier with auto-cleanup           |
| **Feature Branches** | Automated  | £0         | Free tier with auto-cleanup           |
| **Total**            | **Hybrid** | **£18-27** | **vs £30+ without optimization**      |

### Cost Optimization Features

- ✅ **Scheduled Scaling**: Staging environment shuts down 10 PM - 6 AM UTC
- ✅ **Auto-Cleanup**: PR and feature branches automatically deleted
- ✅ **Free Tier Utilization**: All automated branches use free tier
- ✅ **Efficient Resource Usage**: Only pay for branches when actively used

## Testing Status

### Manual Environments

- ✅ Production branch: Connection tested and working
- ✅ Staging branch: Connection tested and working
- ✅ Manual feature branches: Template configured and ready
- ✅ Database queries: Basic SELECT/INSERT/UPDATE operations successful
- ✅ Schema migrations: Drizzle ORM migrations working correctly

### GitHub Actions Environments

- ✅ PR branch creation: Workflow creates `preview/pr-{number}` branches
- ✅ Schema validation: Automated migration testing on PR updates
- ✅ Branch cleanup: Automatic deletion on PR merge/close
- ✅ Environment detection: GitHub Actions context properly detected
- ✅ Dynamic configuration: Branch-specific database URLs generated

### Hybrid Integration

- ✅ Environment type detection: Manual vs GitHub Actions properly distinguished
- ✅ Branch naming: Consistent patterns across all environments
- ✅ Database URL generation: Dynamic URLs for all branch types
- ✅ Deployment scripts: Support both manual and automated deployments

## Troubleshooting

### Common Issues and Solutions

#### GitHub Actions Branch Creation Fails

```bash
# Check GitHub secrets are properly configured
NEON_API_KEY=<your-api-key>
NEON_PROJECT_ID=<your-project-id>

# Verify Neon GitHub App is installed
# Neon Console → Integrations → GitHub → Check repository connection
```

#### Database Connection Issues

```bash
# Check branch exists in Neon console
# Verify API key has correct permissions
# Check database URL format includes branch parameter

# Test connection manually
psql "postgresql://user:pass@host/db?sslmode=require&branch=branch-name"
```

#### Environment Detection Problems

```typescript
// Check environment variables in GitHub Actions
console.log('GITHUB_ACTIONS:', process.env.GITHUB_ACTIONS)
console.log('GITHUB_EVENT_NAME:', process.env.GITHUB_EVENT_NAME)
console.log('APP_ENV:', process.env.APP_ENV)

// Verify neon-branching utility
import { getEnvironmentType, getNeonBranchConfig } from './neon-branching'
console.log('Environment Type:', getEnvironmentType())
console.log('Branch Config:', getNeonBranchConfig())
```

#### Branch Naming Conflicts

```bash
# Manual branches should not use automated patterns
# preview/pr-* → Reserved for GitHub Actions PRs
# feature/* → Reserved for GitHub Actions feature branches

# Use these for manual branches:
# auto-branch-from-staging (for manual features)
# main-production-branch (production)
# auto-branch-from-production (staging)
```

#### Cost Optimization Issues

```bash
# Check scheduled scaling is working
# Verify branch cleanup is happening
# Monitor Neon console for unexpected branches

# Manual cleanup if needed
# Neon Console → Branches → Delete unused branches
```

### Debug Commands

```bash
# Test Neon branching utility
cd apps/express-api
npm run ts-node src/utils/neon-branching.ts

# Check environment variables
echo "APP_ENV: $APP_ENV"
echo "GITHUB_ACTIONS: $GITHUB_ACTIONS"
echo "NEON_BRANCH_NAME: $NEON_BRANCH_NAME"

# Verify database connection
psql "$DATABASE_URL" -c "SELECT version();"

# Check Neon branch status
curl -H "Authorization: Bearer $NEON_API_KEY" \
  "https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/branches"
```

---

## Status Summary

**🎯 Hybrid Implementation**: ✅ **COMPLETED**

- ✅ **Manual Control**: Production and staging environments
- ✅ **GitHub Automation**: PR and feature branches
- ✅ **Cost Optimization**: £18-27/month total
- ✅ **Documentation**: Complete setup and troubleshooting guides
- ✅ **Testing**: All environments validated

**🚀 Ready for Production Use**

- Manual deployments: Use existing scripts
- Automated deployments: Create PR to trigger GitHub Actions
- Cost monitoring: Check Neon console regularly
- Branch management: Automatic cleanup prevents cost accumulation
