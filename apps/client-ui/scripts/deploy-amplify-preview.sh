#!/bin/bash

# AWS Amplify Preview Deployment Script for Macro AI Frontend
# Creates ephemeral Amplify apps for PR preview environments

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration from environment variables
AMPLIFY_APP_NAME=${AMPLIFY_APP_NAME:-"macro-ai-frontend-preview"}
ENVIRONMENT_NAME=${ENVIRONMENT_NAME:-"preview"}
PR_NUMBER=${PR_NUMBER:-"unknown"}
AWS_REGION=${AWS_REGION:-"us-east-1"}

# API Configuration
VITE_API_URL=${VITE_API_URL:-"https://api-development.macro-ai.com/api"}
VITE_API_KEY=${VITE_API_KEY:-""}
VITE_APP_ENV=${VITE_APP_ENV:-"preview"}

# Clean up any previous error files
rm -f amplify-deployment-error.txt amplify-deployment-url.txt

echo -e "${BLUE}🚀 AWS Amplify Preview Deployment${NC}"
echo -e "${BLUE}App Name: $AMPLIFY_APP_NAME${NC}"
echo -e "${BLUE}Environment: $ENVIRONMENT_NAME${NC}"
echo -e "${BLUE}PR Number: $PR_NUMBER${NC}"
echo -e "${BLUE}Region: $AWS_REGION${NC}"
echo ""

# Function to print status messages
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
    echo "$1" >> amplify-deployment-error.txt
}

# Validate required environment variables
if [[ -z "$VITE_API_KEY" ]]; then
    print_error "VITE_API_KEY environment variable is required"
    exit 1
fi

print_status "Environment variables validated"

# Check if AWS CLI is available and configured
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI not found. Please install AWS CLI."
    exit 1
fi

# Verify AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured or invalid"
    exit 1
fi

print_status "AWS CLI and credentials validated"

# Check if Amplify CLI is available
if ! command -v amplify &> /dev/null; then
    print_warning "Amplify CLI not found. Installing..."
    npm install -g @aws-amplify/cli
    print_status "Amplify CLI installed"
fi

# Verify Amplify CLI version
AMPLIFY_VERSION=$(amplify --version 2>/dev/null || echo "unknown")
print_status "Amplify CLI version: $AMPLIFY_VERSION"

# Check if Amplify app already exists
echo -e "${BLUE}🔍 Checking for existing Amplify app...${NC}"

APP_ID=""
EXISTING_APP=$(aws amplify list-apps --query "apps[?name=='$AMPLIFY_APP_NAME'].{appId:appId,name:name}" --output json 2>/dev/null || echo "[]")

if [[ "$EXISTING_APP" != "[]" ]] && [[ "$EXISTING_APP" != "" ]]; then
    APP_ID=$(echo "$EXISTING_APP" | jq -r '.[0].appId' 2>/dev/null || echo "")
    if [[ -n "$APP_ID" && "$APP_ID" != "null" ]]; then
        print_status "Found existing Amplify app: $APP_ID"
    else
        APP_ID=""
    fi
fi

# Create new Amplify app if it doesn't exist
if [[ -z "$APP_ID" ]]; then
    echo -e "${BLUE}📱 Creating new Amplify app...${NC}"
    
    # Create the Amplify app
    CREATE_RESULT=$(aws amplify create-app \
        --name "$AMPLIFY_APP_NAME" \
        --description "Frontend preview environment for PR #$PR_NUMBER" \
        --repository "https://github.com/RussOakham/macro-ai" \
        --platform "WEB" \
        --environment-variables \
            VITE_API_URL="$VITE_API_URL" \
            VITE_API_KEY="$VITE_API_KEY" \
            VITE_APP_ENV="$VITE_APP_ENV" \
            VITE_APP_NAME="Macro AI (Preview)" \
            VITE_ENABLE_DEVTOOLS="true" \
            VITE_ENABLE_DEBUG_LOGGING="true" \
        --build-spec '{
            "version": 1,
            "frontend": {
                "phases": {
                    "preBuild": {
                        "commands": [
                            "echo \"Installing dependencies...\"",
                            "npm install -g pnpm",
                            "pnpm install --frozen-lockfile"
                        ]
                    },
                    "build": {
                        "commands": [
                            "echo \"Building React application...\"",
                            "echo \"API URL: $VITE_API_URL\"",
                            "echo \"Environment: $VITE_APP_ENV\"",
                            "pnpm build"
                        ]
                    }
                },
                "artifacts": {
                    "baseDirectory": "dist",
                    "files": ["**/*"]
                },
                "cache": {
                    "paths": [
                        "node_modules/**/*",
                        ".pnpm-store/**/*"
                    ]
                }
            }
        }' \
        --output json)
    
    if [[ $? -eq 0 ]]; then
        APP_ID=$(echo "$CREATE_RESULT" | jq -r '.app.appId')
        print_status "Amplify app created: $APP_ID"
    else
        print_error "Failed to create Amplify app"
        exit 1
    fi
