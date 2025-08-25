#!/bin/bash
#!/bin/bash
set -e

# Logging setup
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1
echo "$(date): Starting Macro AI preview deployment"

# Error handling function
error_exit() {
  echo "$(date): ERROR: $1" >&2
  exit 1
}

# Success function
success_exit() {
  echo "$(date): SUCCESS: Macro AI preview deployment completed"
  exit 0
}

# Trap errors
trap 'error_exit "Script failed at line $LINENO"' ERR

echo "$(date): Creating swap file for memory-constrained t3.nano instance..."
# Create 1GB swap file to prevent OOM during package installations
fallocate -l 1G /swapfile || error_exit "Failed to create swap file"
chmod 600 /swapfile || error_exit "Failed to set swap file permissions"
mkswap /swapfile || error_exit "Failed to format swap file"
swapon /swapfile || error_exit "Failed to enable swap file"

# Add swap to fstab for persistence across reboots
echo "/swapfile none swap sw 0 0" >> /etc/fstab || error_exit "Failed to add swap to fstab"

# Verify swap is active
free -h | grep -i swap || error_exit "Swap verification failed"
echo "$(date): Swap file created and activated successfully"

echo "$(date): Updating system packages..."
dnf update -y || error_exit "Failed to update system packages"

echo "$(date): Installing Node.js 20 LTS from NodeSource..."
# Add NodeSource repository for Node.js 20 LTS
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - || error_exit "Failed to add NodeSource repository"
dnf install -y nodejs || error_exit "Failed to install Node.js"

# Verify Node.js installation
node --version || error_exit "Node.js installation verification failed"
npm --version || error_exit "npm installation verification failed"

echo "$(date): Installing additional system packages..."
# Install packages, handling curl conflict with curl-minimal (curl-minimal is sufficient)
dnf install -y git unzip wget amazon-cloudwatch-agent || error_exit "Failed to install system packages"

echo "$(date): Setting up application user and directories..."
useradd -m -s /bin/bash macroai || error_exit "Failed to create macroai user"
mkdir -p /opt/macro-ai /var/log/macro-ai || error_exit "Failed to create directories"
chown -R macroai:macroai /opt/macro-ai /var/log/macro-ai || error_exit "Failed to set ownership"

# Set environment variables including CORS configuration
echo "=== SETTING ENVIRONMENT VARIABLES ===" >> /var/log/user-data.log
echo "PARAMETER_STORE_PREFIX=/macro-ai/development/" >> /etc/environment
echo "Setting PARAMETER_STORE_PREFIX=/macro-ai/development/" >> /var/log/user-data.log
echo "NODE_ENV=production" >> /etc/environment
echo "Setting NODE_ENV=production" >> /var/log/user-data.log
echo "SERVER_PORT=3040" >> /etc/environment
echo "Setting SERVER_PORT=3040" >> /var/log/user-data.log
echo "APP_ENV=pr-51" >> /etc/environment
echo "Setting APP_ENV=pr-51" >> /var/log/user-data.log
echo "PR_NUMBER=51" >> /etc/environment
echo "Setting PR_NUMBER=51" >> /var/log/user-data.log
echo "BRANCH_NAME=feature/custom-domain-implementation" >> /etc/environment
echo "Setting BRANCH_NAME=feature/custom-domain-implementation" >> /var/log/user-data.log
echo "CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,https://pr-51.macro-ai.russoakham.dev" >> /etc/environment
echo "Setting CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,https://pr-51.macro-ai.russoakham.dev" >> /var/log/user-data.log
echo "CUSTOM_DOMAIN_NAME=macro-ai.russoakham.dev" >> /etc/environment
echo "Setting CUSTOM_DOMAIN_NAME=macro-ai.russoakham.dev" >> /var/log/user-data.log
echo "=== DEPLOYMENT ARTIFACT CONFIGURATION ===" >> /var/log/user-data.log
echo "DEPLOYMENT_BUCKET=macro-ai-deployment-artifacts-861909001362" >> /etc/environment
echo "Setting DEPLOYMENT_BUCKET=macro-ai-deployment-artifacts-861909001362" >> /var/log/user-data.log
echo "DEPLOYMENT_KEY=express-api/pr-51/express-api-deployment.tar.gz" >> /etc/environment
echo "Setting DEPLOYMENT_KEY=express-api/pr-51/express-api-deployment.tar.gz" >> /var/log/user-data.log
echo "DEPLOYMENT_VERSION=$(date +%Y%m%d-%H%M%S)" >> /etc/environment
echo "Setting DEPLOYMENT_VERSION=$(date +%Y%m%d-%H%M%S)" >> /var/log/user-data.log
echo "=== END DEPLOYMENT ARTIFACT CONFIGURATION ===" >> /var/log/user-data.log

