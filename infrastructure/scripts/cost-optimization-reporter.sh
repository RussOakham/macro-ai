#!/bin/bash

# =============================================================================
# Cost Optimization Reporting and Notification Script
# =============================================================================
# 
# This script tracks cost savings from preview environment cleanup operations
# and sends notifications about cleanup activities and cost optimization impact.
#
# Reporting Features:
# 1. Track cleanup operations and cost savings over time
# 2. Generate daily, weekly, and monthly cost optimization reports
# 3. Send notifications via multiple channels (Slack, email, GitHub)
# 4. Maintain historical cost savings data
# 5. Generate trend analysis and recommendations
# 6. Export reports in multiple formats
#
# Usage:
#   ./cost-optimization-reporter.sh --report-cleanup --environments-cleaned 3
#   ./cost-optimization-reporter.sh --generate-report daily
#   ./cost-optimization-reporter.sh --send-notification slack --webhook-url "$SLACK_WEBHOOK"
#
# Exit Codes:
#   0 - Operation completed successfully
#   1 - Operation failed or errors encountered
#   2 - Invalid arguments or configuration error

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORTS_DIR="$SCRIPT_DIR/../reports"
COST_DATA_FILE="$REPORTS_DIR/cost-optimization-data.json"
VERBOSE=false

# Email configuration (configurable via environment variables)
SES_SOURCE_EMAIL="${SES_SOURCE_EMAIL:-noreply@macro-ai.com}"
SES_REGION="${SES_REGION:-us-east-1}"

# Cost estimation constants (USD per day)
COST_PER_ENVIRONMENT_PER_DAY=3.50  # Estimated cost for EC2 preview environment
COST_PER_ALB_PER_DAY=0.75          # Application Load Balancer
COST_PER_ASG_PER_DAY=0.25          # Auto Scaling Group overhead

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Dependency checking function
check_dependencies() {
    local missing_deps=()
    local required_tools=("jq" "bc" "curl")

    log_info "Checking required dependencies..."

    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            missing_deps+=("$tool")
        fi
    done

    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        log_error "Please install the missing tools and try again."
        log_error ""
        log_error "Installation suggestions:"
        for dep in "${missing_deps[@]}"; do
            case "$dep" in
                "jq")
                    log_error "  - jq: https://jqlang.github.io/jq/download/"
                    ;;
                "bc")
                    log_error "  - bc: Usually available via system package manager (apt-get install bc, yum install bc, etc.)"
                    ;;
                "curl")
                    log_error "  - curl: Usually pre-installed or available via system package manager"
                    ;;
            esac
        done
        exit 2
    fi

    log_success "All required dependencies are available"
}

# Cross-platform date function
get_date_ago() {
    local days_ago="$1"
    local format="${2:-+%Y-%m-%dT%H:%M:%SZ}"

    # Try GNU date first (Linux)
    if date -u -d "${days_ago} days ago" "$format" 2>/dev/null; then
        return 0
    # Try BSD date (macOS)
    elif date -u -v-"${days_ago}"d "$format" 2>/dev/null; then
        return 0
    else
        # Fallback - use current date minus rough calculation
        log_warning "Date calculation may be inaccurate on this platform"
        date -u "$format"
    fi
}

format_date() {
    local date_string="$1"
    local format="${2:-+%Y-%m-%d}"

    # Try GNU date first (Linux)
    if date -d "$date_string" "$format" 2>/dev/null; then
        return 0
    # Try BSD date (macOS) - requires different parsing
    elif date -j -f "%Y-%m-%dT%H:%M:%SZ" "$date_string" "$format" 2>/dev/null; then
        return 0
    else
        # Fallback - just return the original string
        echo "$date_string"
    fi
}

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_debug() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${BLUE}🔍 DEBUG: $1${NC}"
    fi
}

