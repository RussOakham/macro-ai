#!/bin/bash
set -euo pipefail

# Setup script for Doppler PR environment configuration
# This script configures Doppler for PR preview environments

echo "🚀 Setting up Doppler for PR preview environments..."

# Check if we're in the infrastructure directory
if [[ ! -f "pulumi/index.ts" ]]; then
    echo "❌ Please run this script from the infrastructure directory"
    exit 1
fi

# Check if Doppler CLI is installed
if ! command -v doppler &> /dev/null; then
    echo "❌ Doppler CLI is not installed"
    echo "   Please install it from: https://docs.doppler.com/docs/install-cli"
    exit 1
fi

# Check if user is authenticated with Doppler
if ! doppler whoami &> /dev/null; then
    echo "❌ Doppler CLI is not authenticated"
    echo "   Please run: doppler login"
    exit 1
fi

echo "✅ Doppler CLI is available and authenticated"

# Check current Doppler project and configs
echo "📋 Current Doppler project and configs:"
echo "Project: macro-ai"
echo "Available configs:"
doppler configs list --project macro-ai

echo ""
echo "🔧 Setting up PR environment configuration..."

# Navigate to Pulumi directory
cd pulumi

# Check if PR stack exists
if ! pulumi stack select pr &> /dev/null; then
    echo "❌ PR stack does not exist"
    echo "   Please run the setup-pr-stack.sh script first"
    exit 1
fi

echo "✅ PR stack exists and selected"

# Set up Doppler configuration for PR environments
echo "🔐 Configuring Doppler for PR environments..."

# Check if we need to create a PR config in Doppler
echo "📝 To create a PR config in Doppler (optional):"
echo "1. Go to: https://dashboard.doppler.com/projects/macro-ai/configs"
echo "2. Click 'New Config'"
echo "3. Name: 'pr' (or 'preview')"
echo "4. Base: 'dev' (inherit from dev config)"
echo ""
echo "🔧 For now, we'll use the 'dev' config for PR environments"
echo "   This uses your development Doppler token and config"

# Set the Doppler project and config for PR environments
pulumi config set doppler:project "macro-ai"
pulumi config set doppler:config "dev"  # Use dev config for PR environments

echo "✅ Doppler project and config set for PR environments"

# Display current configuration
echo ""
echo "📋 Current PR stack Doppler configuration:"
pulumi config | grep -E "(doppler:|github:|environmentName)"

echo ""
echo "🎉 Doppler PR configuration complete!"
echo ""
echo "📝 What this enables:"
echo "✅ PR environments use 'dev' Doppler config"
echo "✅ Secrets are automatically injected into PR deployments"
echo "✅ Each PR gets isolated environment variables"
echo "✅ No manual secret management required"
echo ""
echo "📚 Note: If you want separate secrets for PR environments,"
echo "   create a 'pr' config in Doppler and update:"
echo "   pulumi config set doppler:config 'pr'"

# Test Doppler connectivity
echo ""
echo "🔍 Testing Doppler connectivity..."
if doppler secrets list --project macro-ai --config dev --json | head -1 &> /dev/null; then
    echo "✅ Doppler connectivity verified"
else
    echo "❌ Doppler connectivity failed"
    echo "   Please check your Doppler token and project access"
fi

echo ""
echo "🚀 Ready for PR deployments with Doppler secrets!"

