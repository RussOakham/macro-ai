#!/bin/bash
set -e

# Generate environment file from AWS Parameter Store for Docker builds
# This script is used during the CDK deployment to inject environment variables

echo "[INFO] Generating environment file from Parameter Store..."

# Check required environment variables
if [ -z "$PARAMETER_STORE_PREFIX" ]; then
    echo "[ERROR] PARAMETER_STORE_PREFIX environment variable is required"
    exit 1
fi

if [ -z "$AWS_REGION" ]; then
    echo "[ERROR] AWS_REGION environment variable is required"
    exit 1
fi

# Output file
ENV_FILE="${ENV_FILE:-/tmp/.env}"

echo "[INFO] Fetching parameters from Parameter Store with prefix: $PARAMETER_STORE_PREFIX"
echo "[INFO] Output file: $ENV_FILE"

# Fetch all parameters with the given prefix
# Priority order: Parameter Store > GitHub Secrets > Defaults
aws ssm get-parameters-by-path \
    --path "$PARAMETER_STORE_PREFIX" \
    --recursive \
    --with-decryption \
    --region "$AWS_REGION" \
    --no-cli-pager \
    --output json \
    | jq -r '.Parameters[] | "\(.Name | gsub("^'$PARAMETER_STORE_PREFIX'/"; ""))=\(.Value)"' \
    > "$ENV_FILE"

# Add comprehensive defaults for build process
# Note: These are build-time defaults - runtime values come from GitHub secrets or Parameter Store
# Priority order for runtime:
# 1. Parameter Store variables (highest - environment-specific overrides)
# 2. GitHub repository secrets (medium - secure configuration)
# 3. Build-time defaults (lowest - only for Docker build validation)
echo "NODE_ENV=production" >> "$ENV_FILE"
echo "APP_ENV=development" >> "$ENV_FILE"
echo "SERVER_PORT=3040" >> "$ENV_FILE"

# Add build-time defaults for required variables (these will be overridden at runtime)
echo "AWS_COGNITO_REGION=us-east-1" >> "$ENV_FILE"
echo "AWS_COGNITO_USER_POOL_ID=build-time-default" >> "$ENV_FILE"
echo "AWS_COGNITO_USER_POOL_CLIENT_ID=build-time-default" >> "$ENV_FILE"
echo "AWS_COGNITO_USER_POOL_SECRET_KEY=build-time-default" >> "$ENV_FILE"
echo "AWS_COGNITO_ACCESS_KEY=build-time-default" >> "$ENV_FILE"
echo "AWS_COGNITO_SECRET_KEY=build-time-default" >> "$ENV_FILE"
echo "COOKIE_ENCRYPTION_KEY=build-time-default-key-for-docker-build" >> "$ENV_FILE"
echo "RELATIONAL_DATABASE_URL=postgresql://build:build@localhost:5432/build" >> "$ENV_FILE"
echo "NON_RELATIONAL_DATABASE_URL=mongodb://build:build@localhost:27017/build" >> "$ENV_FILE"
echo "OPENAI_API_KEY=build-time-default" >> "$ENV_FILE"
echo "RATE_LIMIT_WINDOW_MS=900000" >> "$ENV_FILE"
echo "RATE_LIMIT_MAX_REQUESTS=100" >> "$ENV_FILE"
echo "AUTH_RATE_LIMIT_WINDOW_MS=900000" >> "$ENV_FILE"
echo "AUTH_RATE_LIMIT_MAX_REQUESTS=5" >> "$ENV_FILE"
echo "API_RATE_LIMIT_WINDOW_MS=900000" >> "$ENV_FILE"
echo "API_RATE_LIMIT_MAX_REQUESTS=1000" >> "$ENV_FILE"

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
