#!/bin/bash
#
# Simplified EC2 User Data Script for Macro AI Express API
# Uses the new simplified configuration approach with Parameter Store bootstrap
#
# This script replaces the complex runtime Parameter Store integration with
# infrastructure-level parameter fetching before starting the Node.js application.

set -euo pipefail

# Configuration
APP_NAME="macro-ai"
APP_USER="macroai"
APP_DIR="/opt/macro-ai"
LOG_DIR="/var/log/macro-ai"
BOOTSTRAP_SCRIPT_URL="https://raw.githubusercontent.com/RussOakham/macro-ai/main/infrastructure/scripts/bootstrap-ec2-config.sh"

# Environment variables (will be set by deployment)
DEPLOYMENT_BUCKET="${DEPLOYMENT_BUCKET:-}"
DEPLOYMENT_KEY="${DEPLOYMENT_KEY:-}"
APP_ENV="${APP_ENV:-production}"
AWS_REGION="${AWS_REGION:-us-east-1}"

# Logging functions
log_info() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] $*" | tee -a /var/log/user-data.log
}

log_error() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] $*" | tee -a /var/log/user-data.log >&2
}

error_exit() {
    log_error "$1"
    exit 1
}

# Update system and install dependencies
setup_system() {
    log_info "Setting up system dependencies..."
    
    yum update -y || error_exit "Failed to update system"
    
    # Install Node.js 20 LTS
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - || error_exit "Failed to setup Node.js repository"
    yum install -y nodejs || error_exit "Failed to install Node.js"
    
    # Install additional dependencies
    yum install -y awscli jq unzip || error_exit "Failed to install additional dependencies"
    
    log_info "System setup completed"
}

# Create application user and directories
setup_application_structure() {
    log_info "Setting up application structure..."
    
    # Create application user
    if ! id "$APP_USER" &>/dev/null; then
        useradd --system --shell /bin/bash --home-dir "$APP_DIR" --create-home "$APP_USER" || error_exit "Failed to create application user"
    fi
    
    # Create directories
    mkdir -p "$APP_DIR/app" "$LOG_DIR" || error_exit "Failed to create directories"
    
    # Set permissions
    chown -R "$APP_USER:$APP_USER" "$APP_DIR" "$LOG_DIR" || error_exit "Failed to set permissions"
    chmod 755 "$APP_DIR" "$LOG_DIR" || error_exit "Failed to set directory permissions"
    
    log_info "Application structure setup completed"
}

# Download and install bootstrap script
install_bootstrap_script() {
    log_info "Installing configuration bootstrap script..."
    
    local bootstrap_script="/usr/local/bin/bootstrap-ec2-config.sh"
    
    # Download bootstrap script
    curl -fsSL "$BOOTSTRAP_SCRIPT_URL" -o "$bootstrap_script" || error_exit "Failed to download bootstrap script"
    
    # Make executable
    chmod +x "$bootstrap_script" || error_exit "Failed to make bootstrap script executable"
    
    log_info "Bootstrap script installed successfully"
}

# Fetch configuration from Parameter Store
bootstrap_configuration() {
    log_info "Bootstrapping configuration from Parameter Store..."
    
    # Run bootstrap script to fetch parameters and create environment file
    /usr/local/bin/bootstrap-ec2-config.sh \
        --app-env "$APP_ENV" \
        --region "$AWS_REGION" \
        --env-file "/etc/macro-ai.env" \
        --verbose || error_exit "Failed to bootstrap configuration"
    
    log_info "Configuration bootstrap completed"
}

