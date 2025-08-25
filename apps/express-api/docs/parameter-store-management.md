# Parameter Store Management Guide

This guide documents the parameter organization strategy, environment mapping logic, and procedures for managing parameters
across different deployment environments.

## Overview

AWS Systems Manager Parameter Store is used to manage configuration values across different environments. This guide covers
the hierarchical organization strategy implemented to support multiple deployment environments including preview environments
for pull requests.

## Parameter Hierarchy Structure

### Environment-Based Hierarchy

```text
/macro-ai/
├── development/          # Development environment parameters
├── staging/             # Staging environment parameters
├── production/          # Production environment parameters
└── shared/              # Shared parameters across environments
```

### Parameter Naming Convention

Parameters follow a consistent naming pattern:

```bash
/macro-ai/{environment}/{parameter-name}
```

**Examples:**

- `/macro-ai/development/AWS_COGNITO_USER_POOL_CLIENT_ID`
- `/macro-ai/staging/RELATIONAL_DATABASE_URL`
- `/macro-ai/production/API_KEY`
- `/macro-ai/shared/AWS_REGION`

## Environment Mapping Logic

### APP_ENV to Parameter Store Prefix Mapping

The `getParameterStorePrefix()` function maps APP_ENV values to Parameter Store prefixes:

```typescript
function getParameterStorePrefix(appEnv: string): string {
	// Preview environments (pr-*) map to development
	if (appEnv.startsWith('pr-')) {
		return '/macro-ai/development/'
	}

	// Standard environment mapping
	switch (appEnv) {
		case 'development':
			return '/macro-ai/development/'
		case 'staging':
			return '/macro-ai/staging/'
		case 'production':
			return '/macro-ai/production/'
		case 'test':
			return '/macro-ai/development/' // Test uses development parameters
		default:
			return '/macro-ai/development/' // Default fallback
	}
}
```

### Preview Environment Strategy

Preview environments (PR deployments) use the development parameter set:

- **APP_ENV Pattern**: `pr-{number}` (e.g., `pr-51`, `pr-123`)
- **Parameter Prefix**: `/macro-ai/development/`
- **Rationale**: Preview environments should use safe, non-production values

## Required Parameters by Environment

### Development Environment (`/macro-ai/development/`)

| Parameter Name                     | Description                 | Example Value             | Required |
| ---------------------------------- | --------------------------- | ------------------------- | -------- |
| `API_KEY`                          | Application API key         | `dev-api-key-12345`       | ✅       |
| `AWS_COGNITO_REGION`               | Cognito service region      | `us-east-1`               | ✅       |
| `AWS_COGNITO_USER_POOL_CLIENT_ID`  | Cognito user pool client ID | `abc123def456`            | ✅       |
| `AWS_COGNITO_USER_POOL_SECRET_KEY` | Cognito user pool secret    | `secret-key-value`        | ✅       |
| `AWS_COGNITO_ACCESS_KEY`           | Cognito access key          | `AKIA...`                 | ✅       |
| `AWS_COGNITO_SECRET_KEY`           | Cognito secret key          | `secret-value`            | ✅       |
| `COOKIE_ENCRYPTION_KEY`            | Cookie encryption key       | `32-char-encryption-key`  | ✅       |
| `RELATIONAL_DATABASE_URL`          | Database connection URL     | `postgresql://...`        | ✅       |
| `OPENAI_API_KEY`                   | OpenAI API key              | `sk-...`                  | ✅       |
| `CORS_ALLOWED_ORIGINS`             | CORS allowed origins        | `http://localhost:3000`   | ❌       |
| `CUSTOM_DOMAIN_NAME`               | Custom domain name          | `macro-ai.russoakham.dev` | ❌       |

### Staging Environment (`/macro-ai/staging/`)

Same parameters as development but with staging-specific values:

- Database URLs point to staging databases
- API keys use staging service accounts
- Domain names use staging subdomains

### Production Environment (`/macro-ai/production/`)

Same parameters as development but with production-specific values:

- Database URLs point to production databases
- API keys use production service accounts
- Domain names use production domains
- Additional security and monitoring parameters

### Shared Parameters (`/macro-ai/shared/`)

| Parameter Name         | Description          | Example Value | Used By          |
| ---------------------- | -------------------- | ------------- | ---------------- |
| `AWS_REGION`           | Default AWS region   | `us-east-1`   | All environments |
| `LOG_LEVEL`            | Default log level    | `info`        | All environments |
| `HEALTH_CHECK_TIMEOUT` | Health check timeout | `30000`       | All environments |

## Parameter Management Procedures

### Creating New Parameters

