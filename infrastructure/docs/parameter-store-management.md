# Parameter Store Management Guide

## Overview

This guide documents the Parameter Store organization strategy, environment mapping logic, and procedures for managing
parameters across different deployment environments in the Macro AI application.

## Parameter Store Hierarchy

### Environment Structure

```text
/macro-ai/
├── development/          # Development environment parameters
│   ├── API_KEY
│   ├── AWS_COGNITO_USER_POOL_ID
│   ├── AWS_COGNITO_USER_POOL_CLIENT_ID
│   ├── OPENAI_API_KEY
│   ├── RELATIONAL_DATABASE_URL
│   ├── NON_RELATIONAL_DATABASE_URL
│   └── ...
├── staging/              # Staging environment parameters
│   ├── API_KEY
│   ├── AWS_COGNITO_USER_POOL_ID
│   └── ...
└── production/           # Production environment parameters
    ├── API_KEY
    ├── AWS_COGNITO_USER_POOL_ID
    └── ...
```

### Parameter Sharing Strategy

**Preview Environments (pr-\*)**: All preview environments share parameters from `/macro-ai/development/` for cost
optimization and consistency.

**Environment Mapping**:

- `pr-51`, `pr-123`, etc. → `/macro-ai/development/`
- `development` → `/macro-ai/development/`
- `staging` → `/macro-ai/staging/`
- `production` → `/macro-ai/production/`

## Parameter Categories

### Critical Parameters (SecureString, Advanced Tier)

- `API_KEY` - Application authentication key
- `AWS_COGNITO_USER_POOL_SECRET_KEY` - Cognito secret key
- `AWS_COGNITO_ACCESS_KEY` - Cognito access key
- `AWS_COGNITO_SECRET_KEY` - Cognito secret key
- `COOKIE_ENCRYPTION_KEY` - Session cookie encryption
- `OPENAI_API_KEY` - OpenAI API access key
- `RELATIONAL_DATABASE_URL` - PostgreSQL connection string
- `NON_RELATIONAL_DATABASE_URL` - Redis connection string

### Standard Parameters (String, Standard Tier)

- `AWS_COGNITO_REGION` - AWS Cognito region
- `AWS_COGNITO_USER_POOL_ID` - Cognito User Pool ID
- `AWS_COGNITO_USER_POOL_CLIENT_ID` - Cognito Client ID
- `CORS_ALLOWED_ORIGINS` - CORS configuration

## Management Scripts

### organize-parameter-store.sh

Primary script for Parameter Store organization and management.

**Usage Examples**:

```bash
# Organize all parameters with backup
./scripts/organize-parameter-store.sh organize-all

# Migrate existing parameters (dry run first)
./scripts/organize-parameter-store.sh --dry-run migrate-existing
./scripts/organize-parameter-store.sh migrate-existing

# Validate current structure
./scripts/organize-parameter-store.sh validate-structure

# Show current parameter structure
./scripts/organize-parameter-store.sh show-structure

# Create shared development parameters for preview environments
./scripts/organize-parameter-store.sh create-shared
```

**Available Commands**:

- `organize-all` - Create complete parameter hierarchy for all environments
- `migrate-existing` - Migrate existing parameters to new structure
- `validate-structure` - Validate current parameter organization
- `create-shared` - Create shared parameters for preview environments
- `backup-params` - Backup existing parameters before reorganization
- `restore-params` - Restore parameters from backup
- `show-structure` - Display current parameter structure

**Options**:

- `--dry-run` - Show what would be done without making changes
- `--verbose` - Enable verbose logging
- `--no-backup` - Skip parameter backup (not recommended)
- `--region REGION` - AWS region (default: us-east-1)

## Application Integration

### Configuration Loading

The application uses a dual-path approach for parameter loading:

1. **Flat Structure (Primary)**: `/macro-ai/{environment}/{PARAMETER_NAME}`
2. **Hierarchical Structure (Fallback)**: `/macro-ai/{environment}/critical/{parameter-name}`

This provides backward compatibility while supporting the new flat structure.

### Environment Mapping Logic

```typescript
const getParameterStorePrefix = (appEnv: string): string => {
	// Map preview environments to development parameters
	if (appEnv.startsWith('pr-')) {
		return '/macro-ai/development/'
	}

	// Use environment-specific prefixes for standard environments
	return `/macro-ai/${appEnv}/`
}
```

### Schema Validation

The application schema accepts both standard environment names and preview patterns:

```typescript
APP_ENV: z.union([
	z.enum(['development', 'staging', 'production', 'test']),
	z
		.string()
		.regex(/^pr-\d+$/, 'Preview environment must match pr-{number} pattern'),
])
```

## Deployment Integration

### Pre-deployment Validation

Both GitHub Actions and EC2 preview deployment scripts validate Parameter Store parameters before launching instances:

1. **AWS Credentials Check** - Validates AWS STS access
2. **Required Parameters Check** - Tests each critical parameter exists
3. **Parameter Access Test** - Verifies read permissions

### User Data Script Validation

EC2 instances validate configuration during startup:

1. **Parameter Store Access** - Tests AWS credentials and parameter access
2. **Required Parameters** - Checks all 11 critical parameters exist
3. **Configuration Loading Test** - Runs Node.js config loader validation
4. **Fail-Fast Approach** - Stops deployment if validation fails

