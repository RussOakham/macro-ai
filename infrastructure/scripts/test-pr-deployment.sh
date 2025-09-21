#!/bin/bash
set -euo pipefail

# Test script for PR preview deployment workflow
# This script verifies all components are working without creating actual PRs

echo "🧪 Testing PR Preview Deployment Workflow..."
echo "============================================="
echo ""

# Check if we're in the infrastructure directory
if [[ ! -f "pulumi/index.ts" ]]; then
    echo "❌ Please run this script from the infrastructure directory"
    exit 1
fi

# Function to check command availability
check_command() {
    local cmd="$1"
    local description="$2"

    if command -v "$cmd" &> /dev/null; then
        echo "✅ $description available"
        return 0
    else
        echo "❌ $description not available"
        return 1
    fi
}

# Function to check file existence
check_file() {
    local file="$1"
    local description="$2"

    if [[ -f "$file" ]]; then
        echo "✅ $description found"
        return 0
    else
        echo "❌ $description not found"
        return 1
    fi
}

echo "🔍 Step 1: Checking Prerequisites"
echo "----------------------------------"

check_command "gh" "GitHub CLI"
check_command "pulumi" "Pulumi CLI"
check_command "doppler" "Doppler CLI"
check_command "aws" "AWS CLI"
check_command "docker" "Docker"
check_command "pnpm" "pnpm"

echo ""
echo "🔍 Step 2: Checking Authentication"
echo "----------------------------------"

# Check GitHub CLI auth
if gh auth status &> /dev/null; then
    echo "✅ GitHub CLI authenticated"
else
    echo "❌ GitHub CLI not authenticated"
    echo "   Run: gh auth login"
fi

# Check Pulumi auth
if pulumi whoami &> /dev/null; then
    echo "✅ Pulumi CLI authenticated"
    PULUMI_USER=$(pulumi whoami)
    echo "   User: $PULUMI_USER"
else
    echo "❌ Pulumi CLI not authenticated"
    echo "   Run: pulumi login"
fi

# Check Doppler auth
if doppler whoami &> /dev/null; then
    echo "✅ Doppler CLI authenticated"
else
    echo "❌ Doppler CLI not authenticated"
    echo "   Run: doppler login"
fi

# Check AWS auth (basic check)
if aws sts get-caller-identity &> /dev/null; then
    echo "✅ AWS CLI authenticated"
    AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    echo "   Account: $AWS_ACCOUNT"
else
    echo "❌ AWS CLI not authenticated"
    echo "   Run: aws configure"
fi

echo ""
echo "🔍 Step 3: Checking Configuration Files"
echo "---------------------------------------"

check_file "pulumi/index.ts" "Pulumi main configuration"
check_file "../.github/workflows/deploy-pr-preview-pulumi.yml" "PR deployment workflow"
check_file "scripts/setup-pr-stack.sh" "PR stack setup script"
check_file "scripts/setup-doppler-pr.sh" "Doppler PR setup script"
check_file "scripts/verify-github-app.sh" "GitHub App verification script"
check_file "docs/pulumi-github-app-setup.md" "GitHub App setup guide"

echo ""
echo "🔍 Step 4: Checking Pulumi Configuration"
echo "-----------------------------------------"

cd pulumi

# Check if PR stack exists
if pulumi stack select pr &> /dev/null; then
    echo "✅ PR stack exists"

    # Check key configurations
    echo "🔍 Checking PR stack configuration..."

    # Check Doppler configuration
    if DOPPLER_PROJECT=$(pulumi config get doppler:project 2>/dev/null); then
        echo "✅ doppler:project = $DOPPLER_PROJECT"
    else
        echo "❌ doppler:project not set"
    fi

    if DOPPLER_CONFIG=$(pulumi config get doppler:config 2>/dev/null); then
        echo "✅ doppler:config = $DOPPLER_CONFIG"
    else
        echo "❌ doppler:config not set"
    fi

    if DOPPLER_TOKEN=$(pulumi config get doppler:dopplerToken 2>/dev/null); then
        echo "✅ doppler:dopplerToken configured (hidden for security)"
    else
        echo "❌ doppler:dopplerToken not set"
    fi

    # Check GitHub configuration
    if GITHUB_TEMPLATE=$(pulumi config get github:pullRequestTemplate 2>/dev/null); then
        echo "✅ github:pullRequestTemplate = $GITHUB_TEMPLATE"
    else
        echo "❌ github:pullRequestTemplate not set"
    fi

    if GITHUB_REPO=$(pulumi config get github:repository 2>/dev/null); then
        echo "✅ github:repository = $GITHUB_REPO"
    else
        echo "❌ github:repository not set"
    fi