1. **Determine Environment Scope**

   ```bash
   # Environment-specific parameter
   aws ssm put-parameter \
     --name "/macro-ai/development/NEW_PARAMETER" \
     --value "parameter-value" \
     --type "SecureString" \
     --description "Description of the parameter"

   # Shared parameter
   aws ssm put-parameter \
     --name "/macro-ai/shared/NEW_SHARED_PARAMETER" \
     --value "shared-value" \
     --type "String" \
     --description "Shared parameter description"
   ```

2. **Update Configuration Schema**

   ```typescript
   // Add to env.schema.ts
   export const envSchema = z.object({
   	// ... existing parameters
   	NEW_PARAMETER: z.string().min(1),
   })
   ```

3. **Update Parameter Mappings**

   ```typescript
   // Add to enhanced-config.service.ts parameter mappings
   const PARAMETER_MAPPINGS = {
   	// ... existing mappings
   	NEW_PARAMETER: '/NEW_PARAMETER',
   }
   ```

### Copying Parameters Between Environments

```bash
# Get parameter from source environment
SOURCE_VALUE=$(aws ssm get-parameter \
  --name "/macro-ai/development/PARAMETER_NAME" \
  --with-decryption \
  --query "Parameter.Value" \
  --output text)

# Set parameter in target environment
aws ssm put-parameter \
  --name "/macro-ai/staging/PARAMETER_NAME" \
  --value "$SOURCE_VALUE" \
  --type "SecureString" \
  --overwrite
```

### Bulk Parameter Operations

#### List All Parameters for Environment

```bash
aws ssm get-parameters-by-path \
  --path "/macro-ai/development/" \
  --recursive \
  --query "Parameters[*].[Name,Value]" \
  --output table
```

#### Copy All Parameters to New Environment

```bash
#!/bin/bash
SOURCE_ENV="development"
TARGET_ENV="staging"

# Get all parameters from source
aws ssm get-parameters-by-path \
  --path "/macro-ai/$SOURCE_ENV/" \
  --recursive \
  --with-decryption \
  --query "Parameters[*].[Name,Value,Type]" \
  --output text | \
while read -r name value type; do
  # Convert source path to target path
  target_name=$(echo "$name" | sed "s|/$SOURCE_ENV/|/$TARGET_ENV/|")

  # Create parameter in target environment
  aws ssm put-parameter \
    --name "$target_name" \
    --value "$value" \
    --type "$type" \
    --overwrite

  echo "Copied: $name -> $target_name"
done
```

### Parameter Validation

#### Validate Required Parameters Exist

```bash
#!/bin/bash
ENVIRONMENT="development"
REQUIRED_PARAMS=(
  "API_KEY"
  "AWS_COGNITO_REGION"
  "AWS_COGNITO_USER_POOL_CLIENT_ID"
  "RELATIONAL_DATABASE_URL"
  "OPENAI_API_KEY"
)

echo "Validating required parameters for $ENVIRONMENT environment..."

for param in "${REQUIRED_PARAMS[@]}"; do
  if aws ssm get-parameter --name "/macro-ai/$ENVIRONMENT/$param" >/dev/null 2>&1; then
    echo "✅ $param exists"
  else
    echo "❌ $param missing"
  fi
done
```

#### Test Parameter Loading

```bash
# Test configuration loading with specific APP_ENV
APP_ENV=pr-51 node -e "
const { loadRuntimeConfig } = require('./dist/utils/load-config.js');
loadRuntimeConfig().then(([config, error]) => {
  if (error) {
    console.error('❌ Configuration loading failed:', error.message);
    process.exit(1);
  } else {
    console.log('✅ Configuration loaded successfully');
    console.log('Parameters loaded:', Object.keys(config).length);
    process.exit(0);
  }
});
"
```

## Security Best Practices

### Parameter Types

- **SecureString**: Use for sensitive values (API keys, passwords, secrets)
- **String**: Use for non-sensitive configuration values
- **StringList**: Use for comma-separated lists

### Access Control

#### IAM Policy for Parameter Store Access

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": [
				"ssm:GetParameter",
				"ssm:GetParameters",
				"ssm:GetParametersByPath"
			],
			"Resource": [
				"arn:aws:ssm:*:*:parameter/macro-ai/development/*",
				"arn:aws:ssm:*:*:parameter/macro-ai/shared/*"
			]
		}
	]
}
```

#### Environment-Specific Access

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": [
				"ssm:GetParameter",
				"ssm:GetParameters",
				"ssm:GetParametersByPath"
			],
			"Resource": "arn:aws:ssm:*:*:parameter/macro-ai/${aws:RequestedRegion}/*",
			"Condition": {
				"StringEquals": {
					"ssm:ResourceTag/Environment": "${aws:PrincipalTag/Environment}"
				}
			}
		}
	]
}
```

### Parameter Encryption

All sensitive parameters should use AWS KMS encryption:

