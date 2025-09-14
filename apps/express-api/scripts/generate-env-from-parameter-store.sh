#!/bin/bash
set -e

# Generate environment file from AWS Parameter Store for Docker builds
# This script is used during the CDK deployment to inject environment variables
# 
# Note: The application now automatically determines the parameter store prefix from APP_ENV:
# - pr-* environments → /macro-ai/development/
# - development → /macro-ai/development/
# - staging → /macro-ai/staging/
# - production → /macro-ai/production/
#
# All environment variables are sourced from Parameter Store as the single source of truth.
# Only APP_ENV is passed from the workflow to determine which Parameter Store prefix to use.

echo "[INFO] Generating environment file from Parameter Store..."

# Check required environment variables
if [ -z "$APP_ENV" ]; then
    echo "[ERROR] APP_ENV environment variable is required"
    exit 1
fi

if [ -z "$AWS_REGION" ]; then
    echo "[ERROR] AWS_REGION environment variable is required"
    exit 1
fi

# Output file
ENV_FILE="${ENV_FILE:-/tmp/.env}"

# Determine parameter store prefix based on APP_ENV
# This matches the logic in the application's getParameterStorePrefix function
# Note: This is a local variable for build-time parameter fetching, not the old environment variable
if [[ "$APP_ENV" == pr-* ]]; then
    # Preview environments (pr-123) use development parameters
    PARAMETER_STORE_PREFIX="/macro-ai/development"
elif [[ "$APP_ENV" == "development" ]]; then
    PARAMETER_STORE_PREFIX="/macro-ai/development"
elif [[ "$APP_ENV" == "staging" ]]; then
    PARAMETER_STORE_PREFIX="/macro-ai/staging"
elif [[ "$APP_ENV" == "production" ]]; then
    PARAMETER_STORE_PREFIX="/macro-ai/production"
else
    # Default to development for unknown environments
    PARAMETER_STORE_PREFIX="/macro-ai/development"
fi

echo "[INFO] App Environment: $APP_ENV"
echo "[INFO] Using Parameter Store prefix: $PARAMETER_STORE_PREFIX"
echo "[INFO] Output file: $ENV_FILE"

# Fetch all parameters with the determined prefix and map to correct environment variable names
# Priority order: Parameter Store > Build Defaults
aws ssm get-parameters-by-path \
    --path "$PARAMETER_STORE_PREFIX" \
    --recursive \
    --with-decryption \
    --region "$AWS_REGION" \
    --no-cli-pager \
    --output json \
    | jq -r '.Parameters[] | "\(.Name | gsub("^'$PARAMETER_STORE_PREFIX'/"; ""))=\(.Value)"' \
    > "$ENV_FILE"

# Apply parameter name to environment variable name mapping
# This matches the CDK EnvironmentConfigConstruct parameter mappings
echo "" >> "$ENV_FILE"
echo "# Mapped environment variables (Parameter Store key -> Environment variable name)" >> "$ENV_FILE"

# API Configuration
if grep -q "^api-key=" "$ENV_FILE"; then
    API_KEY_VALUE=$(grep "^api-key=" "$ENV_FILE" | cut -d'=' -f2-)
    echo "API_KEY=$API_KEY_VALUE" >> "$ENV_FILE"
fi

# Cookie Configuration
if grep -q "^cookie-encryption-key=" "$ENV_FILE"; then
    COOKIE_KEY_VALUE=$(grep "^cookie-encryption-key=" "$ENV_FILE" | cut -d'=' -f2-)
    echo "COOKIE_ENCRYPTION_KEY=$COOKIE_KEY_VALUE" >> "$ENV_FILE"
fi

# AWS Cognito Configuration
if grep -q "^aws-cognito-region=" "$ENV_FILE"; then
    COGNITO_REGION_VALUE=$(grep "^aws-cognito-region=" "$ENV_FILE" | cut -d'=' -f2-)
    echo "AWS_COGNITO_REGION=$COGNITO_REGION_VALUE" >> "$ENV_FILE"
fi
if grep -q "^aws-cognito-user-pool-id=" "$ENV_FILE"; then
    POOL_ID_VALUE=$(grep "^aws-cognito-user-pool-id=" "$ENV_FILE" | cut -d'=' -f2-)
    echo "AWS_COGNITO_USER_POOL_ID=$POOL_ID_VALUE" >> "$ENV_FILE"
