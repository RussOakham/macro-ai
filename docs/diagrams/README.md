# Architecture Diagrams

This directory contains architecture diagrams for the Macro AI deployment strategy.

## Current Status

**✅ FIXED**: Visual diagrams have been successfully generated using Python diagrams library with Graphviz. All diagrams are now available in this directory.

## Available Diagrams

### 1. Current Hobby Deployment Architecture

- **File**: `current_hobby_deployment_architecture.png`
- **Description**: Shows the existing EC2-based infrastructure
- **Status**: ✅ Available

### 2. Consolidated ECS + External Services Architecture

- **File**: `consolidated_ecs_+_external_services_architecture.png`
- **Description**: Shows the minimal-cost ECS Fargate setup with Neon and Upstash
- **Status**: ✅ Available

### 3. Future Scaling Architecture

- **File**: `future_scaling_architecture.png`
- **Description**: Documents scaling options for enterprise growth
- **Status**: ✅ Available

### 4. Corrected Neon Branching Strategy

- **File**: `corrected_neon_database_branching_strategy.png`
- **Description**: Visual diagram of the corrected database branching flow
- **Status**: ✅ Available (PNG)
- **Text Version**: `corrected-neon-branching-strategy.md` - Detailed documentation

## Corrected Neon Branching Strategy Summary

### Branch Hierarchy (Corrected)

```
Production Branch (main-production-branch)
    ↓ auto-branch
Staging Branch (auto-branch-from-production)
    ↓ auto-branch
Feature Branches (auto-branch-from-staging)
    ↓ local development
Local Development (localhost - uses current branch DB)
```

### Environment Database Mapping

```typescript
const branches = {
	production: 'main-production-branch',
	staging: 'auto-branch-from-production',
	feature: 'auto-branch-from-staging',
	development: 'localhost - same as current git branch',
}
```

## Diagram Generation

The diagrams were successfully generated using:

1. **Python Virtual Environment**: Created `.venv` with diagrams library
2. **Graphviz Installation**: Installed via Homebrew for diagram rendering
3. **Custom Script**: `scripts/generate-diagrams.py` generates all diagrams
4. **Output Location**: All diagrams saved to `docs/diagrams/` directory

To regenerate diagrams in the future:

```bash
source .venv/bin/activate
python3 scripts/generate-diagrams.py
```

## Key Architecture Decisions

### Minimal Cost Strategy

- **ECS Fargate**: £8-15/month for compute
- **Neon PostgreSQL**: FREE (1GB storage, auto-branching)
- **Upstash Redis**: FREE (30MB, 10k requests/day)
- **ALB + CloudWatch**: £3-4/month for infrastructure
- **Total**: ~£12-22/month

### Scaling Path

- Phase 1: Current setup (personal project)
- Phase 2: Upgrade to paid Neon/Upstash plans
- Phase 3: Full AWS migration (RDS, ElastiCache, etc.)

## Environment Configuration

| Environment     | ECS Tasks | Neon Branch       | Cost/Month |
| --------------- | --------- | ----------------- | ---------- |
| Feature/Staging | 1 (256MB) | auto-from-staging | ~£10       |
| Staging         | 1 (1GB)   | from-production   | ~£15       |
| Production      | 2 (2GB)   | main-production   | ~£20       |

This documentation provides a complete overview of the deployment architecture and scaling strategy.