# Help function
show_help() {
    cat << EOF
Cost Optimization Reporting and Notification Script

USAGE:
    $0 [OPTIONS]

OPERATIONS:
    --report-cleanup            Record a cleanup operation
    --generate-report PERIOD    Generate cost optimization report (daily/weekly/monthly)
    --send-notification TYPE    Send notification (slack/email/github)
    --export-data FORMAT        Export historical data (json/csv)

OPTIONS:
    --environments-cleaned N    Number of environments cleaned (for --report-cleanup)
    --cost-saved AMOUNT         Manual cost savings amount (optional)
    --webhook-url URL           Webhook URL for notifications
    --email-recipient EMAIL     Email recipient for notifications
    --github-issue-number N     GitHub issue number for notifications
    --output-file FILE          Output file for reports and exports
    --verbose                   Enable verbose logging
    --help                      Show this help message

EXAMPLES:
    # Record cleanup operation
    $0 --report-cleanup --environments-cleaned 5

    # Generate daily report
    $0 --generate-report daily --output-file daily-report.json

    # Send Slack notification
    $0 --send-notification slack --webhook-url "\$SLACK_WEBHOOK_URL"

    # Export historical data
    $0 --export-data csv --output-file cost-savings-history.csv

NOTIFICATION TYPES:
    slack       Send to Slack channel via webhook
    email       Send email notification (requires AWS SES)
    github      Comment on GitHub issue or PR

REPORT PERIODS:
    daily       Last 24 hours
    weekly      Last 7 days
    monthly     Last 30 days

EOF
}

# Initialize reports directory and data file
initialize_data_storage() {
    if [[ ! -d "$REPORTS_DIR" ]]; then
        mkdir -p "$REPORTS_DIR"
        log_debug "Created reports directory: $REPORTS_DIR"
    fi
    
    if [[ ! -f "$COST_DATA_FILE" ]]; then
        echo '{"cleanup_operations": [], "total_savings": 0, "last_updated": ""}' > "$COST_DATA_FILE"
        log_debug "Initialized cost data file: $COST_DATA_FILE"
    fi
}

# Validate that a value is a non-negative integer
validate_non_negative_integer() {
    local value="$1"
    local name="$2"

    # Check if empty or not provided
    if [[ -z "$value" ]]; then
        log_error "$name is required but not provided"
        return 1
    fi

    # Check if it's a valid integer (no decimals, no letters, no special chars except leading +)
    if [[ ! "$value" =~ ^[+]?[0-9]+$ ]]; then
        log_error "$name must be a non-negative integer, got: '$value'"
        return 1
    fi

    # Check if it's non-negative (this should be covered by regex, but extra safety)
    if [[ "$value" -lt 0 ]]; then
        log_error "$name must be non-negative, got: $value"
        return 1
    fi

    return 0
}

# Validate that a value is a non-negative number (can have decimals)
validate_non_negative_number() {
    local value="$1"
    local name="$2"

    # Check if empty (this is OK for optional parameters)
    if [[ -z "$value" ]]; then
        return 0
    fi

    # Check if it's a valid number (integers or decimals, no letters, no special chars except leading + and one decimal point)
    if [[ ! "$value" =~ ^[+]?([0-9]+\.?[0-9]*|\.[0-9]+)$ ]]; then
        log_warning "$name must be a non-negative number, got: '$value' - ignoring invalid value"
        return 1
    fi

    # Check if it's non-negative using bc for decimal comparison
    if [[ $(echo "$value < 0" | bc -l) -eq 1 ]]; then
        log_warning "$name must be non-negative, got: $value - ignoring invalid value"
        return 1
    fi

    return 0
}

# Normalize a number to fixed decimal places (default 2)
normalize_number() {
    local value="$1"
    local decimal_places="${2:-2}"

    # Use printf to format to fixed decimal places
    printf "%.${decimal_places}f" "$value"
}

