#!/bin/bash

# Test GitHub Actions workflows locally using act
# Usage: ./test-workflow.sh <workflow-name> [event-type]

set -e

WORKFLOW_NAME="$1"
EVENT_TYPE="${2:-workflow_dispatch}"

if [ -z "$WORKFLOW_NAME" ]; then
    echo "❌ Error: Workflow name is required"
    echo "Usage: $0 <workflow-name> [event-type]"
    echo ""
    echo "Available workflows:"
    find .github/workflows -name "*.yml" -type f | sed 's|.github/workflows/||' | sed 's|.yml||' | sort
    exit 1
fi

WORKFLOW_FILE=".github/workflows/${WORKFLOW_NAME}.yml"

if [ ! -f "$WORKFLOW_FILE" ]; then
    echo "❌ Error: Workflow file not found: $WORKFLOW_FILE"
    exit 1
fi

echo "🧪 Testing workflow: $WORKFLOW_NAME"
echo "📄 Workflow file: $WORKFLOW_FILE"
echo "🎯 Event type: $EVENT_TYPE"
echo ""

# Check if act is installed
if ! command -v act &> /dev/null; then
    echo "❌ Error: act is not installed"
    echo "Install with: brew install act"
    exit 1
fi

# Run act with dry-run first to check syntax
echo "🔍 Running syntax check (dry-run)..."
if act "$EVENT_TYPE" -W "$WORKFLOW_FILE" --dryrun; then
    echo "✅ Syntax check passed"
else
    echo "❌ Syntax check failed"
    exit 1
fi

echo ""
echo "🚀 Running workflow test..."
act "$EVENT_TYPE" -W "$WORKFLOW_FILE" --verbose

echo ""
echo "✅ Workflow test completed!"
