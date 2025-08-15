#!/bin/bash

# Macro AI Express API Deployment Script for EC2
# This script deploys the Express API application to EC2 instances
# It's designed to be called from CI/CD pipelines or manually for deployments

set -e

# Configuration
APP_NAME="macro-ai-express-api"
APP_USER="macroai"
APP_DIR="/opt/macro-ai"
RELEASES_DIR="$APP_DIR/releases"
SHARED_DIR="$APP_DIR/shared"
CURRENT_DIR="$APP_DIR/current"
LOG_DIR="/var/log/macro-ai"

# Default values
ARTIFACT_URL=""
RELEASE_VERSION=""
ENVIRONMENT="production"
ROLLBACK_VERSION=""
DRY_RUN=false
VERBOSE=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

# Error handling
error_exit() {
    log_error "$1"
    exit 1
}

# Help function
show_help() {
    cat << EOF
Macro AI Express API Deployment Script

Usage: $0 [OPTIONS] COMMAND

Commands:
    deploy      Deploy a new version of the application
    rollback    Rollback to a previous version
    status      Show current deployment status
    cleanup     Clean up old releases (keeps last 5)
    health      Check application health

Options:
    -u, --artifact-url URL    URL to download the application artifact
    -v, --version VERSION     Release version identifier
    -e, --environment ENV     Environment (development|production) [default: production]
    -r, --rollback VERSION    Version to rollback to
    -d, --dry-run            Show what would be done without executing
    --verbose                Enable verbose output
    -h, --help               Show this help message

Examples:
    # Deploy from artifact URL
    $0 deploy -u https://github.com/user/repo/releases/download/v1.0.0/app.tar.gz -v 1.0.0

    # Deploy from local artifact
    $0 deploy -u /tmp/app.tar.gz -v 1.0.0

    # Rollback to previous version
    $0 rollback -r 1.0.0

    # Check status
    $0 status

    # Cleanup old releases
    $0 cleanup
EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -u|--artifact-url)
                ARTIFACT_URL="$2"
                shift 2
                ;;
            -v|--version)
                RELEASE_VERSION="$2"
                shift 2
                ;;
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -r|--rollback)
                ROLLBACK_VERSION="$2"
                shift 2
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            deploy|rollback|status|cleanup|health)
                COMMAND="$1"
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Validate prerequisites
validate_prerequisites() {
    log_info "Validating prerequisites..."

    # Check if running as root or with sudo
    if [[ $EUID -ne 0 ]]; then
        error_exit "This script must be run as root or with sudo"
    fi

    # Check if application user exists
    if ! id "$APP_USER" &>/dev/null; then
        error_exit "Application user '$APP_USER' does not exist"
    fi

    # Check if required directories exist
    for dir in "$APP_DIR" "$RELEASES_DIR" "$SHARED_DIR" "$LOG_DIR"; do
        if [[ ! -d "$dir" ]]; then
            error_exit "Required directory does not exist: $dir"
        fi
    done

    # Check if systemd service exists
    if [[ ! -f "/etc/systemd/system/macro-ai.service" ]]; then
        error_exit "Systemd service file does not exist: /etc/systemd/system/macro-ai.service"
    fi

    log_success "Prerequisites validated"
}

# Create release directory
create_release() {
    local version="$1"
    local release_dir="$RELEASES_DIR/$version"

    log_info "Creating release directory: $release_dir"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would create directory: $release_dir"
        return 0
    fi

    mkdir -p "$release_dir"
    chown "$APP_USER:$APP_USER" "$release_dir"

    echo "$release_dir"
}

