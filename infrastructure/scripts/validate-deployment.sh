#!/bin/bash

# Macro AI Deployment Validation Script
# This script validates that the deployed Lambda function is working correctly

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${CDK_DEPLOY_ENV:-development}
AWS_REGION=${AWS_REGION:-us-east-1}
# Generate stack name based on environment
ENV_CAPITALIZED=$(echo "$ENVIRONMENT" | sed 's/.*/\u&/')
STACK_NAME="MacroAi${ENV_CAPITALIZED}Stack"

echo -e "${BLUE}🔍 Macro AI Deployment Validation${NC}"
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

# Get stack outputs
echo -e "${BLUE}📋 Getting stack outputs...${NC}"
STACK_OUTPUTS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs' \
    --output json 2>/dev/null)

if [ $? -ne 0 ]; then
    print_error "Failed to get stack outputs. Is the stack deployed?"
    exit 1
fi

# Extract API endpoint
API_ENDPOINT=$(echo "$STACK_OUTPUTS" | jq -r '.[] | select(.OutputKey=="ApiEndpoint") | .OutputValue')
LAMBDA_FUNCTION_NAME=$(echo "$STACK_OUTPUTS" | jq -r '.[] | select(.OutputKey=="LambdaFunctionName") | .OutputValue')

if [ "$API_ENDPOINT" == "null" ] || [ -z "$API_ENDPOINT" ]; then
    print_error "API endpoint not found in stack outputs"
    exit 1
fi

if [ "$LAMBDA_FUNCTION_NAME" == "null" ] || [ -z "$LAMBDA_FUNCTION_NAME" ]; then
    print_error "Lambda function name not found in stack outputs"
    exit 1
fi

print_status "Stack outputs retrieved successfully"
echo "  API Endpoint: $API_ENDPOINT"
echo "  Lambda Function: $LAMBDA_FUNCTION_NAME"
echo ""

# Test 1: Lambda function exists and is active
echo -e "${BLUE}🔍 Test 1: Lambda Function Status${NC}"
LAMBDA_STATUS=$(aws lambda get-function \
    --function-name "$LAMBDA_FUNCTION_NAME" \
    --region "$AWS_REGION" \
    --query 'Configuration.State' \
    --output text 2>/dev/null)

if [ "$LAMBDA_STATUS" == "Active" ]; then
    print_status "Lambda function is active"
else
    print_error "Lambda function status: $LAMBDA_STATUS"
    exit 1
fi

# Test 2: API Gateway health check
echo -e "${BLUE}🔍 Test 2: API Gateway Health Check${NC}"
HEALTH_RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/health_response.json "${API_ENDPOINT}api/health" || echo "000")

if [ "$HEALTH_RESPONSE" == "200" ]; then
    print_status "Health endpoint returned 200 OK"
    HEALTH_MESSAGE=$(jq -r '.message' /tmp/health_response.json 2>/dev/null || echo "No message")
    echo "  Response: $HEALTH_MESSAGE"
else
    print_error "Health endpoint returned HTTP $HEALTH_RESPONSE"
    if [ -f /tmp/health_response.json ]; then
        echo "Response body:"
        cat /tmp/health_response.json
    fi
    exit 1
fi

# Test 3: Lambda function logs
echo -e "${BLUE}🔍 Test 3: Lambda Function Logs${NC}"
LOG_GROUP_NAME="/aws/lambda/$LAMBDA_FUNCTION_NAME"