# Download and deploy application
deploy_application() {
    log_info "Deploying application..."
    
    if [[ -z "$DEPLOYMENT_BUCKET" ]] || [[ -z "$DEPLOYMENT_KEY" ]]; then
        error_exit "DEPLOYMENT_BUCKET and DEPLOYMENT_KEY must be set"
    fi
    
    local temp_file="/tmp/app.tar.gz"
    
    # Download application artifact
    aws s3 cp "s3://$DEPLOYMENT_BUCKET/$DEPLOYMENT_KEY" "$temp_file" || error_exit "Failed to download application artifact"
    
    # Extract to application directory
    cd "$APP_DIR"
    tar -xzf "$temp_file" -C app --strip-components=1 || error_exit "Failed to extract application"
    
    # Set ownership
    chown -R "$APP_USER:$APP_USER" "$APP_DIR/app" || error_exit "Failed to set application ownership"
    
    # Clean up
    rm -f "$temp_file"
    
    log_info "Application deployment completed"
}

# Install application dependencies
install_dependencies() {
    log_info "Installing application dependencies..."
    
    cd "$APP_DIR/app"
    
    # Install production dependencies as application user
    sudo -u "$APP_USER" npm ci --only=production || error_exit "Failed to install dependencies"
    
    log_info "Dependencies installation completed"
}

# Create systemd service
create_systemd_service() {
    log_info "Creating systemd service..."
    
    cat > /etc/systemd/system/macro-ai.service << 'EOF'
[Unit]
Description=Macro AI Express API Server
Documentation=https://github.com/RussOakham/macro-ai
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=macroai
Group=macroai

# Working directory
WorkingDirectory=/opt/macro-ai/app

# Environment file created by bootstrap script
EnvironmentFile=/etc/macro-ai.env

# Additional environment variables
Environment=NODE_ENV=production

# Application command
ExecStart=/usr/bin/node dist/index.js

# Restart configuration
Restart=always
RestartSec=10
StartLimitInterval=60s
StartLimitBurst=3

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/macro-ai/logs

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=macro-ai

# Process management
KillMode=mixed
KillSignal=SIGTERM
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd and enable service
    systemctl daemon-reload || error_exit "Failed to reload systemd"
    systemctl enable macro-ai.service || error_exit "Failed to enable service"
    
    log_info "Systemd service created and enabled"
}

# Start application service
start_application() {
    log_info "Starting application service..."
    
    systemctl start macro-ai.service || error_exit "Failed to start service"
    
    # Wait for service to be ready
    local max_attempts=30
    local attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if systemctl is-active --quiet macro-ai.service; then
            log_info "Service is running"
            break
        fi
        
        attempt=$((attempt + 1))
        log_info "Waiting for service to start (attempt $attempt/$max_attempts)..."
        sleep 2
    done
    
    if [[ $attempt -eq $max_attempts ]]; then
        error_exit "Service failed to start within expected time"
    fi
    
    log_info "Application started successfully"
}

# Perform health check
health_check() {
    log_info "Performing health check..."
    
    local max_attempts=30
    local attempt=0
    local health_url="http://localhost:3040/api/health"
    
    while [[ $attempt -lt $max_attempts ]]; do
        if curl -f -s "$health_url" > /dev/null 2>&1; then
            log_info "Health check passed"
            return 0
        fi
        
        attempt=$((attempt + 1))
        log_info "Health check attempt $attempt/$max_attempts..."
        sleep 2
    done
    
    log_error "Health check failed after $max_attempts attempts"
    
    # Log service status for debugging
    systemctl status macro-ai.service || true
    journalctl -u macro-ai.service -n 20 || true
    
    return 1
}

# Main execution
main() {
    log_info "Starting simplified EC2 deployment for Macro AI Express API"
    log_info "Environment: $APP_ENV"
    log_info "Region: $AWS_REGION"
    
    setup_system
    setup_application_structure
    install_bootstrap_script
    bootstrap_configuration
    deploy_application
    install_dependencies
    create_systemd_service
    start_application
    
    if health_check; then
        log_info "✅ Deployment completed successfully!"
    else
        log_error "❌ Deployment completed but health check failed"
        exit 1
    fi
}

# Execute main function
main "$@"
