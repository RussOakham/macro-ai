#!/bin/bash
set -euo pipefail

# Complete setup script for PR preview environments
# This script runs all necessary setup steps for PR deployments

echo "🚀 Setting up complete PR preview environment..."

# Check if we're in the infrastructure directory
if [[ ! -f "pulumi/index.ts" ]]; then
    echo "❌ Please run this script from the infrastructure directory"
    exit 1
fi

echo "📋 This script will set up:"
echo "✅ Pulumi PR stack configuration"
echo "✅ GitHub integration settings"
echo "✅ Doppler configuration for PR environments"
echo "🔍 Verification of all components"
echo "🧪 Testing of the complete setup"
echo ""

# Run individual setup scripts
echo "🔧 Step 1: Setting up PR stack..."
./scripts/setup-pr-stack.sh

echo ""
echo "🔐 Step 2: Setting up Doppler for PR..."
./scripts/setup-doppler-pr.sh

echo ""
echo "🔍 Step 3: Verifying GitHub App integration..."
./scripts/verify-github-app.sh

echo ""
echo "🧪 Step 4: Testing the complete setup..."
./scripts/test-pr-deployment.sh

echo ""
echo "🎉 Complete PR preview environment setup finished!"
echo ""
echo "📝 Summary of what was configured:"
echo "✅ PR stack created with Review Stacks enabled"
echo "✅ GitHub integration configured"
echo "✅ Doppler configured for PR environments"
echo "✅ All components verified and tested"
echo ""
echo "🚀 Next steps:"
echo "1. 🧪 Create a test PR to verify automatic deployment"
echo "2. 📊 Monitor the PR for automatic Review Stack deployment"
echo "3. ✅ Check that deployment comment appears in PR"
echo "4. 🌐 Test the deployed API endpoint"
echo ""
echo "📚 Troubleshooting:"
echo "   If issues occur, check:"
echo "   - GitHub App installation: https://github.com/apps/pulumi"
echo "   - Pulumi Cloud GitHub integration: https://app.pulumi.com/RussOakham/settings/integrations"
echo "   - Doppler access: https://dashboard.doppler.com/projects/macro-ai"
echo ""
echo "🎯 You're ready for PR preview deployments! 🚀"
