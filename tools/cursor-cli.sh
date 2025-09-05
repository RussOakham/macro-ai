#!/bin/bash
# Cursor CLI Wrapper - Simple WSL Direct Access
# This script provides a convenient way to use cursor-agent via direct WSL calls

set -euo pipefail

# Configuration
WSL_PROJECT_PATH="/mnt/c/Users/rjoak/Documents/development/repos/macro-ai"
CURSOR_AGENT_PATH="/home/rjoakham/.local/bin/cursor-agent"

# Check if we're in the project directory
if [[ ! -f "CLAUDE.md" ]]; then
    echo "Error: Please run this script from the macro-ai project root directory"
    echo "Current directory: $(pwd)"
    exit 1
fi

# Function to show help
show_help() {
    echo ""
    echo "Cursor CLI Wrapper"
    echo ""
    echo "Usage:"
    echo "  $0 \"your prompt here\"              - Run with a prompt"
    echo "  $0 --interactive                   - Start interactive mode"
    echo "  $0 --status                        - Check authentication status"
    echo "  $0 --help                          - Show cursor-agent help"
    echo ""
    echo "Examples:"
    echo "  $0 \"analyze this codebase\""
    echo "  $0 \"what does the auth module do?\""
    echo "  $0 --interactive"
    echo ""
}

# If no arguments provided, show help
if [[ $# -eq 0 ]]; then
    show_help
    exit 0
fi

# Handle special commands
case "${1:-}" in
    --status)
        wsl.exe -- bash -c "cd $WSL_PROJECT_PATH && $CURSOR_AGENT_PATH status"
        ;;
    --help)
        wsl.exe -- $CURSOR_AGENT_PATH --help
        ;;
    --interactive)
        echo "Starting interactive Cursor CLI session..."
        echo "Press Ctrl+C to exit"
        echo ""
        wsl.exe -- bash -c "cd $WSL_PROJECT_PATH && $CURSOR_AGENT_PATH"
        ;;
    *)
        # Handle prompt
        PROMPT="$1"
        echo "Running: cursor-agent --output-format text --print \"$PROMPT\""
        echo ""
        wsl.exe -- bash -c "cd $WSL_PROJECT_PATH && $CURSOR_AGENT_PATH --output-format text --print '$PROMPT'"
        ;;
esac
