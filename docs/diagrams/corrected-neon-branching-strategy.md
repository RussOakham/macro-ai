# Corrected Neon Database Branching Strategy

## Branch Hierarchy & Flow

```text
Production Branch (main-production-branch)
    ↓ auto-branch
Staging Branch (auto-branch-from-production)
    ↓ auto-branch
Feature Branches (auto-branch-from-staging)
    ↓ local development
Local Development (localhost - uses current branch DB)
```

## Environment Database Mapping

```typescript
// Corrected environment-specific branches
const branches = {
	production: 'main-production-branch',
	staging: 'auto-branch-from-production',
	feature: 'auto-branch-from-staging',
	development: 'localhost - same as current git branch',
}
```

## Branch Creation Flow

1. **Production Branch**: Main production database (parent)
2. **Staging Branch**: Auto-created from production
3. **Feature Branches**: Auto-created from staging
4. **Development**: Local environment uses appropriate branch based on git checkout

## Schema Synchronization

```text
Feature Branch → Staging Branch → Production Branch
     ↑               ↑               ↑
  Schema changes flow upwards through the hierarchy
```

## Deployment Pipeline

```text
Feature Development → Feature Branch → Staging Validation → Production Release
     ↓                     ↓                     ↓
  Feature ECS Tasks → Staging ECS Tasks → Production ECS Tasks
```

## Key Benefits

- **Isolated Development**: Each feature gets its own database branch
- **Schema Safety**: Changes tested in feature → staging → production
- **Cost Effective**: Neon auto-branching is free
- **Fast Setup**: Instant database provisioning for new features
- **Rollback Ready**: Easy to rollback by switching branch pointers

## Git Workflow Integration

```bash
# Feature development workflow
git checkout develop
git checkout -b feature/new-feature
# Neon automatically creates branch database from staging

# Deployment workflow
git checkout staging
git merge feature/new-feature
# Neon automatically syncs schema to staging branch

# Production deployment
git checkout main
git merge staging
# Neon automatically syncs schema to production branch
```

## Database Connection Strategy

```typescript
// Environment-specific database connections
const getDatabaseUrl = (environment: string, branch?: string) => {
	switch (environment) {
		case 'production':
			return process.env.NEON_PRODUCTION_URL
		case 'staging':
			return process.env.NEON_STAGING_URL
		case 'feature':
			return process.env[`NEON_${branch?.toUpperCase()}_URL`]
		case 'development':
			// Use same branch as git checkout
			const currentBranch = getCurrentGitBranch()
			return process.env[`NEON_${currentBranch.toUpperCase()}_URL`]
		default:
			return process.env.NEON_DEVELOPMENT_URL
	}
}
```

This corrected strategy ensures proper isolation between environments while maintaining the free benefits of Neon's
auto-branching feature.
