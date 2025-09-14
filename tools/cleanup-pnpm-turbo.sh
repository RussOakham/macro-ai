#!/bin/bash

echo "🧹 Starting comprehensive pnpm and turbo cleanup..."
echo "=================================================="

# Function to safely remove directories
safe_remove() {
    if [ -d "$1" ]; then
        echo "🗑️  Removing: $1"
        rm -rf "$1"
    else
        echo "ℹ️  Not found: $1"
    fi
}

# Function to safely remove files
safe_remove_file() {
    if [ -f "$1" ]; then
        echo "🗑️  Removing: $1"
        rm -f "$1"
    else
        echo "ℹ️  Not found: $1"
    fi
}

echo ""
echo "📁 Cleaning root level..."
safe_remove "node_modules"
safe_remove ".turbo"
safe_remove_file "pnpm-lock.yaml"

echo ""
echo "📱 Cleaning apps..."
safe_remove "apps/express-api/node_modules"
safe_remove "apps/client-ui/node_modules"

echo ""
echo "📦 Cleaning packages..."
safe_remove "packages/macro-ai-api-client/node_modules"
safe_remove "packages/config-typescript/node_modules"
safe_remove "packages/config-testing/node_modules"
safe_remove "packages/config-eslint/node_modules"
safe_remove "packages/types-macro-ai-api/node_modules"

echo ""
echo "🏗️  Cleaning infrastructure..."
safe_remove "infrastructure/node_modules"
safe_remove "infrastructure/.turbo"

echo ""
echo "🧹 Clearing pnpm cache..."
pnpm store prune

echo ""
echo "🧹 Clearing turbo cache..."
npx turbo clean

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Next steps:"
echo "1. Run: pnpm install"
echo "2. If issues persist, try: pnpm install --force"
echo ""
echo "Note: This will take some time as it needs to download all dependencies again."
