#!/bin/bash

# Validate Amplify Configuration Files
# Comprehensive validation for amplify.yml configurations

set -Eeuo pipefail
IFS=$'\n\t'

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
CONFIG_FILE=${CONFIG_FILE:-"amplify.yml"}
ENVIRONMENT=${ENVIRONMENT:-""}
STRICT_MODE=${STRICT_MODE:-"false"}

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

print_test_header() {
    echo -e "${BLUE}🧪 $1${NC}"
    echo "=================================="
}

# Function to show usage
show_usage() {
    echo "Validate Amplify Configuration Files"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --config-file <file>        Amplify configuration file to validate (default: amplify.yml)"
    echo "  --environment <env>         Expected environment (preview|staging|production)"
    echo "  --strict                    Enable strict validation mode"
    echo "  --all-templates             Validate all template files"
    echo "  --help                      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                          # Validate default amplify.yml"
    echo "  $0 --config-file amplify.staging.yml --environment staging"
    echo "  $0 --all-templates          # Validate all template files"
    echo "  $0 --strict                 # Enable strict validation"
}

# Function to validate YAML syntax
validate_yaml_syntax() {
    local config_file="$1"
    
    print_info "Validating YAML syntax..."
    
    if [[ ! -f "$config_file" ]]; then
        print_error "Configuration file not found: $config_file"
        return 1
    fi
    
    # Try yq first (most reliable)
    if command -v yq &> /dev/null; then
        if yq eval '.' "$config_file" > /dev/null 2>&1; then
            print_status "YAML syntax validation passed (yq)"
            return 0
        else
            print_error "YAML syntax validation failed (yq)"
            return 1
        fi
    fi
    
    # Fallback to Python
    if command -v python3 &> /dev/null; then
        if python3 -c "import yaml; yaml.safe_load(open('$config_file'))" 2>/dev/null; then
            print_status "YAML syntax validation passed (Python)"
            return 0
        else
            print_error "YAML syntax validation failed (Python)"
            return 1
        fi
    fi
    
    # Fallback to basic checks
    print_warning "No YAML validator found, performing basic checks..."
    
    # Check for basic YAML structure
    if grep -q "^version:" "$config_file" && grep -q "^frontend:" "$config_file"; then
        print_status "Basic YAML structure validation passed"
        return 0
    else
        print_error "Basic YAML structure validation failed"
        return 1
    fi
}

# Function to validate required sections
validate_required_sections() {
    local config_file="$1"
    
    print_info "Validating required sections..."
    
    local required_sections=("version" "frontend")
    local optional_sections=("backend" "test")
    local validation_errors=0
    
    # Check required sections
    for section in "${required_sections[@]}"; do
        if grep -q "^${section}:" "$config_file"; then
            print_status "Required section found: $section"
        else
            print_error "Required section missing: $section"
            validation_errors=$((validation_errors + 1))
        fi
    done
    
    # Check optional sections
    for section in "${optional_sections[@]}"; do
        if grep -q "^${section}:" "$config_file"; then
            print_info "Optional section found: $section"
        fi
    done
    
    return $validation_errors
}

# Function to validate frontend configuration
validate_frontend_config() {
    local config_file="$1"
    
    print_info "Validating frontend configuration..."
    
    local validation_errors=0
    
    # Check for frontend phases
    if grep -A 20 "^frontend:" "$config_file" | grep -q "phases:"; then
        print_status "Frontend phases section found"
        
        # Check for preBuild phase
        if grep -A 30 "phases:" "$config_file" | grep -q "preBuild:"; then
            print_status "preBuild phase found"
        else
            print_warning "preBuild phase not found"
        fi
        
        # Check for build phase
        if grep -A 30 "phases:" "$config_file" | grep -q "build:"; then
            print_status "build phase found"
        else
            print_error "build phase missing"
            validation_errors=$((validation_errors + 1))
        fi
    else
        print_error "Frontend phases section missing"
        validation_errors=$((validation_errors + 1))
    fi
    
    # Check for artifacts configuration
    if grep -A 20 "^frontend:" "$config_file" | grep -q "artifacts:"; then
        print_status "Frontend artifacts configuration found"
        
        # Check for baseDirectory
        if grep -A 10 "artifacts:" "$config_file" | grep -q "baseDirectory:"; then
            print_status "Artifacts baseDirectory specified"
        else
            print_warning "Artifacts baseDirectory not specified"
        fi
    else
        print_warning "Frontend artifacts configuration not found"
    fi
    
    return $validation_errors
}

