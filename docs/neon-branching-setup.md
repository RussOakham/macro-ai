# Neon Database Branching Setup - Phase 2.1 ✅ COMPLETED

## Current Branching Configuration

### Production Environment (Main Branch)

- **Project**: macro-ai (frosty-sunset-09708148)
- **Branch**: main-production-branch (br-rapid-shape-a4nj44z1)
- **Status**: ✅ Active and ready
- **Connection String**: postgresql://users_owner:\*\*\*@ep-calm-bonus-a4pext89-pooler.us-east-1.aws.neon.tech/users
- **Database**: users
- **Purpose**: Production database with live data and latest schema

### Staging Environment (Auto-branch from Production)

- **Project**: macro-ai (frosty-sunset-09708148)
- **Branch**: auto-branch-from-production (br-silent-dust-a4qoulvz)
- **Status**: ✅ Active and ready
- **Connection String**: postgresql://users_owner:\*\*\*@ep-plain-wave-a401hax3-pooler.us-east-1.aws.neon.tech/users
- **Database**: users
- **Purpose**: Pre-deployment testing and schema validation

### Feature Environment (Template)

- **Project**: macro-ai (frosty-sunset-09708148)
- **Branch**: feature-branch-template (br-delicate-shape-a4pm4x9c)
- **Status**: ✅ Active template branch
- **Purpose**: Template for creating feature branches
- **Note**: Feature branches should logically branch from staging (auto-branch-from-production)

## Branching Hierarchy

```text
Production Branch (main-production-branch)
    ↓ auto-branch
Staging Branch (auto-branch-from-production)
    ↓ manual/template branch
Feature Branches (feature-branch-template)
    ↓ local development
Local Development (localhost - uses current git branch DB)
```

## Environment Database Mapping

```typescript
const branches = {
	production: 'main-production-branch',
	staging: 'auto-branch-from-production',
	feature: 'feature-branch-template', // Template for feature branches
	development: 'localhost - same as current git branch',
}
```

## Database Schema Status

- ✅ **Database**: `users`
- ✅ **Tables**: `__drizzle_migrations` (Drizzle ORM migrations)
- ✅ **PostgreSQL Version**: 17.5
- ✅ **Connection**: Working on both production and staging branches

## Next Steps

### Phase 2.2: Staging Environment Configuration

- [ ] Deploy staging ECS environment
- [ ] Configure staging-specific environment variables
- [ ] Test staging database connectivity
- [ ] Verify staging application deployment

### Phase 2.3: Feature Environment Setup

- [ ] Create feature branch from staging (when needed)
- [ ] Configure feature environment variables
- [ ] Set up feature-specific deployment pipeline

### Phase 2.4: Development Environment

- [ ] Configure local development to use appropriate branch
- [ ] Update development environment variables
- [ ] Test local database connectivity

## Database Connection Configuration

The application now automatically selects the correct database based on the `APP_ENV` environment variable:

```typescript
// apps/express-api/src/utils/neon-branching.ts
export function getNeonBranchConfig() {
	const appEnv = config.APP_ENV

	if (appEnv === 'production') return branches.production
	if (appEnv === 'staging') return branches.staging
	if (appEnv.startsWith('feature/')) return branches.feature

	return branches.development // localhost
}
```

## Cost Analysis

- ✅ **Free Tier**: All branches use Neon's free tier (512MB per branch)
- ✅ **No Additional Costs**: Branching is included in free tier
- ✅ **Future Scaling**: Documented upgrade paths for paid tiers when needed

## Testing Status

- ✅ Production branch: Connection tested and working
- ✅ Staging branch: Connection tested and working
- ✅ Database queries: Basic SELECT queries successful
- ✅ Schema: Drizzle migrations table present

---

**Phase 2.1 Status**: ✅ **COMPLETED**
**Next Phase**: Phase 2.2 - Configure staging environment with auto-branch from production
