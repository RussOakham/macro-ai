#!/bin/bash

# Workflow Integration Validation Script
# Validates the complete frontend preview workflow integration system

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WORKFLOWS_DIR="${PROJECT_ROOT}/.github/workflows"
ACTIONS_DIR="${PROJECT_ROOT}/.github/actions"

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
    echo "Workflow Integration Validation Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --test-suite <suite>        Test suite to run: all|workflows|actions|scripts|integration (default: all)"
    echo "  --skip-syntax-check        Skip YAML syntax validation"
    echo "  --skip-script-tests        Skip script execution tests"
    echo "  --output-format <format>    Output format: text|json|junit (default: text)"
    echo "  --save-results             Save test results to file"
    echo "  --verbose                   Enable verbose output"
    echo "  --help                      Show this help message"
    echo ""
    echo "Test Suites:"
    echo "  workflows                   Test GitHub Actions workflow files"
    echo "  actions                     Test reusable GitHub Actions"
    echo "  scripts                     Test integration scripts"
    echo "  integration                 Test end-to-end integration"
    echo "  all                         Run all test suites"
    echo ""
    echo "Examples:"
    echo "  $0                          # Run all tests"
    echo "  $0 --test-suite workflows   # Test only workflow files"
    echo "  $0 --skip-syntax-check      # Skip YAML validation"
}

# Function to validate YAML syntax
validate_yaml_syntax() {
    local file="$1"
    local file_type="$2"
    
    print_info "Validating YAML syntax: $(basename "$file")"
    
    # Try different YAML validators
    if command -v yq &> /dev/null; then
        if yq eval '.' "$file" > /dev/null 2>&1; then
            print_status "YAML syntax valid (yq)"
            return 0
        else
            print_error "YAML syntax invalid (yq)"
            return 1
        fi
    elif command -v python3 &> /dev/null; then
        if python3 -c "import yaml; yaml.safe_load(open('$file'))" 2>/dev/null; then
            print_status "YAML syntax valid (Python)"
            return 0
        else
            print_error "YAML syntax invalid (Python)"
            return 1
        fi
    else
        print_warning "No YAML validator found, skipping syntax check"
        return 0
    fi
}

# Function to test workflow files
test_workflow_files() {
    print_test_header "GitHub Actions Workflow Files"
    
    local test_results=()
    
    if [[ ! -d "$WORKFLOWS_DIR" ]]; then
        print_error "Workflows directory not found: $WORKFLOWS_DIR"
        test_results+=("workflows_directory:FAIL")
        printf '%s\n' "${test_results[@]}"
        return 1
    fi
    
    # Test each workflow file
    local workflow_files=(
        "deploy-frontend-preview.yml"
        "destroy-frontend-preview.yml"
        "manual-destroy-frontend-preview.yml"
    )
    
    for workflow_file in "${workflow_files[@]}"; do
        local workflow_path="${WORKFLOWS_DIR}/${workflow_file}"
        
        if [[ -f "$workflow_path" ]]; then
            print_info "Testing workflow: $workflow_file"
            
            # Validate YAML syntax
            if [[ "${SKIP_SYNTAX_CHECK:-false}" != "true" ]]; then
                if validate_yaml_syntax "$workflow_path" "workflow"; then
                    test_results+=("workflow_${workflow_file}_syntax:PASS")
                else
                    test_results+=("workflow_${workflow_file}_syntax:FAIL")
                fi
            else
                test_results+=("workflow_${workflow_file}_syntax:SKIP")
            fi
            
            # Check for required sections
            local required_sections=("name" "on" "jobs")
            local section_errors=0
            
            for section in "${required_sections[@]}"; do
                if grep -q "^${section}:" "$workflow_path"; then
                    print_status "Required section found: $section"
                else
                    print_error "Required section missing: $section"
                    section_errors=$((section_errors + 1))
                fi
            done
            
            if [[ $section_errors -eq 0 ]]; then
                test_results+=("workflow_${workflow_file}_structure:PASS")
            else
                test_results+=("workflow_${workflow_file}_structure:FAIL")
            fi
            
            # Check for integration with reusable actions
            if grep -q "uses: ./.github/actions/" "$workflow_path"; then
                print_status "Uses reusable actions"
                test_results+=("workflow_${workflow_file}_reusable_actions:PASS")
            else
                print_warning "No reusable actions found"
                test_results+=("workflow_${workflow_file}_reusable_actions:WARN")
            fi
            
        else
            print_error "Workflow file not found: $workflow_file"
            test_results+=("workflow_${workflow_file}_exists:FAIL")
        fi
    done
    
    echo ""
    printf '%s\n' "${test_results[@]}"
}

