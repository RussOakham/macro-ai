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
# Priority order: GitHub Secrets > Parameter Store > Build Defaults
aws ssm get-parameters-by-path \
    --path "$PARAMETER_STORE_PREFIX" \
    --recursive \
    --with-decryption \
    --region "$AWS_REGION" \
    --no-cli-pager \
    --output json \
    | jq -r '.Parameters[] | "\(.Name | gsub("^'$PARAMETER_STORE_PREFIX'/"; ""))=\(.Value)"' \
    > "$ENV_FILE"

# Add GitHub secrets and real values (highest priority)
# These come from the workflow and override any Parameter Store defaults
echo "APP_ENV=$APP_ENV" >> "$ENV_FILE"
if [ -n "$API_KEY" ]; then 
    echo "API_KEY=$API_KEY" >> "$ENV_FILE"
    echo "[INFO] API_KEY added from GitHub secrets"
else
    echo "[ERROR] API_KEY is required but not provided in GitHub secrets"
    echo "[ERROR] Please add API_KEY to your GitHub repository secrets"
    exit 1
fi
if [ -n "$OPENAI_API_KEY" ]; then echo "OPENAI_API_KEY=$OPENAI_API_KEY" >> "$ENV_FILE"; fi
if [ -n "$AWS_ACCOUNT_ID" ]; then echo "AWS_ACCOUNT_ID=$AWS_ACCOUNT_ID" >> "$ENV_FILE"; fi
if [ -n "$AWS_REGION" ]; then echo "AWS_REGION=$AWS_REGION" >> "$ENV_FILE"; fi
if [ -n "$AWS_ROLE_ARN" ]; then echo "AWS_ROLE_ARN=$AWS_ROLE_ARN" >> "$ENV_FILE"; fi
if [ -n "$SERVER_PORT" ]; then echo "SERVER_PORT=$SERVER_PORT" >> "$ENV_FILE"; fi
if [ -n "$RATE_LIMIT_WINDOW_MS" ]; then echo "RATE_LIMIT_WINDOW_MS=$RATE_LIMIT_WINDOW_MS" >> "$ENV_FILE"; fi
if [ -n "$RATE_LIMIT_MAX_REQUESTS" ]; then echo "RATE_LIMIT_MAX_REQUESTS=$RATE_LIMIT_MAX_REQUESTS" >> "$ENV_FILE"; fi
if [ -n "$AUTH_RATE_LIMIT_WINDOW_MS" ]; then echo "AUTH_RATE_LIMIT_WINDOW_MS=$AUTH_RATE_LIMIT_WINDOW_MS" >> "$ENV_FILE"; fi
if [ -n "$AUTH_RATE_LIMIT_MAX_REQUESTS" ]; then echo "AUTH_RATE_LIMIT_MAX_REQUESTS=$AUTH_RATE_LIMIT_MAX_REQUESTS" >> "$ENV_FILE"; fi
if [ -n "$API_RATE_LIMIT_WINDOW_MS" ]; then echo "API_RATE_LIMIT_WINDOW_MS=$API_RATE_LIMIT_WINDOW_MS" >> "$ENV_FILE"; fi
if [ -n "$API_RATE_LIMIT_MAX_REQUESTS" ]; then echo "API_RATE_LIMIT_MAX_REQUESTS=$API_RATE_LIMIT_MAX_REQUESTS" >> "$ENV_FILE"; fi
if [ -n "$COST_ALERT_EMAILS" ]; then echo "COST_ALERT_EMAILS=$COST_ALERT_EMAILS" >> "$ENV_FILE"; fi

# Add essential build-time defaults only for variables not available from GitHub secrets
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
