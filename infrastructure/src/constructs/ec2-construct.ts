import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'

// Note: TaggingStrategy imports removed as we now use direct cdk.Tags.of() calls to avoid conflicts

export interface Ec2ConstructProps {
	/**
	 * VPC where EC2 instances will be deployed
	 */
	readonly vpc: ec2.IVpc

	/**
	 * Security group for EC2 instances
	 */
	readonly securityGroup: ec2.ISecurityGroup

	/**
	 * Environment name for resource naming and tagging
	 * @default 'development'
	 */
	readonly environmentName?: string

	/**
	 * Branch name for deployment tracking
	 */
	readonly branchName?: string

	/**
	 * Custom domain name for CORS configuration
	 */
	readonly customDomainName?: string

	/**
	 * Instance type for EC2 instances
	 * @default t3.micro (cost-optimized for development), t3.nano for preview environments
	 */
	readonly instanceType?: ec2.InstanceType

	/**
	 * Parameter Store prefix for configuration
	 */
	readonly parameterStorePrefix: string

	/**
	 * Enable detailed monitoring and logging
	 * @default false (cost optimization)
	 */
	readonly enableDetailedMonitoring?: boolean

	/**
	 * Auto-scaling configuration
	 */
	readonly autoScaling?: {
		readonly minCapacity: number
		readonly maxCapacity: number
		readonly targetCpuUtilization: number
	}

	/**
	 * Deployment ID to force instance replacement on every deployment
	 * This ensures fresh instances with latest application code
	 * @default current timestamp
	 */
	readonly deploymentId?: string
}

export interface PrInstanceProps {
	/**
	 * PR number for resource naming and tagging
	 */
	readonly prNumber: number

	/**
	 * VPC where the instance will be deployed
	 */
	readonly vpc: ec2.IVpc

	/**
	 * Security group for the PR instance
	 */
	readonly securityGroup: ec2.ISecurityGroup

	/**
	 * Parameter Store prefix for configuration
	 */
	readonly parameterStorePrefix: string

	/**
	 * Environment name for resource naming
	 * @default 'development'
	 */
	readonly environmentName?: string

	/**
	 * Instance type for the PR instance
	 * @default t3.micro
	 */
	readonly instanceType?: ec2.InstanceType

	/**
	 * Deployment ID to force instance replacement on every deployment
	 * @default current timestamp
	 */
	readonly deploymentId?: string

	/**
	 * Branch name for deployment tracking
	 */
	readonly branchName?: string

	/**
	 * Custom domain name for CORS configuration
	 */
	readonly customDomainName?: string
}

/**
 * EC2 Construct for Macro AI preview environments
 *
 * This construct provides EC2 instances for hosting the Express API in PR preview environments.
 * It implements cost-optimized deployment with proper security, monitoring, and auto-scaling.
 *
 * Key Features:
 * - Cost-optimized instance types (t3.micro for development)
 * - Automated application deployment via user data scripts
 * - IAM roles with least-privilege access to AWS services
 * - Integration with Parameter Store for configuration
 * - Session Manager access (no SSH required)
 * - Comprehensive tagging for cost tracking and cleanup
 * - Auto-scaling support for production workloads
 */
export class Ec2Construct extends Construct {
	public readonly instanceRole: iam.Role
	public readonly launchTemplate: ec2.LaunchTemplate
	public readonly keyPair?: ec2.KeyPair

	constructor(scope: Construct, id: string, props: Ec2ConstructProps) {
		super(scope, id)

		const {
			vpc,
			securityGroup,
			environmentName = 'development',
			instanceType = ec2.InstanceType.of(
				ec2.InstanceClass.T3,
				ec2.InstanceSize.MICRO,
			),
			parameterStorePrefix,
			enableDetailedMonitoring = false,
			deploymentId = new Date().toISOString(),
			branchName,
			customDomainName,
		} = props

		// Create IAM role for EC2 instances
		this.instanceRole = this.createInstanceRole(
			parameterStorePrefix,
			environmentName,
		)

		// Create launch template for consistent instance configuration
		this.launchTemplate = this.createLaunchTemplate(
			vpc,
			securityGroup,
			instanceType,
			parameterStorePrefix,
			environmentName,
			enableDetailedMonitoring,
			deploymentId,
			branchName,
			customDomainName,
		)

		// Apply tags to the construct
		this.applyTags(environmentName)
	}