fi
if grep -q "^aws-cognito-user-pool-client-id=" "$ENV_FILE"; then
    CLIENT_ID_VALUE=$(grep "^aws-cognito-user-pool-client-id=" "$ENV_FILE" | cut -d'=' -f2-)
    echo "AWS_COGNITO_USER_POOL_CLIENT_ID=$CLIENT_ID_VALUE" >> "$ENV_FILE"
fi
if grep -q "^aws-cognito-user-pool-secret-key=" "$ENV_FILE"; then
    SECRET_KEY_VALUE=$(grep "^aws-cognito-user-pool-secret-key=" "$ENV_FILE" | cut -d'=' -f2-)
    echo "AWS_COGNITO_USER_POOL_SECRET_KEY=$SECRET_KEY_VALUE" >> "$ENV_FILE"
fi

# Database Configuration
if grep -q "^relational-database-url=" "$ENV_FILE"; then
    DB_URL_VALUE=$(grep "^relational-database-url=" "$ENV_FILE" | cut -d'=' -f2-)
    echo "RELATIONAL_DATABASE_URL=$DB_URL_VALUE" >> "$ENV_FILE"
fi
if grep -q "^non-relational-database-url=" "$ENV_FILE"; then
    REDIS_URL_VALUE=$(grep "^non-relational-database-url=" "$ENV_FILE" | cut -d'=' -f2-)
    echo "REDIS_URL=$REDIS_URL_VALUE" >> "$ENV_FILE"
fi

# OpenAI Configuration
if grep -q "^openai-api-key=" "$ENV_FILE"; then
    OPENAI_KEY_VALUE=$(grep "^openai-api-key=" "$ENV_FILE" | cut -d'=' -f2-)
    echo "OPENAI_API_KEY=$OPENAI_KEY_VALUE" >> "$ENV_FILE"
fi

# Redis Configuration (if different from non-relational-database-url)
if grep -q "^redis-url=" "$ENV_FILE"; then
    REDIS_URL_VALUE=$(grep "^redis-url=" "$ENV_FILE" | cut -d'=' -f2-)
    echo "REDIS_URL=$REDIS_URL_VALUE" >> "$ENV_FILE"
fi

# Rate Limiting Configuration
if grep -q "^rate-limit-window-ms=" "$ENV_FILE"; then
    RATE_LIMIT_WINDOW_VALUE=$(grep "^rate-limit-window-ms=" "$ENV_FILE" | cut -d'=' -f2-)
    echo "RATE_LIMIT_WINDOW_MS=$RATE_LIMIT_WINDOW_VALUE" >> "$ENV_FILE"
fi
if grep -q "^rate-limit-max-requests=" "$ENV_FILE"; then
    RATE_LIMIT_MAX_VALUE=$(grep "^rate-limit-max-requests=" "$ENV_FILE" | cut -d'=' -f2-)
    echo "RATE_LIMIT_MAX_REQUESTS=$RATE_LIMIT_MAX_VALUE" >> "$ENV_FILE"
fi
if grep -q "^auth-rate-limit-window-ms=" "$ENV_FILE"; then
    AUTH_RATE_LIMIT_WINDOW_VALUE=$(grep "^auth-rate-limit-window-ms=" "$ENV_FILE" | cut -d'=' -f2-)
    echo "AUTH_RATE_LIMIT_WINDOW_MS=$AUTH_RATE_LIMIT_WINDOW_VALUE" >> "$ENV_FILE"
fi
if grep -q "^auth-rate-limit-max-requests=" "$ENV_FILE"; then
    AUTH_RATE_LIMIT_MAX_VALUE=$(grep "^auth-rate-limit-max-requests=" "$ENV_FILE" | cut -d'=' -f2-)
    echo "AUTH_RATE_LIMIT_MAX_REQUESTS=$AUTH_RATE_LIMIT_MAX_VALUE" >> "$ENV_FILE"
fi
if grep -q "^api-rate-limit-window-ms=" "$ENV_FILE"; then
    API_RATE_LIMIT_WINDOW_VALUE=$(grep "^api-rate-limit-window-ms=" "$ENV_FILE" | cut -d'=' -f2-)
    echo "API_RATE_LIMIT_WINDOW_MS=$API_RATE_LIMIT_WINDOW_VALUE" >> "$ENV_FILE"
