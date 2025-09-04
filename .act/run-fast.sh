#!/bin/bash

# Fast Workflow Runner
# Quick commands for running the hygiene checks workflow

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKFLOW_FILE=".github/workflows/hygiene-checks.yml"
SECRETS_FILE=".act/secrets"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}🚀 Fast Workflow Runner${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Run all jobs respecting dependencies
run_all() {
    print_header
    echo "Running complete hygiene checks workflow with parallel containers..."
    echo

    "$SCRIPT_DIR/run-parallel.sh" all
}

# Run only fast jobs (no dependencies)
run_fast_only() {
    print_header
    echo "Running only fast jobs (no dependencies)..."
    echo "Jobs: lint-md, actionlint, gitleaks"
    echo

    "$SCRIPT_DIR/run-parallel.sh" jobs "lint-md,actionlint,gitleaks"
}

# Run only dependent jobs (assuming setup is done)
run_dependent_only() {
    print_header
    echo "Running dependent jobs (build, lint, test)..."
    echo "Note: Make sure setup job has been run first!"
    echo

    "$SCRIPT_DIR/run-parallel.sh" jobs "build,lint,test"
}

# Run single job
run_single() {
    local job="$1"
    if [ -z "$job" ]; then
        print_error "Please specify a job name"
        echo "Usage: $0 single <job-name>"
        exit 1
    fi

    print_header
    echo "Running single job: $job"
    echo

    "$SCRIPT_DIR/run-parallel.sh" single "$job"
}

# Show status and available commands
show_help() {
    print_header
    echo
    echo "Quick Commands:"
    echo "  $0 all           - Run complete workflow (all jobs, respecting dependencies)"
    echo "  $0 fast          - Run only fast jobs (lint-md, actionlint, gitleaks)"
    echo "  $0 dependent     - Run dependent jobs (build, lint, test)"
    echo "  $0 single <job>  - Run a single job"
    echo "  $0 help          - Show this help"
    echo
    echo "Available Jobs:"
    act -W "$WORKFLOW_FILE" --list | grep -E "^\s*[0-9]+\s+" | awk '{print "  " $2}'
    echo
    echo "Workflow: $WORKFLOW_FILE"
    echo "Secrets:  $SECRETS_FILE"
    echo
    echo "Examples:"
    echo "  $0 all"
    echo "  $0 fast"
    echo "  $0 single setup"
}

# Main logic
case "${1:-help}" in
    "all")
        run_all
        ;;
    "fast")
        run_fast_only
        ;;
    "dependent")
        run_dependent_only
        ;;
    "single")
        run_single "$2"
        ;;
    "help"|*)
        show_help
        ;;
esac