# Download and extract artifact
download_artifact() {
    local artifact_url="$1"
    local release_dir="$2"

    log_info "Downloading artifact from: $artifact_url"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would download artifact to: $release_dir"
        return 0
    fi

    local temp_file="/tmp/macro-ai-artifact-$(date +%s).tar.gz"

    # Download artifact
    if [[ "$artifact_url" =~ ^https?:// ]]; then
        curl -fsSL "$artifact_url" -o "$temp_file" || error_exit "Failed to download artifact"
    elif [[ -f "$artifact_url" ]]; then
        cp "$artifact_url" "$temp_file" || error_exit "Failed to copy artifact"
    else
        error_exit "Invalid artifact URL or file: $artifact_url"
    fi

    # Extract artifact
    log_info "Extracting artifact to: $release_dir"
    tar -xzf "$temp_file" -C "$release_dir" || error_exit "Failed to extract artifact"

    # Set ownership
    chown -R "$APP_USER:$APP_USER" "$release_dir"

    # Cleanup temp file
    rm -f "$temp_file"

    log_success "Artifact downloaded and extracted"
}

# Install dependencies
install_dependencies() {
    local release_dir="$1"

    log_info "Installing dependencies in: $release_dir"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would install dependencies in: $release_dir"
        return 0
    fi

    cd "$release_dir"

    # Check if package.json exists
    if [[ ! -f "package.json" ]]; then
        error_exit "package.json not found in release directory"
    fi

    # Install dependencies as application user
    sudo -u "$APP_USER" pnpm install --frozen-lockfile --production || error_exit "Failed to install dependencies"

    log_success "Dependencies installed"
}

# Create symlink to current release
create_symlink() {
    local release_dir="$1"

    log_info "Creating symlink to current release"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would create symlink: $CURRENT_DIR -> $release_dir"
        return 0
    fi

    # Remove existing symlink
    if [[ -L "$CURRENT_DIR" ]]; then
        rm "$CURRENT_DIR"
    elif [[ -d "$CURRENT_DIR" ]]; then
        error_exit "Current directory exists but is not a symlink: $CURRENT_DIR"
    fi

    # Create new symlink
    ln -sf "$release_dir" "$CURRENT_DIR" || error_exit "Failed to create symlink"
    chown -h "$APP_USER:$APP_USER" "$CURRENT_DIR"

    log_success "Symlink created"
}

# Restart application service
restart_service() {
    log_info "Restarting application service"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would restart macro-ai.service"
        return 0
    fi

    systemctl restart macro-ai.service || error_exit "Failed to restart service"

    # Wait for service to start
    sleep 5

    # Check if service is running
    if ! systemctl is-active --quiet macro-ai.service; then
        error_exit "Service failed to start after restart"
    fi

    log_success "Service restarted successfully"
}

# Health check
health_check() {
    log_info "Performing health check"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would perform health check"
        return 0
    fi

    local max_attempts=30
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s http://localhost:3040/api/health > /dev/null; then
            log_success "Health check passed"
            return 0
        fi

        log_info "Health check attempt $attempt/$max_attempts failed, retrying in 2 seconds..."
        sleep 2
        ((attempt++))
    done

    error_exit "Health check failed after $max_attempts attempts"
}

# Deploy command
cmd_deploy() {
    if [[ -z "$ARTIFACT_URL" ]]; then
        error_exit "Artifact URL is required for deployment"
    fi

    if [[ -z "$RELEASE_VERSION" ]]; then
        error_exit "Release version is required for deployment"
    fi

    log_info "Starting deployment of version: $RELEASE_VERSION"

    validate_prerequisites

    local release_dir
    release_dir=$(create_release "$RELEASE_VERSION")

    download_artifact "$ARTIFACT_URL" "$release_dir"
    install_dependencies "$release_dir"
    create_symlink "$release_dir"
    restart_service
    health_check

    log_success "Deployment completed successfully"
    log_info "Version $RELEASE_VERSION is now active"
}

# Status command
cmd_status() {
    log_info "Current deployment status:"

    if [[ -L "$CURRENT_DIR" ]]; then
        local current_release
        current_release=$(readlink "$CURRENT_DIR")
        local version
        version=$(basename "$current_release")
        echo "  Current version: $version"
        echo "  Release path: $current_release"
    else
        echo "  No current deployment found"
    fi

    echo "  Service status: $(systemctl is-active macro-ai.service 2>/dev/null || echo 'inactive')"

    if systemctl is-active --quiet macro-ai.service; then
        echo "  Health check: $(curl -f -s http://localhost:3040/api/health > /dev/null && echo 'healthy' || echo 'unhealthy')"
    fi

    echo "  Available releases:"
    if [[ -d "$RELEASES_DIR" ]]; then
        ls -la "$RELEASES_DIR" | grep "^d" | awk '{print "    " $9}' | grep -v "^\.$\|^\.\.$"
    fi
}

# Main execution
main() {
    if [[ $# -eq 0 ]]; then
        show_help
        exit 1
    fi

    parse_args "$@"

    case "${COMMAND:-}" in
        deploy)
            cmd_deploy
            ;;
        status)
            cmd_status
            ;;
        *)
            log_error "Unknown command: ${COMMAND:-}"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
