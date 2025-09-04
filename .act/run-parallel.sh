#!/bin/bash

# Parallel Job Runner for act
# This script runs GitHub Actions jobs in parallel containers for faster execution

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
WORKFLOW_FILE=".github/workflows/hygiene-checks.yml"
SECRETS_FILE=".act/secrets"
PARALLEL_JOBS=4

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to run a single job
run_job() {
    local job_name="$1"
    local container_suffix="$2"

    print_status "Starting job: $job_name (Container: $container_suffix)"

    # Run the job with parallel execution support
    if act -W "$WORKFLOW_FILE" --secret-file "$SECRETS_FILE" --env ACT_LOCAL=true -j "$job_name"; then
        print_success "Job $job_name completed successfully"
        return 0
    else
        print_error "Job $job_name failed"
        return 1
    fi
}

# Function to run jobs in parallel
run_parallel() {
    local jobs_to_run=("$@")
    local pids=()
    local failed_jobs=()

    print_status "Starting ${#jobs_to_run[@]} jobs in parallel..."

    # Start jobs in background
    for i in "${!jobs_to_run[@]}"; do
        local job="${jobs_to_run[$i]}"
        local suffix=$((i + 1))

        run_job "$job" "$suffix" &
        pids[$i]=$!
        print_status "Started $job (PID: ${pids[$i]})"
    done

    # Wait for all jobs to complete
    for i in "${!jobs_to_run[@]}"; do
        local job="${jobs_to_run[$i]}"
        local pid=${pids[$i]}

        if ! wait "$pid"; then
            failed_jobs+=("$job")
        fi
    done

    # Report results
    if [ ${#failed_jobs[@]} -eq 0 ]; then
        print_success "All ${#jobs_to_run[@]} jobs completed successfully!"
        return 0
    else
        print_error "The following jobs failed: ${failed_jobs[*]}"
        return 1
    fi
}

# Function to show available jobs
show_jobs() {
    echo "Available jobs in $WORKFLOW_FILE:"
    echo

    # Extract job names from workflow
    act -W "$WORKFLOW_FILE" --list | grep -E "^\s*[0-9]+\s+" | awk '{print "  " $2 ": " $3}'

    echo
    echo "Job Dependencies:"
    echo "  setup     → build, lint, test"
    echo "  (none)    → lint-md, actionlint, gitleaks"
}

# Function to run all jobs respecting dependencies
run_all_respecting_dependencies() {
    print_status "Running all jobs with dependency management..."

    # Stage 1: Jobs with no dependencies (can run in parallel)
    print_status "Stage 1: Running independent jobs in parallel..."
    local stage1_jobs=("lint-md" "actionlint" "gitleaks")

    if ! run_parallel "${stage1_jobs[@]}"; then
        print_error "Stage 1 failed, stopping execution"
        return 1
    fi

    # Stage 2: Jobs that depend on setup (can run in parallel after setup completes)
    print_status "Stage 2: Running setup job..."
    if ! run_job "setup" "main"; then
        print_error "Setup job failed, cannot proceed with dependent jobs"
        return 1
    fi

    print_status "Stage 2: Running dependent jobs in parallel..."
    local stage2_jobs=("build" "lint" "test")

    if ! run_parallel "${stage2_jobs[@]}"; then
        print_error "Stage 2 failed"
        return 1
    fi

    print_success "All jobs completed successfully!"
}

# Function to run specific jobs
run_specific_jobs() {
    local jobs=("$@")

    if [ ${#jobs[@]} -eq 0 ]; then
        print_error "No jobs specified. Use --jobs \"job1,job2,job3\""
        return 1
    fi

    print_status "Running specific jobs: ${jobs[*]}"
    run_parallel "${jobs[@]}"
}

# Main script logic
main() {
    local command="$1"
    shift

    case "$command" in
        "all")
            run_all_respecting_dependencies
            ;;
        "jobs")
            if [ $# -eq 0 ]; then
                print_error "Please specify jobs to run: --jobs \"job1,job2\""
                exit 1
            fi
            # Split comma-separated jobs
            IFS=',' read -ra JOBS <<< "$1"
            run_specific_jobs "${JOBS[@]}"
            ;;
        "list")
            show_jobs
            ;;
        "single")
            if [ $# -lt 1 ]; then
                print_error "Please specify a job name: --single job-name"
                exit 1
            fi
            run_job "$1" "single"
            ;;
        "help"|*)
            echo "Parallel Job Runner for GitHub Actions (act)"
            echo
            echo "Usage:"
            echo "  $0 all                    - Run all jobs respecting dependencies"
            echo "  $0 jobs \"job1,job2\"       - Run specific jobs in parallel"
            echo "  $0 single job-name        - Run a single job"
            echo "  $0 list                   - List all available jobs"
            echo "  $0 help                   - Show this help"
            echo
            echo "Examples:"
            echo "  $0 all"
            echo "  $0 jobs \"lint-md,actionlint,gitleaks\""
            echo "  $0 single setup"
            echo
            echo "Current workflow: $WORKFLOW_FILE"
            echo "Secrets file: $SECRETS_FILE"
            ;;
    esac
}

# Run main function with all arguments
main "$@"