```bash
# Create parameter with KMS encryption
aws ssm put-parameter \
  --name "/macro-ai/production/DATABASE_PASSWORD" \
  --value "super-secret-password" \
  --type "SecureString" \
  --key-id "alias/parameter-store-key" \
  --description "Production database password"
```

## Monitoring and Alerting

### Parameter Access Monitoring

The configuration monitoring system tracks:

- Parameter retrieval success/failure rates
- Parameter loading performance
- Missing parameter detection
- Access pattern analysis

### CloudWatch Alarms

Key alarms for parameter management:

- **Parameter Store Access Failures**: > 3 failures in 5 minutes
- **Missing Required Parameters**: Any required parameter missing
- **Slow Parameter Loading**: Average retrieval time > 2 seconds

## Troubleshooting

### Common Issues

1. **Parameter Not Found**

   ```bash
   # Check if parameter exists
   aws ssm get-parameter --name "/macro-ai/development/PARAMETER_NAME"

   # List all parameters in path
   aws ssm get-parameters-by-path --path "/macro-ai/development/"
   ```

2. **Access Denied**

   ```bash
   # Check IAM permissions
   aws sts get-caller-identity

   # Test parameter access
   aws ssm get-parameter --name "/macro-ai/development/API_KEY" --with-decryption
   ```

3. **Wrong Parameter Prefix**

   ```bash
   # Check APP_ENV value
   echo $APP_ENV

   # Verify prefix mapping
   node -e "
   const { getParameterStorePrefix } = require('./dist/utils/load-config.js');
   console.log('APP_ENV:', process.env.APP_ENV);
   console.log('Prefix:', getParameterStorePrefix(process.env.APP_ENV || 'development'));
   "
   ```

### Debug Parameter Loading

Enable debug logging:

```bash
NODE_ENV=development DEBUG=parameter-store npm start
```

Check configuration loading logs:

```bash
# Filter for parameter store operations
grep "parameterStore" /var/log/macro-ai/app.log

# Check for configuration errors
grep "configurationLoadingFailure" /var/log/macro-ai/app.log
```

## Migration Procedures

### Migrating from Root-Level Parameters

1. **Audit Existing Parameters**

   ```bash
   aws ssm describe-parameters \
     --parameter-filters "Key=Name,Option=BeginsWith,Values=macro-ai-" \
     --query "Parameters[*].Name" \
     --output table
   ```

2. **Create Migration Script**

   ```bash
   #!/bin/bash
   # Map old parameter names to new hierarchy
   declare -A PARAMETER_MAP=(
     ["macro-ai-cognito-user-pool-client-id"]="/macro-ai/development/AWS_COGNITO_USER_POOL_CLIENT_ID"
     ["macro-ai-database-url"]="/macro-ai/development/RELATIONAL_DATABASE_URL"
     # Add more mappings...
   )

   for old_name in "${!PARAMETER_MAP[@]}"; do
     new_name="${PARAMETER_MAP[$old_name]}"

     # Get old parameter value
     value=$(aws ssm get-parameter --name "$old_name" --with-decryption --query "Parameter.Value" --output text)

     # Create new parameter
     aws ssm put-parameter --name "$new_name" --value "$value" --type "SecureString"

     echo "Migrated: $old_name -> $new_name"
   done
   ```

3. **Validate Migration**

   ```bash
   # Test configuration loading after migration
   npm test -- load-config.test.ts
   ```

4. **Clean Up Old Parameters** (after validation)

   ```bash
   # Delete old parameters (be careful!)
   aws ssm delete-parameter --name "macro-ai-old-parameter-name"
   ```

## Deployment Integration

### Pre-Deployment Parameter Validation

The deployment pipeline includes parameter validation to prevent deployment failures:

```yaml
# .github/workflows/deploy.yml
- name: Validate Parameters
  run: |
    # Check required parameters exist
    ./scripts/validate-parameters.sh ${{ env.APP_ENV }}

    # Test configuration loading
    APP_ENV=${{ env.APP_ENV }} npm run test:config
```

### Parameter Provisioning for New Environments

When creating new environments, use the parameter provisioning script:

```bash
#!/bin/bash
# scripts/provision-parameters.sh
ENVIRONMENT=$1
SOURCE_ENV=${2:-development}

if [ -z "$ENVIRONMENT" ]; then
  echo "Usage: $0 <environment> [source-environment]"
  exit 1
fi

echo "Provisioning parameters for $ENVIRONMENT environment..."

# Copy parameters from source environment
./scripts/copy-parameters.sh "$SOURCE_ENV" "$ENVIRONMENT"

# Validate parameter loading
APP_ENV="$ENVIRONMENT" node scripts/test-config-loading.js

echo "✅ Parameters provisioned successfully for $ENVIRONMENT"
```

### Automated Parameter Backup