# Function to validate environment-specific settings
validate_environment_settings() {
    local config_file="$1"
    local expected_env="$2"
    
    if [[ -z "$expected_env" ]]; then
        print_info "No expected environment specified, skipping environment validation"
        return 0
    fi
    
    print_info "Validating environment-specific settings for: $expected_env"
    
    local validation_errors=0
    
    case "$expected_env" in
        "preview")
            # Check for preview-specific configurations
            if grep -q "VITE_PREVIEW_MODE" "$config_file"; then
                print_status "Preview mode configuration found"
            else
                print_warning "Preview mode configuration not found"
            fi
            
            if grep -q "VITE_PR_NUMBER" "$config_file"; then
                print_status "PR number configuration found"
            else
                print_warning "PR number configuration not found"
            fi
            ;;
            
        "staging")
            # Check for staging-specific configurations
            if grep -q "staging" "$config_file"; then
                print_status "Staging environment references found"
            else
                print_warning "Staging environment references not found"
            fi
            ;;
            
        "production")
            # Check for production-specific configurations
            if grep -q "production" "$config_file"; then
                print_status "Production environment references found"
            else
                print_warning "Production environment references not found"
            fi
            
            # Check that debug features are disabled
            if grep -q "VITE_ENABLE_DEBUG_LOGGING.*false" "$config_file"; then
                print_status "Debug logging disabled for production"
            else
                print_error "Debug logging should be disabled for production"
                validation_errors=$((validation_errors + 1))
            fi
            
            if grep -q "VITE_ENABLE_DEVTOOLS.*false" "$config_file"; then
                print_status "DevTools disabled for production"
            else
                print_error "DevTools should be disabled for production"
                validation_errors=$((validation_errors + 1))
            fi
            ;;
    esac
    
    return $validation_errors
}

# Function to validate security headers
validate_security_headers() {
    local config_file="$1"
    local environment="$2"
    
    print_info "Validating security headers..."
    
    local validation_errors=0
    
    # Check for customHeaders section
    if grep -q "customHeaders:" "$config_file"; then
        print_status "Custom headers section found"
        
        # Check for security headers
        local security_headers=("X-Frame-Options" "X-Content-Type-Options" "Referrer-Policy")
        
        for header in "${security_headers[@]}"; do
            if grep -A 50 "customHeaders:" "$config_file" | grep -q "$header"; then
                print_status "Security header found: $header"
            else
                if [[ "$environment" == "production" ]]; then
                    print_error "Security header missing for production: $header"
                    validation_errors=$((validation_errors + 1))
                else
                    print_warning "Security header missing: $header"
                fi
            fi
        done
        
        # Check for Content Security Policy
        if grep -A 50 "customHeaders:" "$config_file" | grep -q "Content-Security-Policy"; then
            print_status "Content Security Policy found"
        else
            if [[ "$environment" == "production" ]]; then
                print_error "Content Security Policy missing for production"
                validation_errors=$((validation_errors + 1))
            else
                print_warning "Content Security Policy missing"
            fi
        fi
    else
        if [[ "$environment" == "production" ]]; then
            print_error "Custom headers section missing for production"
            validation_errors=$((validation_errors + 1))
        else
            print_warning "Custom headers section not found"
        fi
    fi
    
    return $validation_errors
}

# Function to validate build commands
validate_build_commands() {
    local config_file="$1"
    
    print_info "Validating build commands..."
    
    local validation_errors=0
    
    # Check for pnpm usage
    if grep -q "pnpm" "$config_file"; then
        print_status "pnpm package manager usage found"
    else
        print_warning "pnpm package manager not found (npm may be used)"
    fi
    
    # Check for type checking
    if grep -q "type-check" "$config_file"; then
        print_status "TypeScript type checking found"
    else
        print_warning "TypeScript type checking not found"
    fi
    
    # Check for linting
    if grep -q "lint" "$config_file"; then
        print_status "Linting found"
    else
        print_warning "Linting not found"
    fi
    
    # Check for build command
    if grep -q "pnpm build" "$config_file"; then
        print_status "Build command found"
    else
        print_error "Build command not found"
        validation_errors=$((validation_errors + 1))
    fi
    
    return $validation_errors
}