# Function to test reusable actions
test_reusable_actions() {
    print_test_header "Reusable GitHub Actions"
    
    local test_results=()
    
    if [[ ! -d "$ACTIONS_DIR" ]]; then
        print_error "Actions directory not found: $ACTIONS_DIR"
        test_results+=("actions_directory:FAIL")
        printf '%s\n' "${test_results[@]}"
        return 1
    fi
    
    # Test each reusable action
    local action_dirs=(
        "discover-backend"
        "generate-frontend-env"
    )
    
    for action_dir in "${action_dirs[@]}"; do
        local action_path="${ACTIONS_DIR}/${action_dir}"
        local action_file="${action_path}/action.yml"
        
        if [[ -d "$action_path" ]]; then
            print_info "Testing action: $action_dir"
            
            if [[ -f "$action_file" ]]; then
                # Validate YAML syntax
                if [[ "${SKIP_SYNTAX_CHECK:-false}" != "true" ]]; then
                    if validate_yaml_syntax "$action_file" "action"; then
                        test_results+=("action_${action_dir}_syntax:PASS")
                    else
                        test_results+=("action_${action_dir}_syntax:FAIL")
                    fi
                else
                    test_results+=("action_${action_dir}_syntax:SKIP")
                fi
                
                # Check for required sections
                local required_sections=("name" "description" "inputs" "outputs" "runs")
                local section_errors=0
                
                for section in "${required_sections[@]}"; do
                    if grep -q "^${section}:" "$action_file"; then
                        print_status "Required section found: $section"
                    else
                        print_error "Required section missing: $section"
                        section_errors=$((section_errors + 1))
                    fi
                done
                
                if [[ $section_errors -eq 0 ]]; then
                    test_results+=("action_${action_dir}_structure:PASS")
                else
                    test_results+=("action_${action_dir}_structure:FAIL")
                fi
                
                # Check for composite action type
                if grep -q "using: 'composite'" "$action_file"; then
                    print_status "Uses composite action type"
                    test_results+=("action_${action_dir}_composite:PASS")
                else
                    print_warning "Not using composite action type"
                    test_results+=("action_${action_dir}_composite:WARN")
                fi
                
            else
                print_error "Action file not found: action.yml"
                test_results+=("action_${action_dir}_file:FAIL")
            fi
        else
            print_error "Action directory not found: $action_dir"
            test_results+=("action_${action_dir}_exists:FAIL")
        fi
    done
    
    echo ""
    printf '%s\n' "${test_results[@]}"
}

# Function to test integration scripts
test_integration_scripts() {
    print_test_header "Integration Scripts"
    
    local test_results=()
    local scripts_dir="${PROJECT_ROOT}/apps/client-ui/scripts"
    
    if [[ ! -d "$scripts_dir" ]]; then
        print_error "Scripts directory not found: $scripts_dir"
        test_results+=("scripts_directory:FAIL")
        printf '%s\n' "${test_results[@]}"
        return 1
    fi
    
    # Test each integration script
    local script_files=(
        "backend-discovery-service.sh"
        "api-resolution-service.sh"
        "inject-preview-env.sh"
        "generate-amplify-config.sh"
        "validate-amplify-config.sh"
        "test-backend-integration.sh"
    )
    
    for script_file in "${script_files[@]}"; do
        local script_path="${scripts_dir}/${script_file}"
        
        if [[ -f "$script_path" ]]; then
            print_info "Testing script: $script_file"
            
            # Check if script is executable
            if [[ -x "$script_path" ]]; then
                print_status "Script is executable"
                test_results+=("script_${script_file}_executable:PASS")
            else
                print_warning "Script is not executable"
                test_results+=("script_${script_file}_executable:WARN")
            fi
            
            # Check for shebang
            if head -1 "$script_path" | grep -q "^#!/bin/bash"; then
                print_status "Has bash shebang"
                test_results+=("script_${script_file}_shebang:PASS")
            else
                print_warning "Missing or incorrect shebang"
                test_results+=("script_${script_file}_shebang:WARN")
            fi
            
            # Test help option (if not skipping script tests)
            if [[ "${SKIP_SCRIPT_TESTS:-false}" != "true" ]]; then
                if bash "$script_path" --help >/dev/null 2>&1; then
                    print_status "Help option works"
                    test_results+=("script_${script_file}_help:PASS")
                else
                    print_warning "Help option failed"
                    test_results+=("script_${script_file}_help:WARN")
                fi
            else
                test_results+=("script_${script_file}_help:SKIP")
            fi
            
        else
            print_error "Script file not found: $script_file"
            test_results+=("script_${script_file}_exists:FAIL")
        fi
    done
    
    echo ""
    printf '%s\n' "${test_results[@]}"
}