# Create .env file for the application
echo "=== CREATING .ENV FILE ===" >> /var/log/user-data.log
cat > /opt/macro-ai/.env << EOF
PARAMETER_STORE_PREFIX=/macro-ai/development/
NODE_ENV=production
SERVER_PORT=3040
APP_ENV=pr-51
PR_NUMBER=51
BRANCH_NAME=feature/custom-domain-implementation
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,https://pr-51.macro-ai.russoakham.dev
CUSTOM_DOMAIN_NAME=macro-ai.russoakham.dev
DEPLOYMENT_BUCKET=macro-ai-deployment-artifacts-861909001362
DEPLOYMENT_KEY=express-api/pr-51/express-api-deployment.tar.gz
EOF
echo "=== .ENV FILE CONTENTS ===" >> /var/log/user-data.log
cat /opt/macro-ai/.env >> /var/log/user-data.log
echo "=== END .ENV FILE ===" >> /var/log/user-data.log
chown macroai:macroai /opt/macro-ai/.env
chmod 600 /opt/macro-ai/.env

echo "$(date): CORS configuration set to: ${corsAllowedOrigins}"
echo "$(date): Preview environment setup completed for PR ${prNumber} (${branchName})"

echo "$(date): Deploying Express API from pre-built artifact..."
mkdir -p /opt/macro-ai/app || error_exit "Failed to create app directory"
chown -R macroai:macroai /opt/macro-ai /var/log/macro-ai

# Validate deployment artifact configuration
if [[ -z "$DEPLOYMENT_BUCKET" || -z "$DEPLOYMENT_KEY" ]]; then
    error_exit "Deployment artifact configuration missing. Both DEPLOYMENT_BUCKET and DEPLOYMENT_KEY are required."
fi

echo "$(date): Downloading pre-built Express API from S3..."
echo "  S3 Bucket: $DEPLOYMENT_BUCKET"
echo "  S3 Key: $DEPLOYMENT_KEY"

ARTIFACT_PATH="/tmp/express-api-deployment.tar.gz"

# Debug S3 permissions and bucket access
echo "$(date): Checking IAM role and S3 permissions..."
aws sts get-caller-identity || error_exit "Failed to get IAM identity"
aws s3 ls "s3://${DEPLOYMENT_BUCKET}" || error_exit "Cannot list bucket contents - check IAM permissions"

# Attempt S3 download with better error handling
echo "$(date): Attempting to download artifact: s3://${DEPLOYMENT_BUCKET}/${DEPLOYMENT_KEY}"
if ! aws s3 cp "s3://${DEPLOYMENT_BUCKET}/${DEPLOYMENT_KEY}" "$ARTIFACT_PATH" --debug; then
    error_exit "Failed to download deployment artifact from S3. Check logs above for detailed error information."
fi

echo "$(date): ✅ Deployment artifact downloaded successfully"

# Extract the deployment package
echo "$(date): Extracting deployment package..."
cd /opt/macro-ai/app || error_exit "Failed to change to app directory"
tar -xzf "$ARTIFACT_PATH" || error_exit "Failed to extract deployment package"

# Verify the extracted contents
if [[ ! -d "dist" || ! -f "dist/index.js" || ! -f "package.json" ]]; then
    error_exit "Invalid deployment package structure. Expected: dist/index.js and package.json. Found: $(ls -la)"
fi

echo "$(date): ✅ Deployment package extracted successfully"
echo "$(date): 📦 Contents: $(ls -la)"

# Install production dependencies
echo "$(date): Installing production dependencies..."
if ! npm install --production --frozen-lockfile; then
    if ! npm install --production --no-audit --no-fund; then
        error_exit "Failed to install production dependencies"
    fi
fi

echo "$(date): ✅ Express API deployment completed successfully!"

# Create systemd service
cat > /etc/systemd/system/macro-ai.service << EOF
[Unit]
Description=Macro AI Preview Express API
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=macroai
Group=macroai
WorkingDirectory=/opt/macro-ai/app
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=APP_ENV=pr-51
Environment=SERVER_PORT=3040

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload || error_exit "Failed to reload systemd"
systemctl enable macro-ai.service || error_exit "Failed to enable macro-ai service"

echo "$(date): Starting macro-ai service..."
systemctl start macro-ai.service || error_exit "Failed to start macro-ai service"

echo "$(date): Waiting for service to start..."
sleep 10

echo "$(date): Checking service status..."
systemctl status macro-ai.service || echo "Service status check failed"
systemctl is-active --quiet macro-ai.service || error_exit "Macro AI preview service is not running"

echo "$(date): Testing health endpoint..."
curl -f http://localhost:3040/api/health || echo "Health check failed, but continuing..."

echo "$(date): Preview API service started successfully"
success_exit