# Function to validate all template files
validate_all_templates() {
    print_test_header "Validating All Template Files"
    
    local templates_dir="amplify-templates"
    local total_templates=0
    local valid_templates=0
    
    if [[ ! -d "$templates_dir" ]]; then
        print_error "Templates directory not found: $templates_dir"
        return 1
    fi
    
    for template in "$templates_dir"/*.yml; do
        if [[ -f "$template" ]]; then
            total_templates=$((total_templates + 1))
            local template_name
            template_name=$(basename "$template")

            echo ""
            print_info "Validating template: $template_name"
            
            if validate_single_config "$template" ""; then
                valid_templates=$((valid_templates + 1))
                print_status "Template validation passed: $template_name"
            else
                print_error "Template validation failed: $template_name"
            fi
        fi
    done
    
    echo ""
    print_info "Template validation summary: $valid_templates/$total_templates templates valid"
    
    if [[ $valid_templates -eq $total_templates ]]; then
        print_status "All templates are valid"
        return 0
    else
        print_error "Some templates failed validation"
        return 1
    fi
}

# Function to validate a single configuration
validate_single_config() {
    local config_file="$1"
    local environment="$2"
    
    local total_errors=0
    
    # YAML syntax validation
    if ! validate_yaml_syntax "$config_file"; then
        total_errors=$((total_errors + 1))
    fi
    
    # Required sections validation
    local section_errors
    if ! section_errors=$(validate_required_sections "$config_file"); then
        total_errors=$((total_errors + section_errors))
    fi
    
    # Frontend configuration validation
    local frontend_errors
    if ! frontend_errors=$(validate_frontend_config "$config_file"); then
        total_errors=$((total_errors + frontend_errors))
    fi
    
    # Environment-specific validation
    local env_errors
    if ! env_errors=$(validate_environment_settings "$config_file" "$environment"); then
        total_errors=$((total_errors + env_errors))
    fi
    
    # Security headers validation
    local security_errors
    if ! security_errors=$(validate_security_headers "$config_file" "$environment"); then
        total_errors=$((total_errors + security_errors))
    fi
    
    # Build commands validation
    local build_errors
    if ! build_errors=$(validate_build_commands "$config_file"); then
        total_errors=$((total_errors + build_errors))
    fi
    
    return $total_errors
}

# Main function
main() {
    local validate_all="false"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --config-file)
                CONFIG_FILE="$2"
                shift 2
                ;;
            --environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --strict)
                STRICT_MODE="true"
                shift
                ;;
            --all-templates)
                validate_all="true"
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
    
    print_test_header "Amplify Configuration Validation"
    echo "Configuration File: $CONFIG_FILE"
    echo "Environment: ${ENVIRONMENT:-"Not specified"}"
    echo "Strict Mode: $STRICT_MODE"
    echo ""
    
    # Validate all templates mode
    if [[ "$validate_all" == "true" ]]; then
        if validate_all_templates; then
            print_status "🎉 All template validations passed!"
            exit 0
        else
            print_error "❌ Some template validations failed"
            exit 1
        fi
    fi
    
    # Single file validation
    if validate_single_config "$CONFIG_FILE" "$ENVIRONMENT"; then
        print_status "🎉 Configuration validation passed!"
        print_info "Configuration file: $CONFIG_FILE"
        if [[ -n "$ENVIRONMENT" ]]; then
            print_info "Environment: $ENVIRONMENT"
        fi
        exit 0
    else
        print_error "❌ Configuration validation failed"
        print_info "Please review the errors above and update the configuration"
        exit 1
    fi
}

# Validate required tools are available
validate_dependencies() {
    local missing_tools=()

    # Check for required tools
    if ! command -v grep >/dev/null 2>&1; then
        missing_tools+=("grep")
    fi

    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        print_error "Please install the missing tools and try again."
        exit 1
    fi
}

# Validate dependencies
validate_dependencies

# Run main function
main "$@"
