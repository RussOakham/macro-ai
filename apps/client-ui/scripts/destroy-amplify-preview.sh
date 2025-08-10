#!/bin/bash

# AWS Amplify Preview Destruction Script for Macro AI Frontend
# Destroys ephemeral Amplify apps for PR preview environments

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration from environment variables
AMPLIFY_APP_ID=${AMPLIFY_APP_ID:-""}
AMPLIFY_APP_NAME=${AMPLIFY_APP_NAME:-"macro-ai-frontend-preview"}
ENVIRONMENT_NAME=${ENVIRONMENT_NAME:-"preview"}
PR_NUMBER=${PR_NUMBER:-"unknown"}
AWS_REGION=${AWS_REGION:-"us-east-1"}

# Clean up any previous error files
rm -f amplify-destroy-error.txt

echo -e "${BLUE}🗑️ AWS Amplify Preview Destruction${NC}"
echo -e "${BLUE}App ID: $AMPLIFY_APP_ID${NC}"
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
    echo "$1" >> amplify-destroy-error.txt
}

# Validate required environment variables
if [[ -z "$AMPLIFY_APP_ID" ]]; then
    print_error "AMPLIFY_APP_ID environment variable is required"
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

# Verify the Amplify app exists before attempting deletion
echo -e "${BLUE}🔍 Verifying Amplify app exists...${NC}"

APP_INFO=$(aws amplify get-app \
    --app-id "$AMPLIFY_APP_ID" \
    --query 'app.{name:name,status:status,platform:platform}' \
    --output json 2>/dev/null || echo "null")

if [[ "$APP_INFO" == "null" ]] || [[ -z "$APP_INFO" ]]; then
    print_warning "Amplify app not found or already deleted: $AMPLIFY_APP_ID"
    echo "App may have already been cleaned up"
    exit 0
fi

APP_NAME=$(echo "$APP_INFO" | jq -r '.name' 2>/dev/null || echo "unknown")
APP_STATUS=$(echo "$APP_INFO" | jq -r '.status' 2>/dev/null || echo "unknown")
APP_PLATFORM=$(echo "$APP_INFO" | jq -r '.platform' 2>/dev/null || echo "unknown")

print_status "Amplify app verified: $APP_NAME (status: $APP_STATUS, platform: $APP_PLATFORM)"

# Verify this is the correct app to delete (safety check)
if [[ "$APP_NAME" != "$AMPLIFY_APP_NAME" ]]; then
    print_error "App name mismatch! Expected: $AMPLIFY_APP_NAME, Found: $APP_NAME"
    print_error "Aborting deletion for safety"
    exit 1
fi

print_status "App name verification passed"

# List and delete all branches first (if any exist)
echo -e "${BLUE}🌿 Checking for branches to delete...${NC}"

BRANCHES=$(aws amplify list-branches \
    --app-id "$AMPLIFY_APP_ID" \
    --query 'branches[].branchName' \
    --output text 2>/dev/null || echo "")

if [[ -n "$BRANCHES" ]]; then
    echo "Found branches: $BRANCHES"
    
    for branch in $BRANCHES; do
        echo -e "${YELLOW}🗑️${NC} Deleting branch: $branch"
        
        if aws amplify delete-branch \
            --app-id "$AMPLIFY_APP_ID" \
            --branch-name "$branch" \
            > /dev/null 2>&1; then
            print_status "Branch deleted: $branch"
        else
            print_warning "Failed to delete branch: $branch (may not exist or already deleted)"
        fi
    done
else
    print_status "No branches found to delete"
fi

# Wait for branch deletions to complete with polling
if [[ -n "$BRANCHES" ]]; then
    echo -e "${BLUE}⏳ Waiting for branch deletions to complete...${NC}"

    # Poll until no branches remain (timeout 120s)
    deadline=$((SECONDS+120))
    while [[ -n "$BRANCHES" && $SECONDS -lt $deadline ]]; do
        sleep 5
        BRANCHES=$(aws --region "$AWS_REGION" amplify list-branches --app-id "$AMPLIFY_APP_ID" --query 'branches[].branchName' --output text 2>/dev/null || echo "")
        if [[ -n "$BRANCHES" ]]; then
            echo -e "${YELLOW}⏳ Branches still exist: $BRANCHES${NC}"
        fi
    done

    if [[ -n "$BRANCHES" ]]; then
        echo -e "${YELLOW}⚠️ Warning: Some branches may still exist after timeout${NC}"
    else
        echo -e "${GREEN}✅ All branches deleted successfully${NC}"
    fi