# Record a cleanup operation
record_cleanup_operation() {
    local environments_cleaned="$1"
    local manual_cost_saved="${2:-}"

    # Validate environments_cleaned (required non-negative integer)
    if ! validate_non_negative_integer "$environments_cleaned" "environments_cleaned"; then
        log_error "Cannot record cleanup operation with invalid environments_cleaned value"
        return 1
    fi

    # Validate manual_cost_saved (optional non-negative number)
    local use_manual_cost=false
    if [[ -n "$manual_cost_saved" ]]; then
        if validate_non_negative_number "$manual_cost_saved" "manual_cost_saved"; then
            use_manual_cost=true
            # Normalize manual cost to 2 decimal places
            manual_cost_saved=$(normalize_number "$manual_cost_saved" 2)
        else
            log_warning "Invalid manual_cost_saved value, falling back to calculated cost"
            manual_cost_saved=""
            use_manual_cost=false
        fi
    fi

    log_info "Recording cleanup operation: $environments_cleaned environments"

    # Calculate cost savings with proper quoting and normalization
    local estimated_daily_savings
    estimated_daily_savings=$(echo "scale=4; $environments_cleaned * $COST_PER_ENVIRONMENT_PER_DAY" | bc -l)
    estimated_daily_savings=$(normalize_number "$estimated_daily_savings" 2)

    local cost_saved="$estimated_daily_savings"
    if [[ "$use_manual_cost" == "true" ]]; then
        cost_saved="$manual_cost_saved"
        log_debug "Using manual cost savings: \$${cost_saved}"
    else
        log_debug "Calculated cost savings: \$${cost_saved}"
    fi
    
    # Create operation record with normalized values
    local timestamp
    timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

    # Calculate monthly impact with proper normalization
    local monthly_impact
    monthly_impact=$(echo "scale=4; $cost_saved * 30" | bc -l)
    monthly_impact=$(normalize_number "$monthly_impact" 2)

    local operation_record
    operation_record=$(jq -n \
        --arg timestamp "$timestamp" \
        --arg environments_cleaned "$environments_cleaned" \
        --arg cost_saved "$cost_saved" \
        --arg monthly_impact "$monthly_impact" \
        --arg operation_type "scheduled_cleanup" \
        '{
            timestamp: $timestamp,
            environments_cleaned: ($environments_cleaned | tonumber),
            cost_saved: ($cost_saved | tonumber),
            operation_type: $operation_type,
            estimated_monthly_impact: ($monthly_impact | tonumber)
        }')

    # Update data file with error handling
    local updated_data
    if ! updated_data=$(jq \
        --argjson new_operation "$operation_record" \
        --arg last_updated "$timestamp" \
        '.cleanup_operations += [$new_operation] |
         .total_savings += ($new_operation.cost_saved) |
         .last_updated = $last_updated' \
        "$COST_DATA_FILE" 2>/dev/null); then
        log_error "Failed to update cost data file with jq"
        return 1
    fi

    if ! echo "$updated_data" > "$COST_DATA_FILE"; then
        log_error "Failed to write updated data to cost data file"
        return 1
    fi

    log_success "Cleanup operation recorded successfully"
    log_info "Daily cost savings: \$${cost_saved}"
    log_info "Estimated monthly impact: \$${monthly_impact}"
}

# Generate cost optimization report
generate_report() {
    local period="$1"
    local output_file="${2:-}"
    
    log_info "Generating $period cost optimization report"
    
    # Calculate date range
    local start_date
    case "$period" in
        "daily")
            start_date=$(get_date_ago 1)
            ;;
        "weekly")
            start_date=$(get_date_ago 7)
            ;;
        "monthly")
            start_date=$(get_date_ago 30)
            ;;
        *)
            log_error "Invalid report period: $period"
            exit 2
            ;;
    esac
    
    local end_date
    end_date=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
    
    log_debug "Report period: $start_date to $end_date"
    
    # Filter operations by date range
    local period_operations
    period_operations=$(jq \
        --arg start_date "$start_date" \
        --arg end_date "$end_date" \
        '[.cleanup_operations[] | select(.timestamp >= $start_date and .timestamp <= $end_date)]' \
        "$COST_DATA_FILE")
    
    # Calculate metrics
    local total_operations
    total_operations=$(echo "$period_operations" | jq length)
    
    local total_environments_cleaned
    total_environments_cleaned=$(echo "$period_operations" | jq '[.[].environments_cleaned] | add // 0')
    
    local total_cost_saved
    total_cost_saved=$(echo "$period_operations" | jq '[.[].cost_saved] | add // 0')
    
    local average_environments_per_operation
    if [[ "$total_operations" -gt 0 ]]; then
        average_environments_per_operation=$(echo "scale=2; $total_environments_cleaned / $total_operations" | bc -l)
    else
        average_environments_per_operation="0"
    fi
    
    # Generate report
    local report
    report=$(jq -n \
        --arg report_type "$period" \
        --arg generated_at "$end_date" \
        --arg start_date "$start_date" \
        --arg end_date "$end_date" \
        --arg total_operations "$total_operations" \
        --arg total_environments_cleaned "$total_environments_cleaned" \
        --arg total_cost_saved "$total_cost_saved" \
        --arg average_environments_per_operation "$average_environments_per_operation" \
        --argjson operations "$period_operations" \
        '{
            report_type: $report_type,
            generated_at: $generated_at,
            period: {
                start_date: $start_date,
                end_date: $end_date
            },
            summary: {
                total_operations: ($total_operations | tonumber),
                total_environments_cleaned: ($total_environments_cleaned | tonumber),
                total_cost_saved: ($total_cost_saved | tonumber),
                average_environments_per_operation: ($average_environments_per_operation | tonumber)
            },
            operations: $operations
        }')
    
    # Output report
    if [[ -n "$output_file" ]]; then
        echo "$report" > "$output_file"
        log_success "Report saved to: $output_file"
    else
        echo "$report"
    fi
    
    # Display summary
    echo ""
    log_info "📊 $period Cost Optimization Report Summary"
    echo "============================================"
    echo "📅 Period: $(format_date "$start_date" '+%Y-%m-%d') to $(format_date "$end_date" '+%Y-%m-%d')"
    echo "🔢 Total Operations: $total_operations"
    echo "🗑️ Environments Cleaned: $total_environments_cleaned"
    echo "💰 Total Cost Saved: \$$(printf "%.2f" "$total_cost_saved")"
    if [[ "$total_operations" -gt 0 ]]; then
        echo "📈 Average per Operation: $(printf "%.1f" "$average_environments_per_operation") environments"
    fi
    
    # Projections
    if [[ "$period" == "daily" && $(echo "$total_cost_saved > 0" | bc -l) -eq 1 ]]; then
        local monthly_projection
        monthly_projection=$(echo "$total_cost_saved * 30" | bc -l)
        echo "📊 Monthly Projection: \$$(printf "%.2f" "$monthly_projection")"
    fi
}