fi
if grep -q "^api-rate-limit-max-requests=" "$ENV_FILE"; then
    API_RATE_LIMIT_MAX_VALUE=$(grep "^api-rate-limit-max-requests=" "$ENV_FILE" | cut -d'=' -f2-)
    echo "API_RATE_LIMIT_MAX_REQUESTS=$API_RATE_LIMIT_MAX_VALUE" >> "$ENV_FILE"
fi

# Optional Configuration
if grep -q "^cors-allowed-origins=" "$ENV_FILE"; then
    CORS_ORIGINS_VALUE=$(grep "^cors-allowed-origins=" "$ENV_FILE" | cut -d'=' -f2-)
    echo "CORS_ALLOWED_ORIGINS=$CORS_ORIGINS_VALUE" >> "$ENV_FILE"
fi
if grep -q "^cookie-domain=" "$ENV_FILE"; then
    COOKIE_DOMAIN_VALUE=$(grep "^cookie-domain=" "$ENV_FILE" | cut -d'=' -f2-)
    echo "COOKIE_DOMAIN=$COOKIE_DOMAIN_VALUE" >> "$ENV_FILE"
fi
if grep -q "^aws-cognito-refresh-token-expiry=" "$ENV_FILE"; then
    REFRESH_TOKEN_EXPIRY_VALUE=$(grep "^aws-cognito-refresh-token-expiry=" "$ENV_FILE" | cut -d'=' -f2-)
    echo "AWS_COGNITO_REFRESH_TOKEN_EXPIRY=$REFRESH_TOKEN_EXPIRY_VALUE" >> "$ENV_FILE"
fi

# Add APP_ENV (this is the only value that comes from the workflow, not Parameter Store)
echo "APP_ENV=$APP_ENV" >> "$ENV_FILE"

# Add essential build-time defaults only for variables not available from Parameter Store
# These ensure the build can complete but will be overridden by real values at runtime
echo "NODE_ENV=production" >> "$ENV_FILE"
echo "AWS_COGNITO_REGION=us-east-1" >> "$ENV_FILE"
echo "AWS_COGNITO_USER_POOL_ID=build-time-default" >> "$ENV_FILE"
echo "AWS_COGNITO_USER_POOL_CLIENT_ID=build-time-default" >> "$ENV_FILE"
# AWS Cognito credentials removed - using IAM roles instead
echo "COOKIE_ENCRYPTION_KEY=build-time-default-key-for-docker-build" >> "$ENV_FILE"
echo "RELATIONAL_DATABASE_URL=postgresql://build:build@localhost:5432/build" >> "$ENV_FILE"
echo "REDIS_URL=redis://localhost:6379" >> "$ENV_FILE"

# DEBUG: Log API_KEY value and length for debugging
if grep -q "^API_KEY=" "$ENV_FILE"; then
    API_KEY_VALUE=$(grep "^API_KEY=" "$ENV_FILE" | cut -d'=' -f2-)
    API_KEY_LENGTH=${#API_KEY_VALUE}
    echo "[DEBUG] API_KEY found in environment file:"
    echo "[DEBUG]   Value: ${API_KEY_VALUE}"
    echo "[DEBUG]   Length: ${API_KEY_LENGTH} characters"
    echo "[DEBUG]   Source: Parameter Store (${PARAMETER_STORE_PREFIX}/api-key)"
else
    echo "[ERROR] API_KEY NOT FOUND in environment file!"
    echo "[ERROR] Available variables:"
    grep "^[A-Z_]" "$ENV_FILE" | head -10
fi

# Validate that we got some parameters
if [ ! -s "$ENV_FILE" ]; then
    echo "[ERROR] No parameters found with prefix: $PARAMETER_STORE_PREFIX"
    exit 1
fi

echo "[INFO] Generated environment file with $(wc -l < "$ENV_FILE") variables"
echo "[INFO] Environment file generated successfully: $ENV_FILE"

# Debug: Show what variables were loaded (without values for security)
echo "[DEBUG] Variables loaded from Parameter Store:"
cut -d'=' -f1 "$ENV_FILE" | sort | while read -r var; do
    echo "[DEBUG]   - $var"
done