	/**
	 * Factory method to create a PR-specific EC2 instance
	 * Each PR gets its own isolated EC2 instance
	 */
	public createPrInstance(props: PrInstanceProps): ec2.Instance {
		const {
			prNumber,
			vpc,
			securityGroup,
			parameterStorePrefix,
			environmentName = 'development',
			instanceType = ec2.InstanceType.of(
				ec2.InstanceClass.T3,
				ec2.InstanceSize.MICRO,
			),
			deploymentId = new Date().toISOString(),
			branchName, // Used in user data script template literals
			customDomainName, // Used in user data script template literals
		} = props

		// Create PR-specific instance
		const instance = new ec2.Instance(
			this,
			`Pr${prNumber.toString()}Instance`,
			{
				vpc,
				instanceType,
				machineImage: ec2.MachineImage.latestAmazonLinux2023({
					cpuType: ec2.AmazonLinuxCpuType.X86_64,
				}),
				securityGroup,
				role: this.instanceRole,
				userData: this.createUserData(
					parameterStorePrefix,
					prNumber,
					deploymentId,
					branchName,
					customDomainName,
					environmentName,
				),
				vpcSubnets: {
					subnetType: ec2.SubnetType.PUBLIC, // Cost optimization: no NAT Gateway needed
				},
				instanceName: `macro-ai-${environmentName}-pr-${prNumber.toString()}`,
				// Enable detailed monitoring if specified
				detailedMonitoring: false, // Cost optimization for development
			},
		)

		// Note: PR-specific tags are inherited from stack-level tags
		// No need to apply duplicate tags here as they're already applied at stack level

		return instance
	}