fi

# Delete the Amplify app
echo -e "${BLUE}🗑️ Deleting Amplify app...${NC}"

DELETE_RESULT=$(aws amplify delete-app \
    --app-id "$AMPLIFY_APP_ID" \
    --output json 2>&1)

DELETE_EXIT_CODE=$?

if [[ $DELETE_EXIT_CODE -eq 0 ]]; then
    print_status "Amplify app deletion initiated successfully"
    
    # Extract app info from delete result if available
    DELETED_APP_NAME=$(echo "$DELETE_RESULT" | jq -r '.app.name' 2>/dev/null || echo "$AMPLIFY_APP_NAME")
    print_status "Deleted app: $DELETED_APP_NAME"
else
    # Check if the error is because the app doesn't exist
    if echo "$DELETE_RESULT" | grep -q "NotFoundException\|does not exist"; then
        print_warning "Amplify app was already deleted: $AMPLIFY_APP_ID"
        print_status "No further action needed"
        exit 0
    else
        print_error "Failed to delete Amplify app: $AMPLIFY_APP_ID"
        print_error "AWS CLI output: $DELETE_RESULT"
        exit 1
    fi
fi

# Wait for deletion to propagate with polling
echo -e "${BLUE}⏳ Waiting for deletion to complete...${NC}"

# Poll until app no longer exists (timeout 180s)
deadline=$((SECONDS+180))
while [[ $SECONDS -lt $deadline ]]; do
    sleep 5
    if ! aws --region "$AWS_REGION" amplify get-app --app-id "$AMPLIFY_APP_ID" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ App deletion confirmed${NC}"
        break
    fi
    echo -e "${YELLOW}⏳ App still exists, continuing to wait...${NC}"
done

# Verify deletion by attempting to get the app
echo -e "${BLUE}🔍 Verifying app deletion...${NC}"

VERIFICATION_RESULT=$(aws amplify get-app \
    --app-id "$AMPLIFY_APP_ID" \
    --query 'app.status' \
    --output text 2>/dev/null || echo "DOES_NOT_EXIST")

if [[ "$VERIFICATION_RESULT" == "DOES_NOT_EXIST" ]]; then
    print_status "App deletion verified - Amplify app no longer exists"
else
    print_warning "App still exists with status: $VERIFICATION_RESULT"
    print_warning "Deletion may still be in progress"
fi

echo ""
echo -e "${BLUE}📊 Destruction Summary${NC}"
echo "=================================="
print_status "Frontend preview destruction completed!"
echo "  App ID: $AMPLIFY_APP_ID"
echo "  App Name: $AMPLIFY_APP_NAME"
echo "  Environment: $ENVIRONMENT_NAME"
echo "  PR Number: $PR_NUMBER"
echo "  Verification: $VERIFICATION_RESULT"
echo ""

if [[ "$VERIFICATION_RESULT" == "DOES_NOT_EXIST" ]]; then
    echo -e "${GREEN}✅ Amplify preview destruction completed successfully!${NC}"
    echo -e "${GREEN}🧹 All resources have been cleaned up.${NC}"
else
    echo -e "${YELLOW}⚠️ Amplify preview destruction initiated.${NC}"
    echo -e "${YELLOW}🔄 Deletion may still be in progress.${NC}"
    echo ""
    echo -e "${BLUE}💡 You can verify deletion status with:${NC}"
    echo "aws amplify get-app --app-id $AMPLIFY_APP_ID"
fi

echo ""
echo -e "${BLUE}🎯 Cleanup completed for PR #${PR_NUMBER}${NC}"
