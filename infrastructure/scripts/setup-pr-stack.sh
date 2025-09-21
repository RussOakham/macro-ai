#!/bin/bash
set -euo pipefail

# Setup script for PR Preview Stack configuration
# This script configures the PR stack for Review Stacks functionality

echo "🚀 Setting up PR Preview Stack configuration..."

# Check if we're in the infrastructure/pulumi directory
if [[ ! -f "index.ts" ]]; then
    echo "❌ Please run this script from the infrastructure/pulumi directory"
    exit 1
fi

# Check if Pulumi CLI is installed
if ! command -v pulumi &> /dev/null; then
    echo "❌ Pulumi CLI is not installed. Please install it first."
    echo "   Visit: https://www.pulumi.com/docs/get-started/install/"
    exit 1
fi

# Check if we're logged into Pulumi
if ! pulumi whoami &> /dev/null; then
    echo "❌ Please log into Pulumi first:"
    echo "   pulumi login"
    exit 1
fi

echo "📋 Current Pulumi stacks:"
pulumi stack ls

# Create PR stack if it doesn't exist
if ! pulumi stack select pr &> /dev/null; then
    echo "📦 Creating PR stack..."
    pulumi stack init pr
    echo "✅ PR stack created"
else
    echo "✅ PR stack already exists"
fi

echo "🔧 Configuring PR stack..."

# Set the Doppler token for PR environments
echo "🔐 Please provide your Doppler development token:"
echo "   (This can be found in your Doppler dashboard under 'Tokens')"
read -s -p "Doppler Token: " DOPPLER_TOKEN
echo ""

if [[ -z "$DOPPLER_TOKEN" ]]; then
    echo "❌ Doppler token is required"
    exit 1
fi

pulumi config set doppler:dopplerToken "$DOPPLER_TOKEN" --secret

echo "✅ Doppler token configured for PR stack"

# Set GitHub configuration for Review Stacks
echo "🔧 Configuring GitHub integration for Review Stacks..."

echo "🔧 Setting GitHub configuration for Review Stacks..."

pulumi config set github:pullRequestTemplate true
pulumi config set github:repository "RussOakham/macro-ai"
pulumi config set github:deployCommits false  # Don't auto-deploy on merge (handled by workflows)
pulumi config set github:previewPullRequests false  # Don't do previews (handled by workflow)

echo "✅ GitHub configuration set for Review Stacks"

# Display current configuration
echo "📋 Current PR stack configuration:"
pulumi config

echo ""
echo "🎉 PR Preview Stack setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. ✅ PR stack is configured and ready"
echo "2. 🔧 Install Pulumi GitHub App: https://github.com/apps/pulumi"
echo "3. 🔄 Connect Pulumi Cloud to GitHub: https://app.pulumi.com/RussOakham/settings/integrations"
echo "4. 🔐 Configure Doppler for PR: ./setup-doppler-pr.sh"
echo "5. 🔍 Verify setup: ./verify-github-app.sh"
echo "6. 🧪 Test with a PR to see Review Stacks in action!"
echo ""
echo "📚 For more information about Review Stacks:"
echo "   https://www.pulumi.com/docs/pulumi-cloud/deployments/review-stacks/"
echo ""
echo "📋 Troubleshooting:"
echo "   If you encounter issues, check the verification script output"
echo "   and the GitHub App setup guide in infrastructure/docs/pulumi-github-app-setup.md"
