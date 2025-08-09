#!/bin/bash

# Generate Environment-Specific Amplify Configuration
# Creates amplify.yml files based on environment templates and variables

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${ENVIRONMENT:-"preview"}
PR_NUMBER=${PR_NUMBER:-""}
OUTPUT_FILE=${OUTPUT_FILE:-"amplify.yml"}
TEMPLATES_DIR="amplify-templates"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Function to print status messages
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${CYAN}ℹ${NC} $1"
}

print_debug() {
    if [[ "${DEBUG:-false}" == "true" ]]; then
        echo -e "${BLUE}🐛${NC} $1"
    fi
}

# Function to show usage
show_usage() {
    echo "Generate Environment-Specific Amplify Configuration"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --environment <env>         Target environment: preview|staging|production (default: preview)"
    echo "  --pr-number <number>        PR number for preview environments"
    echo "  --output-file <file>        Output file name (default: amplify.yml)"
    echo "  --validate-only             Only validate template, don't generate file"
    echo "  --list-templates            List available templates"
    echo "  --debug                     Enable debug output"
    echo "  --help                      Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  ENVIRONMENT                 Target environment"
    echo "  PR_NUMBER                   Pull request number"
    echo "  OUTPUT_FILE                 Output file name"
    echo "  DEBUG                       Enable debug mode"
    echo ""
    echo "Examples:"
    echo "  $0 --environment preview --pr-number 123"
    echo "  $0 --environment staging --output-file amplify.staging.yml"
    echo "  $0 --environment production"
}