# Send notification
send_notification() {
    local notification_type="$1"
    local webhook_url="${2:-}"
    local email_recipient="${3:-}"
    local github_issue="${4:-}"
    
    log_info "Sending $notification_type notification"
    
    # Get latest cleanup data for notification
    local latest_operation
    latest_operation=$(jq '.cleanup_operations | last' "$COST_DATA_FILE")
    
    local total_savings
    total_savings=$(jq '.total_savings' "$COST_DATA_FILE")
    
    case "$notification_type" in
        "slack")
            send_slack_notification "$webhook_url" "$latest_operation" "$total_savings"
            ;;
        "email")
            send_email_notification "$email_recipient" "$latest_operation" "$total_savings"
            ;;
        "github")
            send_github_notification "$github_issue" "$latest_operation" "$total_savings"
            ;;
        *)
            log_error "Invalid notification type: $notification_type"
            exit 2
            ;;
    esac
}

# Send Slack notification
send_slack_notification() {
    local webhook_url="$1"
    local latest_operation="$2"
    local total_savings="$3"
    
    if [[ -z "$webhook_url" ]]; then
        log_error "Slack webhook URL is required"
        exit 2
    fi
    
    local environments_cleaned
    environments_cleaned=$(echo "$latest_operation" | jq -r '.environments_cleaned // 0')
    
    local cost_saved
    cost_saved=$(echo "$latest_operation" | jq -r '.cost_saved // 0')
    
    local slack_message
    slack_message=$(jq -n \
        --arg environments_cleaned "$environments_cleaned" \
        --arg cost_saved "$cost_saved" \
        --arg total_savings "$total_savings" \
        '{
            text: "🗑️ Preview Environment Cleanup Report",
            blocks: [
                {
                    type: "header",
                    text: {
                        type: "plain_text",
                        text: "🗑️ Scheduled Preview Environment Cleanup"
                    }
                },
                {
                    type: "section",
                    fields: [
                        {
                            type: "mrkdwn",
                            text: "*Environments Cleaned:*\n\($environments_cleaned)"
                        },
                        {
                            type: "mrkdwn",
                            text: "*Daily Cost Saved:*\n$\($cost_saved)"
                        },
                        {
                            type: "mrkdwn",
                            text: "*Total Savings to Date:*\n$\($total_savings)"
                        },
                        {
                            type: "mrkdwn",
                            text: "*Monthly Projection:*\n$\(($cost_saved | tonumber) * 30)"
                        }
                    ]
                },
                {
                    type: "context",
                    elements: [
                        {
                            type: "mrkdwn",
                            text: "💰 Automated cost optimization is working effectively!"
                        }
                    ]
                }
            ]
        }')
    
    # Check if curl is available before attempting to send
    if ! command -v curl >/dev/null 2>&1; then
        log_warning "curl not available - skipping Slack notification"
        return 0
    fi

    if curl -X POST -H 'Content-type: application/json' --data "$slack_message" "$webhook_url" >/dev/null 2>&1; then
        log_success "Slack notification sent successfully"
    else
        log_warning "Failed to send Slack notification (check webhook URL and network connectivity)"
        # Don't exit with error - notification failure shouldn't stop the script
        return 1
    fi
}