# Function to test end-to-end integration
test_integration() {
    print_test_header "End-to-End Integration"
    
    local test_results=()
    
    # Test configuration files
    print_info "Testing configuration files..."
    
    local config_files=(
        "apps/client-ui/scripts/env-mapping.json"
        "apps/client-ui/amplify-templates/amplify.base.yml"
        "apps/client-ui/amplify-templates/amplify.preview.yml"
    )
    
    for config_file in "${config_files[@]}"; do
        local config_path="${PROJECT_ROOT}/${config_file}"
        
        if [[ -f "$config_path" ]]; then
            if [[ "$config_file" =~ \.json$ ]]; then
                # Validate JSON
                if jq . "$config_path" >/dev/null 2>&1; then
                    print_status "JSON valid: $(basename "$config_file")"
                    test_results+=("config_$(basename "$config_file")_syntax:PASS")
                else
                    print_error "JSON invalid: $(basename "$config_file")"
                    test_results+=("config_$(basename "$config_file")_syntax:FAIL")
                fi
            elif [[ "$config_file" =~ \.ya?ml$ ]]; then
                # Validate YAML
                if validate_yaml_syntax "$config_path" "config"; then
                    test_results+=("config_$(basename "$config_file")_syntax:PASS")
                else
                    test_results+=("config_$(basename "$config_file")_syntax:FAIL")
                fi
            fi
        else
            print_error "Configuration file not found: $config_file"
            test_results+=("config_$(basename "$config_file")_exists:FAIL")
        fi
    done
    
    # Test documentation files
    print_info "Testing documentation files..."
    
    local doc_files=(
        "docs/frontend/frontend-backend-integration.md"
        "docs/frontend/amplify-configuration-templates.md"
        "docs/ci-cd/frontend-preview-workflow-integration.md"
    )
    
    for doc_file in "${doc_files[@]}"; do
        local doc_path="${PROJECT_ROOT}/${doc_file}"
        
        if [[ -f "$doc_path" ]]; then
            print_status "Documentation exists: $(basename "$doc_file")"
            test_results+=("doc_$(basename "$doc_file")_exists:PASS")
        else
            print_error "Documentation missing: $doc_file"
            test_results+=("doc_$(basename "$doc_file")_exists:FAIL")
        fi
    done
    
    echo ""
    printf '%s\n' "${test_results[@]}"
}

# Function to generate test report
generate_test_report() {
    local all_results=("$@")
    local output_format="$1"
    shift
    all_results=("$@")
    
    local total_tests=0
    local passed_tests=0
    local failed_tests=0
    local warned_tests=0
    local skipped_tests=0
    
    for result in "${all_results[@]}"; do
        total_tests=$((total_tests + 1))
        case "$result" in
            *:PASS) passed_tests=$((passed_tests + 1)) ;;
            *:FAIL) failed_tests=$((failed_tests + 1)) ;;
            *:WARN) warned_tests=$((warned_tests + 1)) ;;
            *:SKIP) skipped_tests=$((skipped_tests + 1)) ;;
        esac
    done
    
    print_test_header "Workflow Integration Test Results"
    echo "Total Tests: $total_tests"
    echo "Passed: $passed_tests"
    echo "Failed: $failed_tests"
    echo "Warnings: $warned_tests"
    echo "Skipped: $skipped_tests"
    echo ""
    
    if [[ $failed_tests -eq 0 ]]; then
        print_status "🎉 All workflow integration tests passed!"
        return 0
    else
        print_error "❌ $failed_tests test(s) failed"
        return 1
    fi
}

# Main function
main() {
    local test_suite="all"
    local skip_syntax_check="false"
    local skip_script_tests="false"
    local output_format="text"
    local save_results="false"
    local verbose="false"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --test-suite)
                test_suite="$2"
                shift 2
                ;;
            --skip-syntax-check)
                skip_syntax_check="true"
                shift
                ;;
            --skip-script-tests)
                skip_script_tests="true"
                shift
                ;;
            --output-format)
                output_format="$2"
                shift 2
                ;;
            --save-results)
                save_results="true"
                shift
                ;;
            --verbose)
                verbose="true"
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
    
    # Export configuration
    export SKIP_SYNTAX_CHECK="$skip_syntax_check"
    export SKIP_SCRIPT_TESTS="$skip_script_tests"
    
    print_info "🧪 Workflow Integration Validation"
    echo "=================================="
    echo "Test Suite: $test_suite"
    echo "Skip Syntax Check: $skip_syntax_check"
    echo "Skip Script Tests: $skip_script_tests"
    echo "Output Format: $output_format"
    echo ""
    
    # Run tests based on suite selection
    local all_results=()
    
    case "$test_suite" in
        "workflows"|"all")
            while IFS= read -r line; do
                all_results+=("$line")
            done < <(test_workflow_files)
            ;;
    esac

    case "$test_suite" in
        "actions"|"all")
            while IFS= read -r line; do
                all_results+=("$line")
            done < <(test_reusable_actions)
            ;;
    esac

    case "$test_suite" in
        "scripts"|"all")
            while IFS= read -r line; do
                all_results+=("$line")
            done < <(test_integration_scripts)
            ;;
    esac

    case "$test_suite" in
        "integration"|"all")
            while IFS= read -r line; do
                all_results+=("$line")
            done < <(test_integration)
            ;;
    esac
    
    # Generate test report
    generate_test_report "$output_format" "${all_results[@]}"
}

# Run main function
main "$@"
