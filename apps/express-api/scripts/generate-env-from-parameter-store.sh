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
# Dynamically set APP_ENV based on branch context
if [[ "$GITHUB_REF" == "refs/pull/"* ]]; then
    # PR branch - extract PR number and format as pr-{number}
    PR_NUMBER=$(echo "$GITHUB_REF" | grep -o '[0-9]\+' | head -1)
    if [ -n "$PR_NUMBER" ]; then
        echo "APP_ENV=pr-$PR_NUMBER" >> "$ENV_FILE"
    else
        echo "APP_ENV=pr-unknown" >> "$ENV_FILE"  # Fallback
    fi
elif [[ "$GITHUB_REF" == "refs/heads/develop" ]]; then
    # Develop branch - use staging
    echo "APP_ENV=staging" >> "$ENV_FILE"
elif [[ "$GITHUB_REF" == "refs/heads/main" ]]; then
    # Main branch - use production
    echo "APP_ENV=production" >> "$ENV_FILE"
else
    # Other branches (feature branches) - use development
    echo "APP_ENV=development" >> "$ENV_FILE"
fi
if [ -n "$API_KEY" ]; then echo "API_KEY=$API_KEY" >> "$ENV_FILE"; fi
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
echo "AWS_COGNITO_USER_POOL_SECRET_KEY=build-time-default" >> "$ENV_FILE"
echo "AWS_COGNITO_ACCESS_KEY=build-time-default" >> "$ENV_FILE"
echo "AWS_COGNITO_SECRET_KEY=build-time-default" >> "$ENV_FILE"
echo "COOKIE_ENCRYPTION_KEY=build-time-default-key-for-docker-build" >> "$ENV_FILE"
echo "RELATIONAL_DATABASE_URL=postgresql://build:build@localhost:5432/build" >> "$ENV_FILE"
echo "NON_RELATIONAL_DATABASE_URL=mongodb://build:build@localhost:27017/build" >> "$ENV_FILE"

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