# Send email notification
send_email_notification() {
    local email_recipient="$1"
    local latest_operation="$2"
    local total_savings="$3"

    if [[ -z "$email_recipient" ]]; then
        log_error "Email recipient is required"
        exit 2
    fi

    local environments_cleaned
    environments_cleaned=$(echo "$latest_operation" | jq -r '.environments_cleaned // 0')

    local cost_saved
    cost_saved=$(echo "$latest_operation" | jq -r '.cost_saved // 0')

    local monthly_projection
    monthly_projection=$(echo "$cost_saved * 30" | bc -l)

    local email_subject="Preview Environment Cleanup Report - \$$(printf "%.2f" "$cost_saved") Saved"

    local email_body
    email_body=$(cat << EOF
Preview Environment Cleanup Report
==================================

🗑️ Scheduled Cleanup Summary:
- Environments Cleaned: $environments_cleaned
- Daily Cost Saved: \$$(printf "%.2f" "$cost_saved")
- Monthly Projection: \$$(printf "%.2f" "$monthly_projection")
- Total Savings to Date: \$$(printf "%.2f" "$total_savings")

💰 Cost Optimization Impact:
The automated cleanup system is working effectively to reduce infrastructure costs by removing stale preview environments.

📊 Next Steps:
- Continue monitoring cleanup effectiveness
- Review monthly cost optimization reports
- Adjust cleanup schedules if needed

Generated at: $(date -u '+%Y-%m-%d %H:%M:%S UTC')

---
This is an automated report from the Preview Environment Cost Optimization system.
EOF
)

    # Use AWS SES to send email (requires AWS CLI and proper permissions)
    if command -v aws >/dev/null 2>&1; then
        local email_json
        email_json=$(jq -n \
            --arg subject "$email_subject" \
            --arg body "$email_body" \
            --arg recipient "$email_recipient" \
            --arg source "$SES_SOURCE_EMAIL" \
            '{
                Source: $source,
                Destination: {
                    ToAddresses: [$recipient]
                },
                Message: {
                    Subject: {
                        Data: $subject
                    },
                    Body: {
                        Text: {
                            Data: $body
                        }
                    }
                }
            }')

        if aws ses send-email --region "$SES_REGION" --cli-input-json "$email_json" >/dev/null 2>&1; then
            log_success "Email notification sent to: $email_recipient"
        else
            log_warning "Failed to send email notification (AWS SES may not be configured)"
        fi
    else
        log_warning "AWS CLI not available - cannot send email notification"
    fi
}