# Check if log group exists
if aws logs describe-log-groups \
    --log-group-name-prefix "$LOG_GROUP_NAME" \
    --region "$AWS_REGION" \
    --query 'logGroups[0].logGroupName' \
    --output text | grep -q "$LOG_GROUP_NAME"; then
    print_status "Lambda log group exists"
    
    # Get recent log events
    RECENT_LOGS=$(aws logs filter-log-events \
        --log-group-name "$LOG_GROUP_NAME" \
        --region "$AWS_REGION" \
        --start-time $(($(date +%s) * 1000 - 300000)) \
        --query 'events[0:3].message' \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$RECENT_LOGS" ]; then
        print_status "Recent log entries found"
        echo "  Recent logs (last 5 minutes):"
        echo "$RECENT_LOGS" | head -3 | sed 's/^/    /'
    else
        print_warning "No recent log entries found (this may be normal for a new deployment)"
    fi
else
    print_warning "Lambda log group not found (this may be normal for a new deployment)"
fi

# Test 4: Parameter Store integration
echo -e "${BLUE}🔍 Test 4: Parameter Store Integration${NC}"
PARAMETER_PREFIX="/macro-ai/$ENVIRONMENT"

# Check if critical parameters exist
CRITICAL_PARAMS=("critical/openai-api-key" "critical/neon-database-url" "critical/upstash-redis-url")
STANDARD_PARAMS=("standard/cognito-user-pool-id" "standard/cognito-user-pool-client-id")

PARAM_ERRORS=0

for param in "${CRITICAL_PARAMS[@]}"; do
    PARAM_NAME="$PARAMETER_PREFIX/$param"
    if aws ssm get-parameter --name "$PARAM_NAME" --region "$AWS_REGION" &>/dev/null; then
        print_status "Parameter exists: $param"
    else
        print_warning "Parameter missing: $param (needs manual setup)"
        PARAM_ERRORS=$((PARAM_ERRORS + 1))
    fi
done

for param in "${STANDARD_PARAMS[@]}"; do
    PARAM_NAME="$PARAMETER_PREFIX/$param"
    if aws ssm get-parameter --name "$PARAM_NAME" --region "$AWS_REGION" &>/dev/null; then
        print_status "Parameter exists: $param"
    else
        print_warning "Parameter missing: $param (needs manual setup)"
        PARAM_ERRORS=$((PARAM_ERRORS + 1))
    fi
done

# Test 5: API Gateway CORS
echo -e "${BLUE}🔍 Test 5: CORS Configuration${NC}"
CORS_RESPONSE=$(curl -s -w "%{http_code}" -H "Origin: https://app.macro-ai.com" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type,Authorization" \
    -X OPTIONS "${API_ENDPOINT}api/health" || echo "000")

if [ "$CORS_RESPONSE" == "200" ]; then
    print_status "CORS preflight request successful"
else
    print_warning "CORS preflight returned HTTP $CORS_RESPONSE (may need frontend domain configuration)"
fi

# Summary
echo ""
echo -e "${BLUE}📊 Validation Summary${NC}"
echo "=================================="

if [ $PARAM_ERRORS -gt 0 ]; then
    print_warning "Deployment validation completed with $PARAM_ERRORS parameter warnings"
    echo ""
    echo -e "${YELLOW}📝 Next Steps:${NC}"
    echo "1. Update Parameter Store values with your actual secrets:"
    echo "   aws ssm put-parameter --name '$PARAMETER_PREFIX/critical/openai-api-key' --value 'your-openai-key' --type SecureString --overwrite"
    echo "   aws ssm put-parameter --name '$PARAMETER_PREFIX/critical/neon-database-url' --value 'your-db-url' --type SecureString --overwrite"
    echo "   aws ssm put-parameter --name '$PARAMETER_PREFIX/standard/cognito-user-pool-id' --value 'your-pool-id' --type String --overwrite"
    echo "   aws ssm put-parameter --name '$PARAMETER_PREFIX/standard/cognito-user-pool-client-id' --value 'your-client-id' --type String --overwrite"
    echo ""
    echo "2. Test the API with actual parameters:"
    echo "   curl $API_ENDPOINT/api/health"
    echo ""
else
    print_status "All validation tests passed!"
    echo ""
    echo -e "${GREEN}🎉 Deployment is ready for use!${NC}"
    echo ""
    echo -e "${BLUE}💡 Useful Commands:${NC}"
    echo "• View logs: aws logs tail $LOG_GROUP_NAME --follow"
    echo "• Test API: curl $API_ENDPOINT/api/health"
    echo "• Update function: aws lambda update-function-code --function-name $LAMBDA_FUNCTION_NAME --zip-file fileb://path/to/lambda.zip"
fi

# Cleanup
rm -f /tmp/health_response.json

echo ""
echo -e "${GREEN}✅ Validation completed!${NC}"
