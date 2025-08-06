#!/bin/bash

# Update API Gateway CORS Settings for Amplify Frontend
# This script updates the API Gateway CORS configuration to allow the deployed Amplify frontend

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${CDK_DEPLOY_ENV:-hobby}
AWS_REGION=${AWS_REGION:-us-east-1}
STACK_NAME="MacroAiHobbyStack"

echo -e "${BLUE}🔧 API Gateway CORS Update for Amplify Frontend${NC}"
echo -e "${BLUE}Environment: $ENVIRONMENT${NC}"
echo -e "${BLUE}Region: $AWS_REGION${NC}"
echo -e "${BLUE}Stack: $STACK_NAME${NC}"
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
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured or invalid"
    exit 1
fi

print_status "AWS CLI and credentials validated"

# Get Amplify app URL
echo -e "${BLUE}📋 Getting Amplify app URL...${NC}"

# Try to get Amplify app URL from Amplify CLI
AMPLIFY_URL=""
if command -v amplify &> /dev/null && [ -f "amplify/.config/project-config.json" ]; then
    AMPLIFY_URL=$(amplify status | grep -o 'https://[^[:space:]]*\.amplifyapp\.com' || echo "")
fi

# If not found, prompt user
if [ -z "$AMPLIFY_URL" ]; then
    echo -e "${YELLOW}Could not automatically detect Amplify URL.${NC}"
    echo "Please enter your Amplify app URL (e.g., https://main.d1234567890.amplifyapp.com):"
    read -r AMPLIFY_URL
    
    if [ -z "$AMPLIFY_URL" ]; then
        print_error "Amplify URL is required"
        exit 1
    fi
fi

print_status "Amplify URL: $AMPLIFY_URL"

# Get API Gateway REST API ID
echo -e "${BLUE}📋 Getting API Gateway information...${NC}"

API_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayRestApiId`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -z "$API_ID" ] || [ "$API_ID" == "None" ]; then
    print_error "Could not find API Gateway REST API ID in stack outputs"
    exit 1
fi

print_status "API Gateway REST API ID: $API_ID"

# Get current CORS configuration
echo -e "${BLUE}🔍 Checking current CORS configuration...${NC}"

# Get all resources
RESOURCES=$(aws apigateway get-resources \
    --rest-api-id "$API_ID" \
    --region "$AWS_REGION" \
    --query 'items[?pathPart==`{proxy+}`].id' \
    --output text)

if [ -z "$RESOURCES" ]; then
    print_warning "No proxy resources found. CORS may need to be configured manually."
else
    print_status "Found proxy resources: $RESOURCES"
fi

# Update CORS origins
echo -e "${BLUE}🔧 Updating CORS configuration...${NC}"

# Define allowed origins
ALLOWED_ORIGINS="'http://localhost:3000','https://localhost:3000','$AMPLIFY_URL'"

# Note: This is a simplified approach. In practice, CORS is configured in the CDK construct
echo -e "${YELLOW}⚠ CORS Configuration Note:${NC}"
echo "CORS settings are configured in the CDK ApiGatewayConstruct."
echo "To update CORS origins, modify the infrastructure code:"
echo ""
echo "File: infrastructure/src/constructs/api-gateway-construct.ts"
echo "Update the allowOrigins array to include: $AMPLIFY_URL"
echo ""
echo "Then redeploy the infrastructure:"
echo "  cd ../../infrastructure"
echo "  pnpm deploy"
echo ""

# Create a patch file for easy CORS update
cat > cors-update.patch << EOF
--- a/infrastructure/src/constructs/api-gateway-construct.ts
+++ b/infrastructure/src/constructs/api-gateway-construct.ts
@@ -200,7 +200,8 @@ export class ApiGatewayConstruct extends Construct {
 				allowCredentials: true,
 				allowOrigins: [
 					'http://localhost:3000',
-					'https://localhost:3000'
+					'https://localhost:3000',
+					'$AMPLIFY_URL'
 				],
 				allowMethods: apigateway.Cors.ALL_METHODS,
 				allowHeaders: [
EOF

print_status "Created CORS update patch file: cors-update.patch"

echo ""
echo -e "${BLUE}📊 CORS Update Summary${NC}"
echo "=================================="
echo "  Amplify URL: $AMPLIFY_URL"
echo "  API Gateway ID: $API_ID"
echo "  Patch file: cors-update.patch"
echo ""

echo -e "${BLUE}💡 Next Steps:${NC}"
echo "1. Apply the CORS patch to your infrastructure code:"
echo "   cd ../../infrastructure"
echo "   git apply ../apps/client-ui/cors-update.patch"
echo ""
echo "2. Or manually update the allowOrigins array in:"
echo "   infrastructure/src/constructs/api-gateway-construct.ts"
echo ""
echo "3. Redeploy the infrastructure:"
echo "   pnpm deploy"
echo ""
echo "4. Test the frontend-backend connection:"
echo "   curl -H \"Origin: $AMPLIFY_URL\" -H \"Access-Control-Request-Method: GET\" -X OPTIONS https://your-api-url/api/health"

echo ""
echo -e "${GREEN}✅ CORS update preparation completed!${NC}"
