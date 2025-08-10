#!/bin/bash

# AWS Amplify Deployment Script for Macro AI Frontend
# Follows the hobby deployment strategy documented in docs/deployment/hobby-deployment/v1-0-0-hobby-deployment-plan.md

set -Eeuo pipefail
IFS=$'\n\t'

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${AMPLIFY_ENV:-hobby}
AWS_REGION=${AWS_REGION:-us-east-1}
APP_NAME="macro-ai-frontend"

echo -e "${BLUE}🚀 AWS Amplify Deployment for Macro AI Frontend${NC}"
echo -e "${BLUE}Environment: $ENVIRONMENT${NC}"
echo -e "${BLUE}Region: $AWS_REGION${NC}"
echo -e "${BLUE}App Name: $APP_NAME${NC}"
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
}

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed or not in PATH"
    echo "Install AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured or invalid"
    echo "Configure AWS CLI: aws configure"
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

# Check if this is a new Amplify project
if [ ! -f "amplify/.config/project-config.json" ]; then
    echo -e "${BLUE}📋 Initializing new Amplify project...${NC}"

    # Create Amplify configuration JSON
    cat > amplify-config.json << EOF
{
    "projectName": "$APP_NAME",
    "envName": "$ENVIRONMENT",
    "defaultEditor": "code",
    "appType": "javascript",
    "framework": "react",
    "srcDir": "src",
    "distDir": "dist",
    "buildCommand": "pnpm build",
    "startCommand": "pnpm dev",
    "useProfile": false,
    "profileName": "default"
}
EOF

    # Initialize Amplify project with JSON configuration
    amplify init --amplify amplify-config.json --yes

    # Clean up temporary config file
    rm -f amplify-config.json

    print_status "Amplify project initialized"
else
    print_status "Existing Amplify project detected"
fi

# Add hosting if not already configured
if [ ! -d "amplify/backend/hosting" ]; then
    echo -e "${BLUE}🌐 Adding Amplify hosting...${NC}"
    
    # Add hosting with CloudFront and S3
    amplify add hosting --yes \
        --service CloudFrontAndS3 \
        --name "$APP_NAME-hosting"
    
    print_status "Amplify hosting configured"
else
    print_status "Amplify hosting already configured"
fi

# Build the application
echo -e "${BLUE}📦 Building React application...${NC}"
pnpm install --frozen-lockfile
pnpm build

# Verify build output
if [ ! -d "dist" ]; then
    print_error "Build output directory 'dist' not found"
    exit 1
fi

BUILD_SIZE=$(du -sh dist | cut -f1)
print_status "Build completed (${BUILD_SIZE})"

# Deploy to Amplify
echo -e "${BLUE}🚀 Deploying to AWS Amplify...${NC}"
amplify publish --yes

# Get the deployed URL
AMPLIFY_URL=$(amplify status | grep -o 'https://[^[:space:]]*\.amplifyapp\.com' || echo "URL not found")

echo ""
echo -e "${BLUE}📊 Deployment Summary${NC}"
echo "=================================="
print_status "Frontend deployed successfully!"
echo "  Environment: $ENVIRONMENT"
echo "  Build Size: $BUILD_SIZE"
echo "  Amplify URL: $AMPLIFY_URL"
echo ""

if [ "$AMPLIFY_URL" != "URL not found" ]; then
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    echo ""
    echo -e "${BLUE}💡 Next Steps:${NC}"
    echo "1. Update API Gateway CORS settings to allow: $AMPLIFY_URL"
    echo "2. Test the deployed application: $AMPLIFY_URL"
    echo "3. Configure custom domain (optional)"
    echo "4. Set up branch-based deployments for CI/CD"
    echo ""
    echo -e "${BLUE}🔧 Useful Commands:${NC}"
    echo "• View app status: amplify status"
    echo "• View console: amplify console"
    echo "• Update hosting: amplify update hosting"
    echo "• Delete app: amplify delete"
else
    print_warning "Could not retrieve Amplify URL. Check Amplify console for deployment status."
fi

echo ""
echo -e "${GREEN}✅ Amplify deployment script completed!${NC}"
