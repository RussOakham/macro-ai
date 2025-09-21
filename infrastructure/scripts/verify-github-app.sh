#!/bin/bash
set -euo pipefail

# Script to verify Pulumi GitHub App installation and configuration
echo "🔍 Verifying Pulumi GitHub App integration..."

# Check if GitHub CLI is available
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed"
    echo "   Please install it from: https://cli.github.com/"
    exit 1
fi

# Check if user is authenticated with GitHub CLI
if ! gh auth status &> /dev/null; then
    echo "❌ GitHub CLI is not authenticated"
    echo "   Please run: gh auth login"
    exit 1
fi

echo "✅ GitHub CLI is available and authenticated"

# Check if Pulumi GitHub App is installed
echo "🔍 Checking Pulumi GitHub App installation..."
if gh api repos/RussOakham/macro-ai/installation | jq -e '.id' &> /dev/null; then
    echo "✅ Pulumi GitHub App is installed"

    # Get app installation details
    INSTALLATION_ID=$(gh api repos/RussOakham/macro-ai/installation | jq -r '.id')
    echo "📊 Installation ID: ${INSTALLATION_ID}"

    # Check app permissions
    echo "🔐 Checking app permissions..."
    PERMISSIONS=$(gh api installations/${INSTALLATION_ID} | jq -r '.permissions')

    echo "📋 Current permissions:"
    echo "${PERMISSIONS}" | jq '.'

    # Verify required permissions
    REQUIRED_PERMISSIONS=("contents:read" "metadata:read" "pull_requests:write")

    echo "🔍 Verifying required permissions..."
    MISSING_PERMISSIONS=()

    for perm in "${REQUIRED_PERMISSIONS[@]}"; do
        if ! echo "${PERMISSIONS}" | jq -e ".${perm}" &> /dev/null; then
            MISSING_PERMISSIONS+=("${perm}")
        fi
    done

    if [[ ${#MISSING_PERMISSIONS[@]} -eq 0 ]]; then
        echo "✅ All required permissions are granted"
    else
        echo "❌ Missing required permissions:"
        printf '  - %s\n' "${MISSING_PERMISSIONS[@]}"
        echo ""
        echo "🔧 To fix: Go to Repository Settings → GitHub Apps → Pulumi App → Configure"
        echo "   Ensure these permissions are enabled:"
        printf '   - %s\n' "${REQUIRED_PERMISSIONS[@]}"
    fi

else
    echo "❌ Pulumi GitHub App is not installed"
    echo ""
    echo "🔧 To install:"
    echo "1. Visit: https://github.com/apps/pulumi"
    echo "2. Click 'Install'"
    echo "3. Select 'macro-ai' repository"
    echo "4. Grant required permissions:"
    echo "   - Repository contents: Read"
    echo "   - Repository metadata: Read"
    echo "   - Pull requests: Write"
    exit 1
fi

# Check if Pulumi Cloud is connected to GitHub
echo ""
echo "🔍 Checking Pulumi Cloud GitHub integration..."

if command -v pulumi &> /dev/null; then
    if pulumi whoami &> /dev/null; then
        echo "✅ Pulumi CLI is available and authenticated"

        # Check PR stack configuration
        echo ""
        echo "🔧 Checking PR stack configuration..."
        cd ../pulumi

        if pulumi stack select pr &> /dev/null; then
            echo "✅ PR stack exists"

            # Check configuration
            echo "📋 Current PR stack configuration:"
            pulumi config

            # Verify key settings
            echo ""
            echo "🔍 Verifying key settings..."

            if pulumi config get github:pullRequestTemplate 2>/dev/null | grep -q "true"; then
                echo "✅ github:pullRequestTemplate: true"
            else
                echo "❌ github:pullRequestTemplate not set or not true"
                echo "   Run: pulumi config set github:pullRequestTemplate true"
            fi

            if pulumi config get github:repository 2>/dev/null | grep -q "RussOakham/macro-ai"; then
                echo "✅ github:repository: RussOakham/macro-ai"
            else
                echo "❌ github:repository not set or incorrect"
                echo "   Run: pulumi config set github:repository RussOakham/macro-ai"
            fi

            if pulumi config get doppler:dopplerToken 2>/dev/null; then
                echo "✅ Doppler token configured"
            else
                echo "❌ Doppler token not configured"
                echo "   Run: pulumi config set doppler:dopplerToken [YOUR_TOKEN] --secret"
            fi

        else
            echo "❌ PR stack does not exist"
            echo "   Run: pulumi stack init pr"
        fi

    else
        echo "❌ Pulumi CLI is not authenticated"
        echo "   Please run: pulumi login"
    fi
else
    echo "❌ Pulumi CLI is not installed"
    echo "   Visit: https://www.pulumi.com/docs/get-started/install/"
fi

echo ""
echo "🎉 Verification complete!"
echo ""
echo "📝 Summary:"
echo "✅ GitHub App: $(if gh api repos/RussOakham/macro-ai/installation | jq -e '.id' &> /dev/null; then echo 'Installed'; else echo 'Not installed'; fi)"
echo "✅ Permissions: $(if [[ ${#MISSING_PERMISSIONS[@]} -eq 0 ]]; then echo 'Correct'; else echo 'Missing'; fi)"
echo "✅ PR Stack: $(if pulumi stack select pr &> /dev/null 2>&1; then echo 'Exists'; else echo 'Missing'; fi)"
echo "✅ Configuration: $(if [[ -z "${MISSING_PERMISSIONS[*]}" ]] && pulumi stack select pr &> /dev/null 2>&1; then echo 'Complete'; else echo 'Incomplete'; fi)"

if [[ -z "${MISSING_PERMISSIONS[*]}" ]] && pulumi stack select pr &> /dev/null 2>&1; then
    echo ""
    echo "🚀 Ready to test! Create a PR to see Review Stacks in action."
else
    echo ""
    echo "⚠️  Please fix the issues above before testing."
fi