## Common Operations

### Creating New Parameters

```bash
# Critical parameter (SecureString, Advanced tier)
aws ssm put-parameter \
  --name "/macro-ai/development/NEW_SECRET_KEY" \
  --value "your-secret-value" \
  --type "SecureString" \
  --tier "Advanced" \
  --description "Description of the parameter"

# Standard parameter (String, Standard tier)
aws ssm put-parameter \
  --name "/macro-ai/development/NEW_CONFIG_VALUE" \
  --value "your-config-value" \
  --type "String" \
  --description "Description of the parameter"
```

### Updating Parameters

```bash
# Update existing parameter
aws ssm put-parameter \
  --name "/macro-ai/development/API_KEY" \
  --value "new-api-key-value" \
  --type "SecureString" \
  --overwrite

# Update with description
aws ssm put-parameter \
  --name "/macro-ai/development/API_KEY" \
  --value "new-api-key-value" \
  --type "SecureString" \
  --description "Updated API key for authentication" \
  --overwrite
```

### Copying Parameters Between Environments

```bash
# Copy from development to staging
SOURCE_VALUE=$(aws ssm get-parameter --name "/macro-ai/development/API_KEY" --with-decryption --query "Parameter.Value" --output text)
aws ssm put-parameter \
  --name "/macro-ai/staging/API_KEY" \
  --value "$SOURCE_VALUE" \
  --type "SecureString" \
  --tier "Advanced" \
  --overwrite
```

### Listing Parameters

```bash
# List all parameters for an environment
aws ssm get-parameters-by-path \
  --path "/macro-ai/development" \
  --recursive \
  --query "Parameters[*].[Name,Type,LastModifiedDate]" \
  --output table

# List parameter names only
aws ssm get-parameters-by-path \
  --path "/macro-ai/development" \
  --recursive \
  --query "Parameters[*].Name" \
  --output text
```

## Security Best Practices

### Parameter Types

- Use `SecureString` for sensitive data (API keys, database URLs, secrets)
- Use `String` for non-sensitive configuration values
- Use `Advanced` tier for critical parameters requiring higher throughput

### Access Control

- Use IAM policies to restrict parameter access by environment
- Grant least-privilege access to applications
- Use parameter path-based permissions

### Backup and Recovery

- Always backup parameters before major changes
- Use the organize-parameter-store.sh script's backup functionality
- Store backups securely and test restore procedures

## Troubleshooting

### Common Issues

**Parameter Not Found**:

- Verify parameter path and spelling
- Check IAM permissions for parameter access
- Ensure parameter exists in the correct environment

**Access Denied**:

- Verify IAM role has `ssm:GetParameter` permission
- Check parameter path matches IAM policy
- Ensure `ssm:GetParameters` for batch operations

**Configuration Loading Failures**:

- Run parameter validation: `./scripts/organize-parameter-store.sh validate-structure`
- Check application logs for specific parameter errors
- Verify all required parameters exist

### Validation Commands

```bash
# Validate parameter structure
./scripts/organize-parameter-store.sh validate-structure

# Test parameter access
aws ssm get-parameter --name "/macro-ai/development/API_KEY" --with-decryption

# Check IAM permissions
aws sts get-caller-identity
aws ssm describe-parameters --max-items 1
```

## Migration Guide

### From Root-Level Parameters

If you have existing root-level parameters (e.g., `macro-ai-cognito-user-pool-id`), use the migration script:

```bash
# Dry run first to see what will be migrated
./scripts/organize-parameter-store.sh --dry-run migrate-existing

# Perform the migration
./scripts/organize-parameter-store.sh migrate-existing
```

### Parameter Name Mapping

| Old Parameter Name                     | New Parameter Path                                      |
| -------------------------------------- | ------------------------------------------------------- |
| `macro-ai-cognito-user-pool-client-id` | `/macro-ai/development/AWS_COGNITO_USER_POOL_CLIENT_ID` |
| `macro-ai-cognito-user-pool-id`        | `/macro-ai/development/AWS_COGNITO_USER_POOL_ID`        |
| `macro-ai-database-url`                | `/macro-ai/development/RELATIONAL_DATABASE_URL`         |
| `macro-ai-openai-key`                  | `/macro-ai/development/OPENAI_API_KEY`                  |
| `macro-ai-redis-url`                   | `/macro-ai/development/NON_RELATIONAL_DATABASE_URL`     |

## Cost Optimization

### Preview Environment Strategy

- All preview environments share development parameters
- Reduces parameter storage costs for ephemeral environments
- Maintains consistency across preview deployments

### Parameter Tiers

- Use `Standard` tier for non-critical parameters (free tier available)
- Use `Advanced` tier only for critical parameters requiring higher throughput
- Monitor parameter usage and costs through AWS Cost Explorer

## Monitoring and Alerting

### CloudWatch Metrics

- Monitor parameter retrieval errors
- Track parameter access patterns
- Set up alerts for configuration loading failures

### Application Monitoring

- Log configuration loading success/failure
- Monitor application startup times
- Alert on repeated configuration errors

This guide provides comprehensive coverage of Parameter Store management for the Macro AI application. For additional
support, refer to the AWS Systems Manager Parameter Store documentation or contact the development team.
