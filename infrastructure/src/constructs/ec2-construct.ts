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
		)

		// Apply tags to the construct
		this.applyTags()
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

		// Parameter Store access (scoped to our parameters only)
		role.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'ssm:GetParameter',
					'ssm:GetParameters',
					'ssm:GetParametersByPath',
				],
				resources: [`arn:aws:ssm:*:*:parameter${parameterStorePrefix}/*`],
			}),
		)

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
			),
			detailedMonitoring: enableDetailedMonitoring,
			// EBS optimization for better performance
			ebsOptimized: true,
			// Instance metadata service v2 (security best practice)
			requireImdsv2: true,
		})
	}

	/**
	 * Create comprehensive user data script for automated application deployment
	 */
	private createUserData(
		parameterStorePrefix: string,
		prNumber?: number,
		deploymentId?: string,
	): ec2.UserData {
		const userData = ec2.UserData.forLinux()

		// Add deployment timestamp to force instance replacement
		const timestamp = deploymentId ?? new Date().toISOString()

		// Add comprehensive deployment script
		userData.addCommands(
			'#!/bin/bash',
			'set -e',
			'',
			`# Deployment ID: ${timestamp}`,
			'# This timestamp forces new instances on every deployment to ensure fresh application code',
			'',
			'# Logging setup',
			'exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1',
			`echo "$(date): Starting Macro AI application deployment (Deployment ID: ${timestamp})"`,
			'',
			'# Error handling function',
			'error_exit() {',
			'  echo "$(date): ERROR: $1" >&2',
			'  # Only send CloudFormation signal if running in CloudFormation context',
			'  if [[ -n "${AWS::StackName:-}" && -n "${AWS::LogicalResourceId:-}" && -n "${AWS::Region:-}" ]]; then',
			'    /opt/aws/bin/cfn-signal -e 1 --stack ${AWS::StackName} --resource ${AWS::LogicalResourceId} --region ${AWS::Region}',
			'  else',
			'    echo "$(date): Not running in CloudFormation context, skipping cfn-signal"',
			'  fi',
			'  exit 1',
			'}',
			'',
			'# Success signal function',
			'success_exit() {',
			'  echo "$(date): SUCCESS: Deployment completed successfully"',
			'  # Only send CloudFormation signal if running in CloudFormation context',
			'  if [[ -n "${AWS::StackName:-}" && -n "${AWS::LogicalResourceId:-}" && -n "${AWS::Region:-}" ]]; then',
			'    /opt/aws/bin/cfn-signal -e 0 --stack ${AWS::StackName} --resource ${AWS::LogicalResourceId} --region ${AWS::Region}',
			'  else',
			'    echo "$(date): Not running in CloudFormation context, skipping cfn-signal"',
			'  fi',
			'}',
			'',
			'# Trap errors',
			'trap \'error_exit "Script failed at line $LINENO"\' ERR',
		)

		// Continue with system setup
		userData.addCommands(
			'',
			'echo "$(date): Updating system packages..."',
			'dnf update -y || error_exit "Failed to update system packages"',
			'',
			'echo "$(date): Installing Node.js 20 LTS..."',
			'# Install Node.js 20 from NodeSource repository for latest version',
			'curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - || error_exit "Failed to setup NodeSource repository"',
			'dnf install -y nodejs || error_exit "Failed to install Node.js"',
			'',
			'# Verify Node.js installation',
			'node_version=$(node --version)',
			'npm_version=$(npm --version)',
			'echo "$(date): Node.js version: $node_version"',
			'echo "$(date): npm version: $npm_version"',
			'',
			'echo "$(date): Installing global dependencies..."',
			'npm install -g pm2 pnpm || error_exit "Failed to install global dependencies"',
			'',
			'echo "$(date): Installing additional system packages..."',
			'dnf install -y git unzip wget curl amazon-cloudwatch-agent || error_exit "Failed to install system packages"',
		)

		// Add user and directory setup
		this.addUserSetup(userData, parameterStorePrefix, prNumber)

		// Add application deployment
		this.addApplicationDeployment(userData)

		// Add service configuration
		this.addServiceConfiguration(userData, parameterStorePrefix, prNumber)

		// Add monitoring and cleanup
		this.addMonitoringSetup(userData)

		// Final success signal
		userData.addCommands(
			'',
			'echo "$(date): All deployment steps completed successfully"',
			'success_exit',
		)

		return userData
	}

	/**
	 * Add user and directory setup to user data script
	 */
	private addUserSetup(
		userData: ec2.UserData,
		parameterStorePrefix: string,
		prNumber?: number,
	): void {
		userData.addCommands(
			'',
			'echo "$(date): Setting up application user and directories..."',
			'',
			'# Create application user',
			'useradd -m -s /bin/bash macroai || error_exit "Failed to create macroai user"',
			'',
			'# Create application directories',
			'mkdir -p /opt/macro-ai || error_exit "Failed to create application directory"',
			'mkdir -p /var/log/macro-ai || error_exit "Failed to create log directory"',
			'mkdir -p /opt/macro-ai/releases || error_exit "Failed to create releases directory"',
			'mkdir -p /opt/macro-ai/shared || error_exit "Failed to create shared directory"',
			'',
			'# Set ownership',
			'chown -R macroai:macroai /opt/macro-ai || error_exit "Failed to set ownership on application directory"',
			'chown -R macroai:macroai /var/log/macro-ai || error_exit "Failed to set ownership on log directory"',
			'',
			'# Set environment variables',
			`echo "PARAMETER_STORE_PREFIX=${parameterStorePrefix}" >> /etc/environment`,
			'echo "NODE_ENV=production" >> /etc/environment',
			'echo "SERVER_PORT=3040" >> /etc/environment',
			'echo "APP_ENV=production" >> /etc/environment',
			prNumber
				? `echo "PR_NUMBER=${prNumber.toString()}" >> /etc/environment`
				: '',
			'',
			'# Create environment file for the application',
			'cat > /opt/macro-ai/.env << EOF',
			`PARAMETER_STORE_PREFIX=${parameterStorePrefix}`,
			'NODE_ENV=production',
			'SERVER_PORT=3040',
			'APP_ENV=production',
			prNumber ? `PR_NUMBER=${prNumber.toString()}` : '',
			'EOF',
			'',
			'chown macroai:macroai /opt/macro-ai/.env',
			'chmod 600 /opt/macro-ai/.env',
		)
	}

	/**
	 * Add application deployment logic to user data script
	 */
	private addApplicationDeployment(userData: ec2.UserData): void {
		userData.addCommands(
			'',
			'echo "$(date): Setting up application deployment..."',
			'',
			'# Create deployment script',
			"cat > /opt/macro-ai/deploy.sh << 'DEPLOY_SCRIPT'",
			'#!/bin/bash',
			'set -e',
			'',
			'RELEASE_DIR="/opt/macro-ai/releases/$(date +%Y%m%d_%H%M%S)"',
			'CURRENT_DIR="/opt/macro-ai/current"',
			'APP_DIR="/opt/macro-ai"',
			'',
			'echo "$(date): Starting application deployment to $RELEASE_DIR"',
			'',
			'# Create release directory',
			'mkdir -p "$RELEASE_DIR"',
			'cd "$RELEASE_DIR"',
			'',
			'# For now, create a placeholder application structure',
			'# This will be replaced by actual artifact deployment in CI/CD',
			'echo "$(date): Creating placeholder application structure..."',
			'mkdir -p dist src',
			'',
			'# Create a basic package.json',
			'cat > package.json << EOF',
			'{',
			'  "name": "macro-ai-express-api",',
			'  "version": "1.0.0",',
			'  "type": "module",',
			'  "main": "dist/index.js",',
			'  "scripts": {',
			'    "start": "node dist/index.js"',
			'  },',
			'  "engines": {',
			'    "node": ">=20.0.0"',
			'  },',
			'  "dependencies": {',
			'    "express": "^4.21.2"',
			'  }',
			'}',
			'EOF',
			'',
			'# Install dependencies',
			'echo "$(date): Installing npm dependencies..."',
			'npm install --production --no-audit --no-fund',
			'',
			'# Create a basic Express server as placeholder',
			'cat > dist/index.js << EOF',
			'import express from "express";',
			'import { createServer } from "http";',
			'',
			'const app = express();',
			'const port = process.env.SERVER_PORT || 3040;',
			'',
			'// Health check endpoint',
			'app.get("/api/health", (req, res) => {',
			'  res.json({',
			'    status: "healthy",',
			'    timestamp: new Date().toISOString(),',
			'    environment: process.env.NODE_ENV || "development",',
			'    version: "1.0.0"',
			'  });',
			'});',
			'',
			'// Root endpoint',
			'app.get("/", (req, res) => {',
			'  res.json({',
			'    message: "Macro AI Express API",',
			'    status: "running",',
			'    timestamp: new Date().toISOString()',
			'  });',
			'});',
			'',
			'const server = createServer(app);',
			'',
			'server.listen(port, () => {',
			'  console.log(`Server running on port ${port}`);',
			'});',
			'',
			'// Graceful shutdown',
			'process.on("SIGTERM", () => {',
			'  console.log("SIGTERM received, shutting down gracefully");',
			'  server.close(() => {',
			'    console.log("Process terminated");',
			'    process.exit(0);',
			'  });',
			'});',
			'EOF',
			'DEPLOY_SCRIPT',
		)
	}

	/**
	 * Add service configuration to user data script
	 */
	private addServiceConfiguration(
		userData: ec2.UserData,
		parameterStorePrefix: string,
		prNumber?: number,
	): void {
		userData.addCommands(
			'',
			'# Make deployment script executable',
			'chmod +x /opt/macro-ai/deploy.sh',
			'chown macroai:macroai /opt/macro-ai/deploy.sh',
			'',
			'echo "$(date): Running initial deployment..."',
			'sudo -u macroai /opt/macro-ai/deploy.sh || error_exit "Failed to run initial deployment"',
			'',
			'echo "$(date): Creating systemd service..."',
			'',
			'# Create systemd service file',
			'cat > /etc/systemd/system/macro-ai.service << EOF',
			'[Unit]',
			'Description=Macro AI Express API',
			'After=network.target',
			'Wants=network-online.target',
			'',
			'[Service]',
			'Type=simple',
			'User=macroai',
			'Group=macroai',
			'WorkingDirectory=/opt/macro-ai/current',
			'ExecStart=/usr/bin/node dist/index.js',
			'ExecReload=/bin/kill -HUP $MAINPID',
			'Restart=always',
			'RestartSec=10',
			'StartLimitInterval=60s',
			'StartLimitBurst=3',
			'',
			'# Environment variables',
			'Environment=NODE_ENV=production',
			'Environment=SERVER_PORT=3040',
			'Environment=APP_ENV=production',
			`Environment=PARAMETER_STORE_PREFIX=${parameterStorePrefix}`,
			prNumber ? `Environment=PR_NUMBER=${prNumber.toString()}` : '',
			'',
			'# Security settings',
			'NoNewPrivileges=true',
			'PrivateTmp=true',
			'ProtectSystem=strict',
			'ProtectHome=true',
			'ReadWritePaths=/opt/macro-ai /var/log/macro-ai',
			'',
			'# Logging',
			'StandardOutput=journal',
			'StandardError=journal',
			'SyslogIdentifier=macro-ai',
			'',
			'[Install]',
			'WantedBy=multi-user.target',
			'EOF',
			'',
			'# Create PM2 ecosystem file for advanced process management',
			'cat > /opt/macro-ai/ecosystem.config.js << EOF',
			'module.exports = {',
			'  apps: [{',
			'    name: "macro-ai-api",',
			'    script: "dist/index.js",',
			'    cwd: "/opt/macro-ai/current",',
			'    instances: 1,',
			'    exec_mode: "fork",',
			'    env: {',
			'      NODE_ENV: "production",',
			'      SERVER_PORT: 3040,',
			'      APP_ENV: "production",',
			`      PARAMETER_STORE_PREFIX: "${parameterStorePrefix}",`,
			prNumber ? `      PR_NUMBER: "${prNumber.toString()}",` : '',
			'    },',
			'    error_file: "/var/log/macro-ai/error.log",',
			'    out_file: "/var/log/macro-ai/out.log",',
			'    log_file: "/var/log/macro-ai/combined.log",',
			'    time: true,',
			'    max_restarts: 10,',
			'    min_uptime: "10s",',
			'    max_memory_restart: "500M"',
			'  }]',
			'};',
			'EOF',
			'',
			'chown macroai:macroai /opt/macro-ai/ecosystem.config.js',
			'',
			'# Enable and start the service',
			'systemctl daemon-reload || error_exit "Failed to reload systemd"',
			'systemctl enable macro-ai.service || error_exit "Failed to enable macro-ai service"',
			'systemctl start macro-ai.service || error_exit "Failed to start macro-ai service"',
			'',
			'# Wait for service to start and verify',
			'sleep 10',
			'systemctl is-active --quiet macro-ai.service || error_exit "Macro AI service is not running"',
			'echo "$(date): Macro AI service started successfully"',
		)
	}

	/**
	 * Add monitoring and logging setup to user data script
	 */
	private addMonitoringSetup(userData: ec2.UserData): void {
		userData.addCommands(
			'',
			'echo "$(date): Setting up monitoring and logging..."',
			'',
			'# Configure CloudWatch agent',
			'cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << EOF',
			'{',
			'  "agent": {',
			'    "metrics_collection_interval": 60,',
			'    "run_as_user": "cwagent"',
			'  },',
			'  "logs": {',
			'    "logs_collected": {',
			'      "files": {',
			'        "collect_list": [',
			'          {',
			'            "file_path": "/var/log/macro-ai/combined.log",',
			'            "log_group_name": "/aws/ec2/macro-ai/application",',
			'            "log_stream_name": "{instance_id}/application.log",',
			'            "timezone": "UTC"',
			'          },',
			'          {',
			'            "file_path": "/var/log/user-data.log",',
			'            "log_group_name": "/aws/ec2/macro-ai/user-data",',
			'            "log_stream_name": "{instance_id}/user-data.log",',
			'            "timezone": "UTC"',
			'          },',
			'          {',
			'            "file_path": "/var/log/messages",',
			'            "log_group_name": "/aws/ec2/macro-ai/system",',
			'            "log_stream_name": "{instance_id}/messages.log",',
			'            "timezone": "UTC"',
			'          }',
			'        ]',
			'      }',
			'    }',
			'  },',
			'  "metrics": {',
			'    "namespace": "MacroAI/EC2",',
			'    "metrics_collected": {',
			'      "cpu": {',
			'        "measurement": ["cpu_usage_idle", "cpu_usage_iowait", "cpu_usage_user", "cpu_usage_system"],',
			'        "metrics_collection_interval": 60',
			'      },',
			'      "disk": {',
			'        "measurement": ["used_percent"],',
			'        "metrics_collection_interval": 60,',
			'        "resources": ["*"]',
			'      },',
			'      "diskio": {',
			'        "measurement": ["io_time"],',
			'        "metrics_collection_interval": 60,',
			'        "resources": ["*"]',
			'      },',
			'      "mem": {',
			'        "measurement": ["mem_used_percent"],',
			'        "metrics_collection_interval": 60',
			'      },',
			'      "netstat": {',
			'        "measurement": ["tcp_established", "tcp_time_wait"],',
			'        "metrics_collection_interval": 60',
			'      },',
			'      "swap": {',
			'        "measurement": ["swap_used_percent"],',
			'        "metrics_collection_interval": 60',
			'      }',
			'    }',
			'  }',
			'}',
			'EOF',
			'',
			'# Start CloudWatch agent',
			'/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \\',
			'  -a fetch-config \\',
			'  -m ec2 \\',
			'  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json \\',
			'  -s || error_exit "Failed to start CloudWatch agent"',
			'',
			'echo "$(date): CloudWatch agent configured and started"',
			'',
			'# Create log rotation configuration',
			'cat > /etc/logrotate.d/macro-ai << EOF',
			'/var/log/macro-ai/*.log {',
			'    daily',
			'    missingok',
			'    rotate 7',
			'    compress',
			'    delaycompress',
			'    notifempty',
			'    create 644 macroai macroai',
			'    postrotate',
			'        systemctl reload macro-ai.service > /dev/null 2>&1 || true',
			'    endscript',
			'}',
			'EOF',
			'',
			'echo "$(date): Log rotation configured"',
		)
	}

	/**
	 * Apply comprehensive tagging for cost tracking and resource management
	 * Note: Avoid duplicate tag keys that might conflict with stack-level tags
	 */
	private applyTags(): void {
		// Apply construct-specific tags that don't conflict with stack-level tags
		cdk.Tags.of(this).add('SubComponent', 'EC2')
		cdk.Tags.of(this).add('SubPurpose', 'ComputeInfrastructure')
		cdk.Tags.of(this).add('ConstructManagedBy', 'Ec2Construct')
		cdk.Tags.of(this).add('InstanceType', 'EC2-Instance')
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
- Process Manager: PM2
- Service: systemd service (macro-ai.service)
- Port: 3030 (internal)
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

	/**
	 * Enable Phase 4 comprehensive monitoring integration
	 * This method provides a convenient way to add monitoring tags to the launch template
	 */
	public enableComprehensiveMonitoring(props: {
		criticalAlertEmails?: string[]
		warningAlertEmails?: string[]
		enableCostMonitoring?: boolean
		customMetricNamespace?: string
	}): void {
		// This method would be called by the stack to enable monitoring
		// The actual MonitoringIntegration would be created at the stack level

		// Add monitoring-specific tags to the launch template
		// These tags will be applied to all instances created from this template
		cdk.Tags.of(this.launchTemplate).add('MonitoringEnabled', 'true')
		cdk.Tags.of(this.launchTemplate).add('Phase4Monitoring', 'enabled')
		cdk.Tags.of(this.launchTemplate).add('MonitoringIntegration', 'ready')

		// Add configuration-specific tags based on props
		if (props.enableCostMonitoring) {
			cdk.Tags.of(this.launchTemplate).add('CostMonitoringEnabled', 'true')
		}

		if (props.customMetricNamespace) {
			cdk.Tags.of(this.launchTemplate).add(
				'CustomMetricNamespace',
				props.customMetricNamespace,
			)
		}

		if (props.criticalAlertEmails && props.criticalAlertEmails.length > 0) {
			cdk.Tags.of(this.launchTemplate).add('CriticalAlertsConfigured', 'true')
		}

		if (props.warningAlertEmails && props.warningAlertEmails.length > 0) {
			cdk.Tags.of(this.launchTemplate).add('WarningAlertsConfigured', 'true')
		}

		// TODO: Implement full monitoring configuration integration
		// - Create CloudWatch agent configuration
		// - Set up custom metrics collection
		// - Configure alert email distribution lists
		// - Integrate with MonitoringIntegration construct

		// Log monitoring enablement
		console.log(
			'Phase 4 monitoring integration enabled for EC2 launch template',
		)
	}
}