else
    echo -e "${BLUE}🔄 Updating existing Amplify app environment variables...${NC}"
    
    # Update environment variables for existing app
    aws amplify update-app \
        --app-id "$APP_ID" \
        --environment-variables \
            VITE_API_URL="$VITE_API_URL" \
            VITE_API_KEY="$VITE_API_KEY" \
            VITE_APP_ENV="$VITE_APP_ENV" \
            VITE_APP_NAME="Macro AI (Preview)" \
            VITE_ENABLE_DEVTOOLS="true" \
            VITE_ENABLE_DEBUG_LOGGING="true" \
        > /dev/null
    
    print_status "Environment variables updated"
fi

# Create or update the main branch
echo -e "${BLUE}🌿 Setting up main branch...${NC}"

BRANCH_EXISTS=$(aws amplify list-branches --app-id "$APP_ID" --query "branches[?branchName=='main'].branchName" --output text 2>/dev/null || echo "")

if [[ -z "$BRANCH_EXISTS" ]]; then
    # Create main branch
    aws amplify create-branch \
        --app-id "$APP_ID" \
        --branch-name "main" \
        --description "Main branch for preview deployment" \
        --enable-auto-build \
        > /dev/null
    
    print_status "Main branch created"
else
    print_status "Main branch already exists"
fi

# Deploy the application using the pre-built artifacts
echo -e "${BLUE}📦 Deploying application...${NC}"

# Verify build artifacts exist
if [ ! -d "dist" ]; then
    print_error "Build artifacts not found. Expected 'dist' directory."
    exit 1
fi

# Create a deployment package
DEPLOYMENT_PACKAGE="deployment-$(date +%s).zip"
cd dist
zip -r "../$DEPLOYMENT_PACKAGE" . > /dev/null
cd ..

print_status "Deployment package created: $DEPLOYMENT_PACKAGE"

# Start deployment
DEPLOYMENT_RESULT=$(aws amplify start-deployment \
    --app-id "$APP_ID" \
    --branch-name "main" \
    --source-url "file://$PWD/$DEPLOYMENT_PACKAGE" \
    --output json)

if [[ $? -eq 0 ]]; then
    JOB_ID=$(echo "$DEPLOYMENT_RESULT" | jq -r '.jobSummary.jobId')
    print_status "Deployment started: $JOB_ID"
else
    print_error "Failed to start deployment"
    exit 1
fi

# Wait for deployment to complete (with timeout)
echo -e "${BLUE}⏳ Waiting for deployment to complete...${NC}"

TIMEOUT=600  # 10 minutes
ELAPSED=0
SLEEP_INTERVAL=15

while [[ $ELAPSED -lt $TIMEOUT ]]; do
    JOB_STATUS=$(aws amplify get-job \
        --app-id "$APP_ID" \
        --branch-name "main" \
        --job-id "$JOB_ID" \
        --query 'job.summary.status' \
        --output text 2>/dev/null || echo "UNKNOWN")
    
    case "$JOB_STATUS" in
        "SUCCEED")
            print_status "Deployment completed successfully"
            break
            ;;
        "FAILED"|"CANCELLED")
            print_error "Deployment failed with status: $JOB_STATUS"
            exit 1
            ;;
        "PENDING"|"PROVISIONING"|"RUNNING")
            echo -e "${YELLOW}⏳${NC} Deployment in progress... (${ELAPSED}s elapsed)"
            ;;
        *)
            print_warning "Unknown deployment status: $JOB_STATUS"
            ;;
    esac
    
    sleep $SLEEP_INTERVAL
    ELAPSED=$((ELAPSED + SLEEP_INTERVAL))
done

if [[ $ELAPSED -ge $TIMEOUT ]]; then
    print_warning "Deployment timeout reached. Check Amplify console for status."
fi

# Get the deployed URL
AMPLIFY_URL=$(aws amplify get-app \
    --app-id "$APP_ID" \
    --query 'app.defaultDomain' \
    --output text 2>/dev/null || echo "")

if [[ -n "$AMPLIFY_URL" && "$AMPLIFY_URL" != "None" ]]; then
    FULL_URL="https://main.$AMPLIFY_URL"
    echo "$FULL_URL" > amplify-deployment-url.txt
    print_status "Application deployed at: $FULL_URL"
else
    echo "deployment-pending" > amplify-deployment-url.txt
    print_warning "Could not retrieve Amplify URL. Check Amplify console."
fi

# Clean up deployment package
rm -f "$DEPLOYMENT_PACKAGE"

echo ""
echo -e "${BLUE}📊 Deployment Summary${NC}"
echo "=================================="
print_status "Frontend preview deployed!"
echo "  App ID: $APP_ID"
echo "  Environment: $ENVIRONMENT_NAME"
echo "  PR Number: $PR_NUMBER"
echo "  API URL: $VITE_API_URL"
if [[ -n "$AMPLIFY_URL" && "$AMPLIFY_URL" != "None" ]]; then
    echo "  Preview URL: https://main.$AMPLIFY_URL"
fi
echo ""

echo -e "${GREEN}✅ Amplify preview deployment completed!${NC}"