# Function to list available templates
list_templates() {
    print_info "Available Amplify configuration templates:"
    echo ""
    
    local templates_path="$PROJECT_DIR/$TEMPLATES_DIR"
    
    if [[ -d "$templates_path" ]]; then
        for template in "$templates_path"/*.yml; do
            if [[ -f "$template" ]]; then
                local template_name=$(basename "$template" .yml)
                local template_env=$(echo "$template_name" | sed 's/amplify\.//')
                
                echo "  📄 $template_env"
                echo "     File: $template"
                
                # Extract description from template if available
                local description=$(grep -m 1 "^# " "$template" | sed 's/^# //' || echo "")
                if [[ -n "$description" ]]; then
                    echo "     Description: $description"
                fi
                echo ""
            fi
        done
    else
        print_error "Templates directory not found: $templates_path"
        return 1
    fi
}

# Function to validate template file
validate_template() {
    local template_file="$1"
    
    print_debug "Validating template: $template_file"
    
    if [[ ! -f "$template_file" ]]; then
        print_error "Template file not found: $template_file"
        return 1
    fi
    
    # Basic YAML syntax validation
    if command -v yq &> /dev/null; then
        if yq eval '.' "$template_file" > /dev/null 2>&1; then
            print_debug "YAML syntax validation passed"
        else
            print_error "YAML syntax validation failed"
            return 1
        fi
    elif command -v python3 &> /dev/null; then
        if python3 -c "import yaml; yaml.safe_load(open('$template_file'))" 2>/dev/null; then
            print_debug "YAML syntax validation passed (Python)"
        else
            print_error "YAML syntax validation failed (Python)"
            return 1
        fi
    else
        print_warning "No YAML validator found (yq or python3), skipping syntax validation"
    fi
    
    # Check for required sections
    local required_sections=("version" "frontend")
    
    for section in "${required_sections[@]}"; do
        if grep -q "^${section}:" "$template_file"; then
            print_debug "Required section found: $section"
        else
            print_error "Required section missing: $section"
            return 1
        fi
    done
    
    print_status "Template validation passed"
    return 0
}

# Function to substitute environment variables in template
substitute_variables() {
    local template_file="$1"
    local output_file="$2"
    
    print_debug "Substituting variables in template"
    
    # Create a temporary file for processing
    local temp_file=$(mktemp)
    
    # Copy template to temp file
    cp "$template_file" "$temp_file"
    
    # Set default environment variables if not already set
    export AMPLIFY_ENVIRONMENT_NAME="${ENVIRONMENT}"
    export VITE_APP_ENV="${ENVIRONMENT}"
    
    # Set PR-specific variables for preview environments
    if [[ "$ENVIRONMENT" == "preview" && -n "$PR_NUMBER" ]]; then
        export VITE_PR_NUMBER="$PR_NUMBER"
        export VITE_APP_ENV="pr-${PR_NUMBER}"
        export AMPLIFY_ENVIRONMENT_NAME="pr-${PR_NUMBER}"
    fi
    
    # Set build metadata
    export VITE_BUILD_TIMESTAMP="${VITE_BUILD_TIMESTAMP:-$(date -u '+%Y-%m-%d %H:%M:%S UTC')}"
    export VITE_BUILD_COMMIT="${VITE_BUILD_COMMIT:-${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || echo "unknown")}}"
    export VITE_BUILD_BRANCH="${VITE_BUILD_BRANCH:-${GITHUB_REF_NAME:-$(git branch --show-current 2>/dev/null || echo "unknown")}}"
    
    # Substitute environment variables
    envsubst < "$temp_file" > "$output_file"
    
    # Clean up
    rm -f "$temp_file"
    
    print_debug "Variable substitution completed"
}

# Function to generate configuration
generate_configuration() {
    local environment="$1"
    local output_file="$2"
    
    print_info "Generating Amplify configuration for environment: $environment"
    
    # Determine template file
    local template_file="$PROJECT_DIR/$TEMPLATES_DIR/amplify.${environment}.yml"
    
    # Fallback to base template if environment-specific template doesn't exist
    if [[ ! -f "$template_file" ]]; then
        print_warning "Environment-specific template not found: $template_file"
        template_file="$PROJECT_DIR/$TEMPLATES_DIR/amplify.base.yml"
        
        if [[ ! -f "$template_file" ]]; then
            print_error "Base template not found: $template_file"
            return 1
        fi
        
        print_info "Using base template: $template_file"
    else
        print_info "Using environment template: $template_file"
    fi
    
    # Validate template
    if ! validate_template "$template_file"; then
        return 1
    fi
    
    # Generate output file path
    local full_output_path="$PROJECT_DIR/$output_file"
    
    # Substitute variables and generate configuration
    substitute_variables "$template_file" "$full_output_path"
    
    # Validate generated configuration
    if ! validate_template "$full_output_path"; then
        print_error "Generated configuration validation failed"
        return 1
    fi
    
    print_status "Configuration generated successfully: $full_output_path"
    
    # Display configuration summary
    echo ""
    print_info "Configuration Summary:"
    echo "  Environment: $environment"
    echo "  Template: $template_file"
    echo "  Output: $full_output_path"
    echo "  Size: $(wc -l < "$full_output_path") lines"
    
    if [[ "$environment" == "preview" && -n "$PR_NUMBER" ]]; then
        echo "  PR Number: $PR_NUMBER"
    fi
    
    echo ""
    return 0
}

# Function to display configuration preview
display_configuration_preview() {
    local config_file="$1"
    
    print_info "Configuration Preview:"
    echo ""
    
    # Display with syntax highlighting if available
    if command -v bat &> /dev/null; then
        bat --style=plain --language=yaml "$config_file" | head -50
    elif command -v highlight &> /dev/null; then
        highlight -O ansi --syntax=yaml "$config_file" | head -50
    else
        head -50 "$config_file"
    fi
    
    local total_lines=$(wc -l < "$config_file")
    if [[ $total_lines -gt 50 ]]; then
        echo ""
        print_info "... (showing first 50 lines of $total_lines total)"
    fi
    
    echo ""
}

# Main function
main() {
    local validate_only="false"
    local list_templates_only="false"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --pr-number)
                PR_NUMBER="$2"
                shift 2
                ;;
            --output-file)
                OUTPUT_FILE="$2"
                shift 2
                ;;
            --validate-only)
                validate_only="true"
                shift
                ;;
            --list-templates)
                list_templates_only="true"
                shift
                ;;
            --debug)
                DEBUG="true"
                shift
                ;;
            --help|-h)
                show_usage
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    print_info "🔧 Amplify Configuration Generator"
    echo "=================================="
    echo "Environment: $ENVIRONMENT"
    echo "Output File: $OUTPUT_FILE"
    echo "PR Number: ${PR_NUMBER:-"N/A"}"
    echo ""
    
    # List templates mode
    if [[ "$list_templates_only" == "true" ]]; then
        list_templates
        exit 0
    fi
    
    # Validate environment
    case "$ENVIRONMENT" in
        "preview"|"staging"|"production")
            print_debug "Environment validation passed: $ENVIRONMENT"
            ;;
        *)
            print_error "Invalid environment: $ENVIRONMENT"
            print_info "Valid environments: preview, staging, production"
            exit 1
            ;;
    esac
    
    # Validate PR number for preview environments
    if [[ "$ENVIRONMENT" == "preview" && -z "$PR_NUMBER" ]]; then
        print_warning "PR number not specified for preview environment"
        print_info "Preview environments typically require a PR number"
    fi
    
    # Generate configuration
    if generate_configuration "$ENVIRONMENT" "$OUTPUT_FILE"; then
        # Display preview if in debug mode
        if [[ "${DEBUG:-false}" == "true" ]]; then
            display_configuration_preview "$PROJECT_DIR/$OUTPUT_FILE"
        fi
        
        print_status "🎉 Amplify configuration generation completed successfully!"
        print_info "Configuration file: $PROJECT_DIR/$OUTPUT_FILE"
        print_info "Ready for Amplify deployment"
    else
        print_error "❌ Configuration generation failed"
        exit 1
    fi
}

# Validate required tools
if ! command -v envsubst &> /dev/null; then
    print_error "envsubst not found. Please install gettext package."
    exit 1
fi

# Run main function
main "$@"