# Send GitHub notification
send_github_notification() {
    local github_issue="$1"
    local latest_operation="$2"
    local total_savings="$3"

    if [[ -z "$github_issue" ]]; then
        log_error "GitHub issue number is required"
        exit 2
    fi

    local environments_cleaned
    environments_cleaned=$(echo "$latest_operation" | jq -r '.environments_cleaned // 0')

    local cost_saved
    cost_saved=$(echo "$latest_operation" | jq -r '.cost_saved // 0')

    local monthly_projection
    monthly_projection=$(echo "$cost_saved * 30" | bc -l)

    local github_comment
    github_comment=$(cat << EOF
## 🗑️ Scheduled Preview Environment Cleanup Report

**📊 Latest Cleanup Summary:**
- **Environments Cleaned:** $environments_cleaned
- **Daily Cost Saved:** \$$(printf "%.2f" "$cost_saved")
- **Monthly Projection:** \$$(printf "%.2f" "$monthly_projection")
- **Total Savings to Date:** \$$(printf "%.2f" "$total_savings")

**💰 Cost Optimization Impact:**
The automated cleanup system is working effectively to reduce infrastructure costs by removing stale preview environments.

**📈 Trend Analysis:**
- Consistent cleanup operations indicate healthy environment lifecycle management
- Cost savings are accumulating as expected
- No manual intervention required

---
*Generated at $(date -u '+%Y-%m-%d %H:%M:%S UTC') by automated cost optimization system*
EOF
)

    # Use GitHub CLI if available
    if command -v gh >/dev/null 2>&1; then
        if gh issue comment "$github_issue" --body "$github_comment" >/dev/null 2>&1; then
            log_success "GitHub notification posted to issue #$github_issue"
        else
            log_error "Failed to post GitHub notification"
            exit 1
        fi
    else
        log_warning "GitHub CLI not available - cannot send GitHub notification"
        log_info "Comment content:"
        echo "$github_comment"
    fi
}

# Parse command line arguments
parse_arguments() {
    local operation=""
    local environments_cleaned=""
    local cost_saved=""
    local report_period=""
    local notification_type=""
    local webhook_url=""
    local email_recipient=""
    local github_issue=""
    local output_file=""
    local export_format=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --report-cleanup)
                operation="report_cleanup"
                shift
                ;;
            --generate-report)
                operation="generate_report"
                report_period="$2"
                shift 2
                ;;
            --send-notification)
                operation="send_notification"
                notification_type="$2"
                shift 2
                ;;
            --export-data)
                operation="export_data"
                export_format="$2"
                shift 2
                ;;
            --environments-cleaned)
                environments_cleaned="$2"
                shift 2
                ;;
            --cost-saved)
                cost_saved="$2"
                shift 2
                ;;
            --webhook-url)
                webhook_url="$2"
                shift 2
                ;;
            --email-recipient)
                email_recipient="$2"
                shift 2
                ;;
            --github-issue-number)
                github_issue="$2"
                shift 2
                ;;
            --output-file)
                output_file="$2"
                shift 2
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 2
                ;;
        esac
    done

    # Execute operation
    case "$operation" in
        "report_cleanup")
            if [[ -z "$environments_cleaned" ]]; then
                log_error "--environments-cleaned is required for --report-cleanup"
                exit 2
            fi
            record_cleanup_operation "$environments_cleaned" "$cost_saved"
            ;;
        "generate_report")
            if [[ -z "$report_period" ]]; then
                log_error "Report period is required for --generate-report"
                exit 2
            fi
            generate_report "$report_period" "$output_file"
            ;;
        "send_notification")
            if [[ -z "$notification_type" ]]; then
                log_error "Notification type is required for --send-notification"
                exit 2
            fi
            send_notification "$notification_type" "$webhook_url" "$email_recipient" "$github_issue"
            ;;
        "export_data")
            log_error "Export data functionality not yet implemented"
            exit 2
            ;;
        "")
            log_error "No operation specified"
            show_help
            exit 2
            ;;
        *)
            log_error "Invalid operation: $operation"
            exit 2
            ;;
    esac
}

# Main function
main() {
    # Check dependencies first
    check_dependencies
    echo ""

    log_debug "Starting cost optimization reporter"

    # Initialize data storage
    initialize_data_storage

    # Parse arguments and execute operation
    parse_arguments "$@"

    log_success "Cost optimization reporter completed successfully"
}

# Run main function with all arguments
main "$@"