else
    echo "❌ PR stack does not exist"
    echo "   Run: pulumi stack init pr"
fi

# Go back to infrastructure directory
cd ..

echo ""
echo "🔍 Step 5: Testing Connectivity"
echo "---------------------------------"

# Test Doppler connectivity
echo "🔐 Testing Doppler connectivity..."
if doppler projects get macro-ai &> /dev/null; then
    echo "✅ Doppler connectivity successful"
else
    echo "❌ Doppler connectivity failed"
    echo "   Check your Doppler token and project access"
fi

# Test ECR connectivity
echo "🐳 Testing ECR connectivity..."
if aws ecr describe-repositories --repository-names macro-ai-staging-express-api &> /dev/null; then
    echo "✅ ECR repository accessible"
else
    echo "❌ ECR repository not accessible or doesn't exist"
    echo "   Check AWS permissions and repository name"
fi

echo ""
echo "🔍 Step 6: Checking GitHub App Installation"
echo "-------------------------------------------"

# Check if Pulumi GitHub App is installed
echo "🔍 Checking Pulumi GitHub App installation..."
if gh api repos/RussOakham/macro-ai/installation | jq -e '.id' &> /dev/null; then
    INSTALLATION_ID=$(gh api repos/RussOakham/macro-ai/installation | jq -r '.id')
    echo "✅ Pulumi GitHub App is installed (ID: ${INSTALLATION_ID})"

    # Check permissions
    PERMISSIONS=$(gh api installations/${INSTALLATION_ID} | jq -r '.permissions')
    echo "🔐 Checking permissions..."

    REQUIRED_PERMISSIONS=("contents:read" "metadata:read" "pull_requests:write")
    MISSING_PERMISSIONS=()

    for perm in "${REQUIRED_PERMISSIONS[@]}"; do
        if ! echo "${PERMISSIONS}" | jq -e ".${perm}" &> /dev/null; then
            MISSING_PERMISSIONS+=("${perm}")
        fi
    done

    if [[ ${#MISSING_PERMISSIONS[@]} -eq 0 ]]; then
        echo "✅ All required permissions granted"
    else
        echo "❌ Missing permissions:"
        printf '   - %s\n' "${MISSING_PERMISSIONS[@]}"
    fi
else
    echo "❌ Pulumi GitHub App is not installed"
    echo "   Install from: https://github.com/apps/pulumi"
fi

echo ""
echo "🎉 PR Preview Deployment Test Complete!"
echo "========================================="
echo ""
echo "📊 Test Results Summary:"
echo ""

# Count issues
ISSUES=0

# Check for missing components
MISSING_COMPONENTS=()
if ! pulumi stack select pr &> /dev/null; then
    MISSING_COMPONENTS+=("PR stack")
    ((ISSUES++))
fi
if ! pulumi config get doppler:dopplerToken &> /dev/null; then
    MISSING_COMPONENTS+=("Doppler token")
    ((ISSUES++))
fi
if ! gh api repos/RussOakham/macro-ai/installation | jq -e '.id' &> /dev/null; then
    MISSING_COMPONENTS+=("GitHub App")
    ((ISSUES++))
fi

if [[ $ISSUES -eq 0 ]]; then
    echo "🎉 All components configured correctly!"
    echo ""
    echo "🚀 Ready for PR preview deployments!"
    echo ""
    echo "📝 Next steps:"
    echo "1. Create a test PR to verify automatic deployment"
    echo "2. Check that the workflow runs successfully"
    echo "3. Verify PR comment with deployment URL"
    echo "4. Test the deployed API endpoint"
else
    echo "⚠️  Found $ISSUES issue(s) to fix:"
    printf '   - %s\n' "${MISSING_COMPONENTS[@]}"
    echo ""
    echo "🔧 To fix:"
    echo "   - Run: ./scripts/setup-complete-pr-environment.sh"
    echo "   - Install GitHub App: https://github.com/apps/pulumi"
    echo "   - Check documentation: docs/pulumi-github-app-setup.md"
fi

echo ""
echo "📚 Troubleshooting Tips:"
echo "- Check GitHub Actions logs for detailed error messages"
echo "- Verify all secrets are set in GitHub repository settings"
echo "- Ensure AWS permissions allow ECR and ECS operations"
echo "- Check Pulumi Cloud console for deployment status"