	/**
	 * Create IAM role for EC2 instances with least-privilege access
	 */
	private createInstanceRole(
		parameterStorePrefix: string,
		environmentName: string,
	): iam.Role {
		const role = new iam.Role(this, 'Ec2InstanceRole', {
			assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
			roleName: `macro-ai-${environmentName}-ec2-role`,
			description:
				'IAM role for Macro AI EC2 instances with least-privilege access',
		})

		// AWS Systems Manager Session Manager (replaces SSH)
		role.addManagedPolicy(
			iam.ManagedPolicy.fromAwsManagedPolicyName(
				'AmazonSSMManagedInstanceCore',
			),
		)

		// Parameter Store access removed - CDK synthesis time approach
		// EC2 instances receive all configuration at deployment time via user data script
		// This eliminates the need for runtime Parameter Store permissions, improving security
		// and reducing the attack surface of EC2 instances

		// CloudWatch Logs (for application logging)
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'logs:CreateLogGroup',
					'logs:CreateLogStream',
					'logs:PutLogEvents',
					'logs:DescribeLogStreams',
				],
				resources: [
					`arn:aws:logs:*:*:log-group:/macro-ai/${environmentName}/*`,
				],
			}),
		)

		// CloudWatch Metrics (for monitoring)
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: ['cloudwatch:PutMetricData'],
				resources: ['*'],
				conditions: {
					StringEquals: {
						'cloudwatch:namespace': 'MacroAI/EC2',
					},
				},
			}),
		)

		// S3 access for deployment artifacts (read-only)
		// S3 access for deployment artifacts (read-only)
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: ['s3:GetObject', 's3:GetObjectVersion', 's3:ListBucket'],
				resources: [
					`arn:aws:s3:::macro-ai-deployment-artifacts-${cdk.Stack.of(this).account}`,
					`arn:aws:s3:::macro-ai-deployment-artifacts-${cdk.Stack.of(this).account}/*`,
				],
			}),
		)

		// Allow STS get-caller-identity for S3 bucket resolution
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: ['sts:GetCallerIdentity'],
				resources: ['*'],
			}),
		)
		return role
	}

	/**
	 * Create launch template for consistent instance configuration
	 */
	private createLaunchTemplate(
		vpc: ec2.IVpc,
		securityGroup: ec2.ISecurityGroup,
		instanceType: ec2.InstanceType,
		parameterStorePrefix: string,
		environmentName: string,
		enableDetailedMonitoring: boolean,
		deploymentId: string,
		branchName?: string,
		customDomainName?: string,
	): ec2.LaunchTemplate {
		return new ec2.LaunchTemplate(this, 'Ec2LaunchTemplate', {
			launchTemplateName: `macro-ai-${environmentName}-launch-template`,
			instanceType,
			machineImage: ec2.MachineImage.latestAmazonLinux2023({
				cpuType: ec2.AmazonLinuxCpuType.X86_64,
			}),
			securityGroup,
			role: this.instanceRole,
			userData: this.createUserData(
				parameterStorePrefix,
				undefined,
				deploymentId,
				branchName,
				customDomainName,
				environmentName,
			),
			detailedMonitoring: enableDetailedMonitoring,
			// EBS optimization for better performance
			ebsOptimized: true,
			// Instance metadata service v2 (security best practice)
			requireImdsv2: true,
		})
	}

	/**
	 * Create simplified user data script for automated application deployment
	 * Uses the new bootstrap approach with Parameter Store configuration fetching
	 */
	private createUserData(
		parameterStorePrefix: string,
		prNumber?: number,
		deploymentId?: string,
		branchName?: string,
		customDomainName?: string,
		environmentName?: string,
	): ec2.UserData {
		const userData = ec2.UserData.forLinux()

		// Add deployment timestamp to force instance replacement
		const timestamp = deploymentId ?? new Date().toISOString()

		// Determine environment name for Parameter Store
		const appEnv = prNumber
			? `pr-${prNumber}`
			: (environmentName ?? 'production')

		// Get the AWS region from the stack
		const region = cdk.Stack.of(this).region

		// Create simplified deployment script using the new bootstrap approach
		userData.addCommands(
			'#!/bin/bash',
			'#',
			'# Simplified EC2 User Data Script for Macro AI Express API',
			'# Uses the new simplified configuration approach with Parameter Store bootstrap',
			'#',
			`# Deployment ID: ${timestamp}`,
			'# This timestamp forces new instances on every deployment to ensure fresh application code',
			'',
			'set -euo pipefail',
			'',
			'# Configuration',
			'APP_NAME="macro-ai"',
			'APP_USER="macroai"',
			'APP_DIR="/opt/macro-ai"',
			'LOG_DIR="/var/log/macro-ai"',
			'BOOTSTRAP_SCRIPT_URL="https://raw.githubusercontent.com/RussOakham/macro-ai/main/infrastructure/scripts/bootstrap-ec2-config.sh"',
			'',
			'# Environment variables (set by deployment)',
			`DEPLOYMENT_BUCKET="\${DEPLOYMENT_BUCKET:-macro-ai-deployment-artifacts-${cdk.Stack.of(this).account}}"`,
			`DEPLOYMENT_KEY="\${DEPLOYMENT_KEY:-express-api/latest.tar.gz}"`,
			`APP_ENV="${appEnv}"`,
			`AWS_REGION="${region}"`,
			'',
			'# Logging functions',
			'log_info() {',
			'    echo "$(date \'+%Y-%m-%d %H:%M:%S\') [INFO] $*" | tee -a /var/log/user-data.log',
			'}',
			'',
			'log_error() {',
			'    echo "$(date \'+%Y-%m-%d %H:%M:%S\') [ERROR] $*" | tee -a /var/log/user-data.log >&2',
			'}',
			'',
			'error_exit() {',
			'    log_error "$1"',
			'    exit 1',
			'}',
			'',
			'# Update system and install dependencies',
			'log_info "Setting up system dependencies..."',
			'',
			'yum update -y || error_exit "Failed to update system"',
			'',
			'# Install Node.js 20 LTS',
			'curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - || error_exit "Failed to setup Node.js repository"',
			'yum install -y nodejs || error_exit "Failed to install Node.js"',
			'',
			'# Install additional dependencies',
			'yum install -y awscli jq unzip || error_exit "Failed to install additional dependencies"',
			'',
			'log_info "System setup completed"',
			'',
			'# Create application user and directories',
			'log_info "Setting up application structure..."',
			'',
			'if ! id "$APP_USER" &>/dev/null; then',
			'    useradd --system --shell /bin/bash --home-dir "$APP_DIR" --create-home "$APP_USER" || error_exit "Failed to create application user"',
			'fi',
			'',
			'mkdir -p "$APP_DIR/app" "$LOG_DIR" || error_exit "Failed to create directories"',
			'chown -R "$APP_USER:$APP_USER" "$APP_DIR" "$LOG_DIR" || error_exit "Failed to set permissions"',
			'chmod 755 "$APP_DIR" "$LOG_DIR" || error_exit "Failed to set directory permissions"',
			'',
			'log_info "Application structure setup completed"',
			'',
			'# Download and install bootstrap script',
			'log_info "Installing configuration bootstrap script..."',
			'',
			'bootstrap_script="/usr/local/bin/bootstrap-ec2-config.sh"',
			'curl -fsSL "$BOOTSTRAP_SCRIPT_URL" -o "$bootstrap_script" || error_exit "Failed to download bootstrap script"',
			'chmod +x "$bootstrap_script" || error_exit "Failed to make bootstrap script executable"',
			'',
			'log_info "Bootstrap script installed successfully"',
			'',
			'# Fetch configuration from Parameter Store',
			'log_info "Bootstrapping configuration from Parameter Store..."',
			'',
			'"$bootstrap_script" \\',
			'    --app-env "$APP_ENV" \\',
			'    --region "$AWS_REGION" \\',
			'    --env-file "/etc/macro-ai.env" \\',
			'    --verbose || error_exit "Failed to bootstrap configuration"',
			'',
			'log_info "Configuration bootstrap completed"',
			'',
			'# Deploy application',
			'log_info "Deploying application..."',
			'',
			'if [[ -z "$DEPLOYMENT_BUCKET" ]] || [[ -z "$DEPLOYMENT_KEY" ]]; then',
			'    error_exit "DEPLOYMENT_BUCKET and DEPLOYMENT_KEY must be set"',
			'fi',
			'',
			'temp_file="/tmp/app.tar.gz"',
			'',
			'# Download application artifact',
			'aws s3 cp "s3://$DEPLOYMENT_BUCKET/$DEPLOYMENT_KEY" "$temp_file" || error_exit "Failed to download application artifact"',
			'',
			'# Extract to application directory',
			'cd "$APP_DIR"',
			'tar -xzf "$temp_file" -C app --strip-components=1 || error_exit "Failed to extract application"',
			'',
			'# Set ownership',
			'chown -R "$APP_USER:$APP_USER" "$APP_DIR/app" || error_exit "Failed to set application ownership"',
			'',
			'# Clean up',
			'rm -f "$temp_file"',
			'',
			'log_info "Application deployment completed"',
			'',
			'# Install application dependencies',
			'log_info "Installing application dependencies..."',
			'',
			'cd "$APP_DIR/app"',
			'sudo -u "$APP_USER" npm ci --only=production || error_exit "Failed to install dependencies"',
			'',
			'log_info "Dependencies installation completed"',
			'',
			'# Create systemd service',
			'log_info "Creating systemd service..."',
			'',
			"cat > /etc/systemd/system/macro-ai.service << 'EOF'",
			'[Unit]',
			'Description=Macro AI Express API Server',
			'Documentation=https://github.com/RussOakham/macro-ai',
			'After=network.target',
			'Wants=network-online.target',
			'',
			'[Service]',
			'Type=simple',
			'User=macroai',
			'Group=macroai',
			'',
			'# Working directory',
			'WorkingDirectory=/opt/macro-ai/app',
			'',
			'# Environment file created by bootstrap script',
			'EnvironmentFile=/etc/macro-ai.env',
			'',
			'# Additional environment variables',
			'Environment=NODE_ENV=production',
			'',
			'# Application command',
			'ExecStart=/usr/bin/node dist/index.js',
			'',
			'# Restart configuration',
			'Restart=always',
			'RestartSec=10',
			'StartLimitInterval=60s',
			'StartLimitBurst=3',
			'',
			'# Resource limits',
			'LimitNOFILE=65536',
			'LimitNPROC=4096',
			'',
			'# Security settings',
			'NoNewPrivileges=true',
			'PrivateTmp=true',
			'ProtectSystem=strict',
			'ProtectHome=true',
			'ReadWritePaths=/opt/macro-ai/logs',
			'',
			'# Logging',
			'StandardOutput=journal',
			'StandardError=journal',
			'SyslogIdentifier=macro-ai',
			'',
			'# Process management',
			'KillMode=mixed',
			'KillSignal=SIGTERM',
			'TimeoutStopSec=30',
			'',
			'[Install]',
			'WantedBy=multi-user.target',
			'EOF',
			'',
			'# Reload systemd and enable service',
			'systemctl daemon-reload || error_exit "Failed to reload systemd"',
			'systemctl enable macro-ai.service || error_exit "Failed to enable service"',
			'',
			'log_info "Systemd service created and enabled"',
			'',
			'# Start application service',
			'log_info "Starting application service..."',
			'',
			'systemctl start macro-ai.service || error_exit "Failed to start service"',
			'',
			'# Wait for service to be ready',
			'max_attempts=30',
			'attempt=0',
			'',
			'while [[ $attempt -lt $max_attempts ]]; do',
			'    if systemctl is-active --quiet macro-ai.service; then',
			'        log_info "Service is running"',
			'        break',
			'    fi',
			'    ',
			'    attempt=$((attempt + 1))',
			'    log_info "Waiting for service to start (attempt $attempt/$max_attempts)..."',
			'    sleep 2',
			'done',
			'',
			'if [[ $attempt -eq $max_attempts ]]; then',
			'    error_exit "Service failed to start within expected time"',
			'fi',
			'',
			'log_info "Application started successfully"',
			'',
			'# Perform health check',
			'log_info "Performing health check..."',
			'',
			'max_attempts=30',
			'attempt=0',
			'health_url="http://localhost:3040/api/health"',
			'',
			'while [[ $attempt -lt $max_attempts ]]; do',
			'    if curl -f -s "$health_url" > /dev/null 2>&1; then',
			'        log_info "Health check passed"',
			'        break',
			'    fi',
			'    ',
			'    attempt=$((attempt + 1))',
			'    log_info "Health check attempt $attempt/$max_attempts..."',
			'    sleep 2',
			'done',
			'',
			'if [[ $attempt -eq $max_attempts ]]; then',
			'    log_error "Health check failed after $max_attempts attempts"',
			'    ',
			'    # Log service status for debugging',
			'    systemctl status macro-ai.service || true',
			'    journalctl -u macro-ai.service -n 20 || true',
			'    ',
			'    exit 1',
			'fi',
			'',
			'log_info "✅ Deployment completed successfully!"',
		)

		return userData
	}

	/**
	 * Apply comprehensive tagging for cost tracking and resource management
	 * Note: Avoid duplicate tag keys that might conflict with stack-level tags
	 */
	private applyTags(environmentName: string): void {
		// Apply construct-specific tags that don't conflict with stack-level tags
		cdk.Tags.of(this).add('SubComponent', 'EC2')
		cdk.Tags.of(this).add('SubPurpose', 'ComputeInfrastructure')
		cdk.Tags.of(this).add('ConstructManagedBy', 'Ec2Construct')
		cdk.Tags.of(this).add('InstanceType', 'EC2-Instance')

		// Add auto-cleanup tags for PR environments
		if (
			environmentName.startsWith('pr-') ||
			environmentName.includes('preview')
		) {
			const cleanupDate = new Date()
			cleanupDate.setDate(cleanupDate.getDate() + 7) // 7-day expiry
			const cleanupDateStr =
				cleanupDate.toISOString().split('T')[0] ??
				cleanupDate.toISOString().substring(0, 10)

			cdk.Tags.of(this).add('AutoCleanup', 'true')
			cdk.Tags.of(this).add('CleanupDate', cleanupDateStr)
			cdk.Tags.of(this).add('CostCenter', 'development')
		}

		// Note: Other tags like Environment, Project, Component, Purpose are inherited from stack level
	}

	/**
	 * Create CloudWatch alarms for instance monitoring
	 */
	public createInstanceAlarms(instance: ec2.Instance, prNumber?: number): void {
		const alarmPrefix = prNumber ? `PR${prNumber.toString()}` : 'EC2'

		// CPU utilization alarm
		new cdk.aws_cloudwatch.Alarm(this, `${alarmPrefix}HighCpuAlarm`, {
			metric: new cdk.aws_cloudwatch.Metric({
				namespace: 'AWS/EC2',
				metricName: 'CPUUtilization',
				dimensionsMap: {
					InstanceId: instance.instanceId,
				},
				statistic: 'Average',
			}),
			threshold: 80,
			evaluationPeriods: 2,
			alarmDescription: `High CPU utilization for ${instance.instanceId}`,
		})

		// Status check alarm
		new cdk.aws_cloudwatch.Alarm(this, `${alarmPrefix}StatusCheckAlarm`, {
			metric: new cdk.aws_cloudwatch.Metric({
				namespace: 'AWS/EC2',
				metricName: 'StatusCheckFailed',
				dimensionsMap: {
					InstanceId: instance.instanceId,
				},
				statistic: 'Maximum',
			}),
			threshold: 1,
			evaluationPeriods: 2,
			alarmDescription: `Status check failed for ${instance.instanceId}`,
		})
	}

	/**
	 * Generate EC2 configuration summary for documentation
	 */
	public generateEc2Summary(): string {
		return `
Macro AI EC2 Infrastructure Summary:

Instance Configuration:
- Launch Template: ${this.launchTemplate.launchTemplateName ?? 'undefined'}
- Instance Role: ${this.instanceRole.roleName}
- Machine Image: Amazon Linux 2023 (x86_64)
- Instance Type: t3.micro (cost-optimized)

Security:
- IAM Role: Least-privilege access to AWS services
- Session Manager: Secure access without SSH
- Security Groups: Network-level isolation per PR
- Instance Metadata: IMDSv2 required (security best practice)

Application Deployment:
- Runtime: Node.js 20 LTS
- Process Manager: systemd service (macro-ai.service)
- Port: 3040 (internal)
- User: macroai (non-root)

Monitoring:
- CloudWatch Logs: /macro-ai/{environment}/
- CloudWatch Metrics: MacroAI/EC2 namespace
- Alarms: CPU utilization, status checks
- Session Manager: Secure shell access

Cost Optimization:
- Instance Type: t3.micro (free tier eligible)
- Public Subnets: No NAT Gateway costs
- Shared Infrastructure: Single VPC across PRs
- Auto-termination: 7-day expiry tags for cleanup
		`.trim()
	}
}
