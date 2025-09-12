#!/bin/bash

# Security Tools Installation Script for GitHub Actions Scanning
# Installs all necessary CLI tools for local security scanning

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log() {
    echo -e "${1}${2}${NC}"
}

log_info() {
    log "${BLUE}" "ℹ️  $1"
}

log_success() {
    log "${GREEN}" "✅ $1"
}

log_warning() {
    log "${YELLOW}" "⚠️  $1"
}

log_error() {
    log "${RED}" "❌ $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install Homebrew if not present
install_homebrew() {
    if ! command_exists brew; then
        log_info "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        log_success "Homebrew installed"
    else
        log_success "Homebrew already installed"
    fi
}

# Install Go if not present
install_go() {
    if ! command_exists go; then
        log_info "Installing Go..."
        brew install go
        log_success "Go installed"
    else
        log_success "Go already installed"
    fi
}

# Install actionlint
install_actionlint() {
    if ! command_exists actionlint; then
        log_info "Installing actionlint..."
        brew install actionlint
        log_success "actionlint installed"
    else
        log_success "actionlint already installed"
    fi
}

# Install gitleaks
install_gitleaks() {
    if ! command_exists gitleaks; then
        log_info "Installing gitleaks..."
        brew install gitleaks
        log_success "gitleaks installed"
    else
        log_success "gitleaks already installed"
    fi
}

# Install act
install_act() {
    if ! command_exists act; then
        log_info "Installing act..."
        brew install act
        log_success "act installed"
    else
        log_success "act already installed"
    fi
}

# Install GitHub CLI
install_gh() {
    if ! command_exists gh; then
        log_info "Installing GitHub CLI..."
        brew install gh
        log_success "GitHub CLI installed"
    else
        log_success "GitHub CLI already installed"
    fi
}

# Install Octoscan
install_octoscan() {
    if ! command_exists octoscan; then
        log_info "Installing Octoscan..."
        go install github.com/synacktiv/octoscan@latest
        log_success "Octoscan installed"
    else
        log_success "Octoscan already installed"
    fi
}

# Install CodeQL CLI
install_codeql() {
    local codeql_dir="$HOME/.codeql"
    local codeql_bin="$codeql_dir/codeql/codeql"
    
    if [ ! -f "$codeql_bin" ]; then
        log_info "Installing CodeQL CLI..."
        
        # Detect platform
        case "$(uname -s)" in
            Darwin*)
                platform="osx64"
                ;;
            Linux*)
                platform="linux64"
                ;;
            MINGW*|CYGWIN*|MSYS*)
                platform="win64"
                ;;
            *)
                log_error "Unsupported platform: $(uname -s)"
                exit 1
                ;;
        esac
        
        # Create codeql directory
        mkdir -p "$codeql_dir"
        
        # Download and extract CodeQL
        local download_url="https://github.com/github/codeql-cli-binaries/releases/latest/download/codeql-${platform}.zip"
        local zip_file="$codeql_dir/codeql.zip"
        
        log_info "Downloading CodeQL CLI for $platform..."
        curl -L -o "$zip_file" "$download_url"
        
        log_info "Extracting CodeQL CLI..."
        unzip -q "$zip_file" -d "$codeql_dir"
        rm "$zip_file"
        
        # Make codeql executable
        chmod +x "$codeql_bin"
        
        log_success "CodeQL CLI installed to $codeql_dir"
        log_warning "Add $codeql_dir/codeql to your PATH or use the full path: $codeql_bin"
    else
        log_success "CodeQL CLI already installed"
    fi
}

# Install Snyk GitHub Actions Scanner
install_snyk_scanner() {
    local snyk_dir=".tools/github-actions-scanner"
    
    if [ ! -d "$snyk_dir" ]; then
        log_info "Installing Snyk GitHub Actions Scanner..."
        
        # Create tools directory
        mkdir -p .tools
        
        # Clone and install
        git clone https://github.com/snyk-labs/github-actions-scanner.git "$snyk_dir"
        cd "$snyk_dir"
        npm install
        cd - > /dev/null
        
        log_success "Snyk GitHub Actions Scanner installed to $snyk_dir"
    else
        log_success "Snyk GitHub Actions Scanner already installed"
    fi
}

# Install additional security tools
install_additional_tools() {
    log_info "Installing additional security tools..."
    
    # Install semgrep for additional security scanning
    if ! command_exists semgrep; then
        log_info "Installing semgrep..."
        brew install semgrep
        log_success "semgrep installed"
    else
        log_success "semgrep already installed"
    fi
    
    # Install trivy for vulnerability scanning
    if ! command_exists trivy; then
        log_info "Installing trivy..."
        brew install trivy
        log_success "trivy installed"
    else
        log_success "trivy already installed"
    fi
}

# Verify installations
verify_installations() {
    log_info "Verifying installations..."
    
    local tools=("actionlint" "gitleaks" "act" "gh" "octoscan" "semgrep" "trivy")
    local all_installed=true
    
    for tool in "${tools[@]}"; do
        if command_exists "$tool"; then
            log_success "$tool is available"
        else
            log_error "$tool is not available"
            all_installed=false
        fi
    done
    
    # Check CodeQL
    if [ -f "$HOME/.codeql/codeql/codeql" ]; then
        log_success "CodeQL CLI is available"
    else
        log_error "CodeQL CLI is not available"
        all_installed=false
    fi
    
    # Check Snyk Scanner
    if [ -d ".tools/github-actions-scanner" ]; then
        log_success "Snyk Scanner is available"
    else
        log_error "Snyk Scanner is not available"
        all_installed=false
    fi
    
    if [ "$all_installed" = true ]; then
        log_success "All security tools are installed and ready!"
    else
        log_warning "Some tools may not be properly installed. Check the output above."
    fi
}

# Main installation function
main() {
    log "${CYAN}" "🛡️  Installing Security Tools for GitHub Actions Scanning"
    log "${CYAN}" "========================================================"
    
    # Install prerequisites
    install_homebrew
    install_go
    
    # Install core security tools
    install_actionlint
    install_gitleaks
    install_act
    install_gh
    install_octoscan
    install_codeql
    install_snyk_scanner
    
    # Install additional tools
    install_additional_tools
    
    # Verify installations
    verify_installations
    
    log "${GREEN}" ""
    log "${GREEN}" "🎉 Security tools installation complete!"
    log "${GREEN}" ""
    log "${BLUE}" "Available commands:"
    log "${BLUE}" "  pnpm security:scan              - Basic security scan"
    log "${BLUE}" "  pnpm security:scan:advanced     - Advanced security scan"
    log "${BLUE}" "  pnpm security:scan:codeql       - CodeQL security scan"
    log "${BLUE}" "  pnpm security:scan:workflows    - Actionlint validation"
    log "${BLUE}" "  pnpm security:scan:secrets      - Gitleaks secret scan"
    log "${BLUE}" "  pnpm security:scan:octoscan     - Octoscan analysis"
    log "${BLUE}" "  pnpm security:scan:act          - Act workflow testing"
    log "${GREEN}" ""
    log "${GREEN}" "Run 'pnpm security:scan:codeql' to start scanning your workflows!"
}

# Run main function
main "$@"
