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

# Fetch all parameters with the determined prefix
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