```bash
#!/bin/bash
# scripts/backup-parameters.sh
ENVIRONMENT=$1
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="parameter-backup-${ENVIRONMENT}-${BACKUP_DATE}.json"

echo "Backing up parameters for $ENVIRONMENT environment..."

aws ssm get-parameters-by-path \
  --path "/macro-ai/$ENVIRONMENT/" \
  --recursive \
  --with-decryption \
  --output json > "backups/$BACKUP_FILE"

echo "✅ Parameters backed up to backups/$BACKUP_FILE"
```

## Automation Scripts

### Parameter Synchronization

Keep parameters synchronized across environments:

```bash
#!/bin/bash
# scripts/sync-parameters.sh
SOURCE_ENV=$1
TARGET_ENV=$2
DRY_RUN=${3:-false}

if [ "$DRY_RUN" = "true" ]; then
  echo "🔍 DRY RUN MODE - No changes will be made"
fi

# Get parameters that exist in source but not in target
aws ssm get-parameters-by-path \
  --path "/macro-ai/$SOURCE_ENV/" \
  --recursive \
  --query "Parameters[*].Name" \
  --output text | \
while read -r source_param; do
  target_param=$(echo "$source_param" | sed "s|/$SOURCE_ENV/|/$TARGET_ENV/|")

  # Check if target parameter exists
  if ! aws ssm get-parameter --name "$target_param" >/dev/null 2>&1; then
    echo "📋 Missing in $TARGET_ENV: $target_param"

    if [ "$DRY_RUN" != "true" ]; then
      # Copy parameter
      value=$(aws ssm get-parameter --name "$source_param" --with-decryption --query "Parameter.Value" --output text)
      aws ssm put-parameter --name "$target_param" --value "$value" --type "SecureString"
      echo "✅ Copied: $source_param -> $target_param"
    fi
  fi
done
```

### Parameter Health Check

```bash
#!/bin/bash
# scripts/health-check-parameters.sh
ENVIRONMENT=$1

echo "🔍 Health checking parameters for $ENVIRONMENT environment..."

# Check parameter accessibility
FAILED_PARAMS=()
REQUIRED_PARAMS=(
  "API_KEY"
  "AWS_COGNITO_REGION"
  "AWS_COGNITO_USER_POOL_CLIENT_ID"
  "RELATIONAL_DATABASE_URL"
  "OPENAI_API_KEY"
)

for param in "${REQUIRED_PARAMS[@]}"; do
  param_name="/macro-ai/$ENVIRONMENT/$param"

  if aws ssm get-parameter --name "$param_name" >/dev/null 2>&1; then
    echo "✅ $param"
  else
    echo "❌ $param (missing)"
    FAILED_PARAMS+=("$param")
  fi
done

# Test configuration loading
echo "🧪 Testing configuration loading..."
if APP_ENV="$ENVIRONMENT" timeout 30 node -e "
const { loadRuntimeConfig } = require('./dist/utils/load-config.js');
loadRuntimeConfig().then(([config, error]) => {
  if (error) {
    console.error('❌ Configuration loading failed:', error.message);
    process.exit(1);
  } else {
    console.log('✅ Configuration loaded successfully');
    process.exit(0);
  }
});
"; then
  echo "✅ Configuration loading test passed"
else
  echo "❌ Configuration loading test failed"
  FAILED_PARAMS+=("CONFIG_LOADING")
fi

# Report results
if [ ${#FAILED_PARAMS[@]} -eq 0 ]; then
  echo "🎉 All parameter health checks passed!"
  exit 0
else
  echo "💥 Health check failed for: ${FAILED_PARAMS[*]}"
  exit 1
fi
```

## Best Practices Summary

### Parameter Organization

1. **Use hierarchical structure** with environment-based prefixes
2. **Group related parameters** under common paths
3. **Use consistent naming conventions** across environments
4. **Separate sensitive and non-sensitive** parameters appropriately

### Security

1. **Use SecureString type** for all sensitive values
2. **Implement least-privilege access** with IAM policies
3. **Enable parameter encryption** with customer-managed KMS keys
4. **Audit parameter access** regularly

### Operations

1. **Validate parameters** before deployment
2. **Backup parameters** before major changes
3. **Monitor parameter access** and performance
4. **Automate parameter provisioning** for new environments

### Development Workflow

1. **Test configuration loading** in development
2. **Use preview environments** for testing parameter changes
3. **Document parameter dependencies** in code
4. **Version control parameter schemas** and mappings

## Related Documentation

- [Configuration Monitoring Guide](configuration-monitoring.md)
- [Deployment Procedures](deployment-procedures.md)
- [Environment Management](environment-management.md)
- [Security Guidelines](security-guidelines.md)
- [Troubleshooting Guide](troubleshooting.md)
