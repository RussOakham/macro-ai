import * as cdk from 'aws-cdk-lib'
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import type { Construct } from 'constructs'

import { CostMonitoringConstruct } from '../constructs/cost-monitoring-construct.js'
import { EnvironmentConfigConstruct } from '../constructs/environment-config-construct.js'
import { MonitoringConstruct } from '../constructs/monitoring-construct.js'
import { NetworkingConstruct } from '../constructs/networking.js'
import { ParameterStoreConstruct } from '../constructs/parameter-store-construct.js'
// Note: TaggingStrategy imports removed to avoid tag conflicts with constructs

export interface MacroAiPreviewStackProps extends cdk.StackProps {
	/**
	 * Environment name for the preview deployment (e.g., 'pr-123')
	 */
	readonly environmentName: string

	/**
	 * PR number for isolation and tagging
	 */
	readonly prNumber: number

	/**
	 * Branch name for the PR
	 */
	readonly branchName: string

	/**
	 * CORS allowed origins for the API
	 */
	readonly corsAllowedOrigins: string

	/**
	 * Deployment scale (preview, staging, production)
	 * @default 'preview'
	 */
	readonly scale?: string

	/**
	 * Email addresses for cost alert notifications
	 * Can be overridden via CDK context 'costAlertEmails'
	 */
	readonly costAlertEmails?: string[]

	/**
	 * Custom domain configuration for HTTPS endpoints
	 */
	readonly customDomain?: {
		readonly domainName: string
		readonly hostedZoneId: string
	}
}

/**
 * Preview stack for EC2-based PR environments
 *
 * This stack creates isolated preview environments for PRs using:
 * - EC2 instances with Auto Scaling Groups
 * - Application Load Balancer for traffic routing
 * - CloudWatch monitoring and observability
 * - Deployment status tracking
 * - Proper resource tagging for isolation and cleanup
 *
 * Uses Phase 4 production-ready constructs with preview-optimized configuration.
 */
export class MacroAiPreviewStack extends cdk.Stack {
	public readonly networking: NetworkingConstruct
	public readonly parameterStore: ParameterStoreConstruct
	public readonly environmentConfig: EnvironmentConfigConstruct
	public readonly autoScaling: autoscaling.AutoScalingGroup
	public readonly monitoring: MonitoringConstruct
	public readonly costMonitoring: CostMonitoringConstruct
	public readonly prNumber: number
	private readonly customDomain?: {
		readonly domainName: string
		readonly hostedZoneId: string
	}

	constructor(scope: Construct, id: string, props: MacroAiPreviewStackProps) {
		super(scope, id, props)

		const {
			environmentName,
			prNumber,
			branchName,
			corsAllowedOrigins,
			customDomain,
		} = props
		this.prNumber = prNumber
		this.customDomain = customDomain

		// Note: Base-level tags (Project, Environment, EnvironmentType, Component, Purpose, CreatedBy, ManagedBy, PRNumber, Branch, ExpiryDate, Scale, AutoShutdown)
		// are applied centrally via StackProps.tags in app.ts using TaggingStrategy.
		// Constructs should use only Sub* prefixed tags to avoid conflicts.

		// Create Parameter Store construct for configuration
		this.parameterStore = new ParameterStoreConstruct(this, 'ParameterStore', {
			environmentName,
		})

		// Create Environment Config construct that fetches Parameter Store values at synthesis time
		this.environmentConfig = new EnvironmentConfigConstruct(
			this,
			'EnvironmentConfig',
			{
				environmentName,
				isPreviewEnvironment: true,
			},
		)

		// Create deployment ID to force instance replacement on every deployment
		// This ensures fresh instances with latest application code, resolving CI timeout issues
		const deploymentId = `${prNumber}-${Date.now()}`

		// Create networking infrastructure optimized for preview environments
		this.networking = new NetworkingConstruct(this, 'Networking', {
			environmentName,
			enableFlowLogs: false, // Cost optimization for preview
			maxAzs: 2, // Minimum for ALB
			enableDetailedMonitoring: false, // Cost optimization
			parameterStorePrefix: this.parameterStore.parameterPrefix,
			deploymentId,
			enableNatGateway: false, // Cost optimization: eliminate NAT Gateway (~$2.76/month savings)
			enableVpcEndpoints: false, // Cost optimization: remove VPC endpoints for preview environments
			exportPrefix: this.stackName, // Use stack name to ensure unique exports per PR
			customDomain, // Pass custom domain configuration for HTTPS setup
			branchName,
			customDomainName: customDomain?.domainName,
		})

		// Validate networking requirements
		this.networking.validateAlbRequirements()

		// Create monitoring construct with preview-optimized settings
		this.monitoring = new MonitoringConstruct(this, 'Monitoring', {
			environmentName,
			applicationName: 'macro-ai',
			enableCostMonitoring: true,
			prNumber,
		})

		// Create cost monitoring construct for budget tracking and alerts
		this.costMonitoring = new CostMonitoringConstruct(this, 'CostMonitoring', {
			environmentName,
			monthlyBudgetLimit: 3.5, // ~£3 target in USD
			alertEmails: this.resolveCostAlertEmails(props),
			alertThresholds: [50, 80, 100], // Alert at 50%, 80%, and 100% of budget
			costFilters: {
				PRNumber: [prNumber.toString()],
			},
		})

		// Create custom launch template with CORS configuration for preview environments
		const previewLaunchTemplate = this.createPreviewLaunchTemplate(
			environmentName,
			corsAllowedOrigins,
			prNumber,
			branchName,
		)

		// Create simplified Auto Scaling for preview environments
		// Use a basic Auto Scaling Group without complex step scaling policies
		this.autoScaling = this.createPreviewAutoScalingGroup(previewLaunchTemplate)

		// Add scheduled scaling for cost optimization (off-hours shutdown)
		this.addScheduledScaling()

		// Stack outputs for GitHub Actions workflow
		// Use custom domain with HTTPS if provided, otherwise fallback to HTTP ALB DNS
		new cdk.CfnOutput(this, 'ApiEndpoint', {
			value: customDomain
				? `https://pr-${prNumber}-api.${customDomain.domainName}/api`
				: `http://${this.networking.albConstruct!.applicationLoadBalancer.loadBalancerDnsName}/api`,
			description: customDomain
				? 'API endpoint URL with custom domain (HTTPS) - pr-{number}-api.macro-ai.russoakham.dev pattern'
				: 'API endpoint URL for the preview environment (HTTP only)',
			exportName: `${this.stackName}-ApiEndpoint`,
		})

		new cdk.CfnOutput(this, 'LoadBalancerDNS', {
			value:
				this.networking.albConstruct!.applicationLoadBalancer
					.loadBalancerDnsName,
			description: 'Load Balancer DNS name',
			exportName: `${this.stackName}-LoadBalancerDNS`,
		})

		new cdk.CfnOutput(this, 'AutoScalingGroupName', {
			value: this.autoScaling.autoScalingGroupName,
			description: 'Auto Scaling Group name for deployment',
			exportName: `${this.stackName}-AutoScalingGroupName`,
		})

		new cdk.CfnOutput(this, 'DefaultTargetGroupArn', {
			value: this.networking.albConstruct!.defaultTargetGroup.targetGroupArn,
			description: 'Default target group ARN for ALB health checks',
			exportName: `${this.stackName}-DefaultTargetGroupArn`,
		})

		new cdk.CfnOutput(this, 'EC2InstanceId', {
			value: 'dynamic', // Will be populated by instances
			description: 'EC2 Instance ID (dynamic)',
			exportName: `${this.stackName}-EC2InstanceId`,
		})

		// VPC exports are handled by VpcConstruct to avoid duplication

		new cdk.CfnOutput(this, 'EnvironmentName', {
			value: environmentName,
			description: 'Environment name for the preview deployment',
			exportName: `${this.stackName}-EnvironmentName`,
		})

		new cdk.CfnOutput(this, 'PRNumber', {
			value: prNumber.toString(),
			description: 'PR number for this preview environment',
			exportName: `${this.stackName}-PRNumber`,
		})

		new cdk.CfnOutput(this, 'BranchName', {
			value: branchName,
			description: 'Branch name for this preview environment',
			exportName: `${this.stackName}-BranchName`,
		})

		// Monitoring and observability outputs
		new cdk.CfnOutput(this, 'MonitoringDashboardUrl', {
			value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.monitoring.dashboard.dashboardName}`,
			description: 'CloudWatch dashboard URL for monitoring',
			exportName: `${this.stackName}-MonitoringDashboardUrl`,
		})

		// Cost monitoring outputs
		new cdk.CfnOutput(this, 'CostMonitoringBudgetName', {
			value: `macro-ai-${environmentName}-monthly-budget`,
			description: 'AWS Budget name for cost monitoring',
			exportName: `${this.stackName}-CostMonitoringBudgetName`,
		})

		new cdk.CfnOutput(this, 'CostAlertTopicArn', {
			value: this.costMonitoring.alertTopic.topicArn,
			description: 'SNS topic ARN for cost alerts',
			exportName: `${this.stackName}-CostAlertTopicArn`,
		})
	}

	/**
	 * Create a custom launch template for preview environments with CORS configuration
	 */
	private createPreviewLaunchTemplate(
		environmentName: string,
		corsAllowedOrigins: string,
		prNumber: number,
		branchName: string,
	): ec2.LaunchTemplate {
		// Get the base EC2 construct for IAM role and security configuration
		if (!this.networking.ec2Construct) {
			throw new Error(
				'EC2 construct not available in NetworkingConstruct. Ensure parameterStorePrefix is provided.',
			)
		}

		// Get deployment artifact information from CDK context
		const deploymentBucket = this.node.tryGetContext('deploymentBucket') as
			| string
			| undefined
		const deploymentKey = this.node.tryGetContext('deploymentKey') as
			| string
			| undefined

		// Validate deployment artifact configuration
		if (!deploymentBucket || !deploymentKey) {
			throw new Error(
				'Deployment artifact configuration missing. Both deploymentBucket and deploymentKey must be provided in CDK context.',
			)
		}

		console.log('Deployment artifact configuration:')
		console.log(`  Bucket: ${deploymentBucket}`)
		console.log(`  Key: ${deploymentKey}`)

		// Create user data with CORS configuration and deployment artifact info
		const userData = this.createPreviewUserData(
			this.environmentConfig,
			corsAllowedOrigins,
			prNumber,
			branchName,
			this.customDomain,
			deploymentBucket,
			deploymentKey,
		)

		// Create launch template with preview-specific configuration
		return new ec2.LaunchTemplate(this, 'PreviewLaunchTemplate', {
			launchTemplateName: `macro-ai-${environmentName}-preview-launch-template`,
			instanceType: ec2.InstanceType.of(
				ec2.InstanceClass.T3,
				ec2.InstanceSize.NANO,
			), // Further cost-optimized for preview (50% cost reduction)
			machineImage: ec2.MachineImage.latestAmazonLinux2023({
				cpuType: ec2.AmazonLinuxCpuType.X86_64,
			}),
			// Use a PR-specific instance security group to allow ALB -> instance traffic on 3040
			securityGroup: this.networking.createPrSecurityGroup(prNumber),
			role: this.networking.ec2Construct.instanceRole,
			userData,
			detailedMonitoring: false, // Cost optimization for preview
			ebsOptimized: true,
			requireImdsv2: true, // Security best practice
			// Cost-optimized storage configuration
			blockDevices: [
				{
					deviceName: '/dev/xvda',
					volume: ec2.BlockDeviceVolume.ebs(8, {
						volumeType: ec2.EbsDeviceVolumeType.GP3,
						iops: 3000, // Baseline for gp3
						throughput: 125, // Baseline for gp3 (MB/s)
						deleteOnTermination: true,
						encrypted: true, // Security best practice
					}),
				},
			],
		})
	}

	/**
	 * Create user data script with environment configuration resolved at CDK synthesis time
	 * This approach ensures applications are environment-agnostic and receive all configuration
	 * at deployment time, not at runtime.
	 */
	private createPreviewUserData(
		environmentConfig: EnvironmentConfigConstruct,
		corsAllowedOrigins: string,
		prNumber: number,
		branchName: string,
		customDomain?: {
			readonly domainName: string
			readonly hostedZoneId: string
		},
		deploymentBucket?: string,
		deploymentKey?: string,
	): ec2.UserData {
		const userData = ec2.UserData.forLinux()

		// Add comprehensive deployment script with pre-resolved environment configuration
		userData.addCommands(
			'#!/bin/bash',
			'set -e',
			'',
			'# Logging setup',
			'exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1',
			'echo "$(date): Starting Macro AI preview deployment"',
			'',
			'# Error handling function',
			'error_exit() {',
			'  echo "$(date): ERROR: $1" >&2',
			'  exit 1',
			'}',
			'',
			'# Success function',
			'success_exit() {',
			'  echo "$(date): SUCCESS: Macro AI preview deployment completed"',
			'  exit 0',
			'}',
			'',
			'# Trap errors',
			'trap \'error_exit "Script failed at line $LINENO"\' ERR',
			'',
			'echo "$(date): Creating swap file for memory-constrained t3.nano instance..."',
			'# Create 1GB swap file to prevent OOM during package installations',
			'fallocate -l 1G /swapfile || error_exit "Failed to create swap file"',
			'chmod 600 /swapfile || error_exit "Failed to set swap file permissions"',
			'mkswap /swapfile || error_exit "Failed to format swap file"',
			'swapon /swapfile || error_exit "Failed to enable swap file"',
			'',
			'# Add swap to fstab for persistence across reboots',
			'echo "/swapfile none swap sw 0 0" >> /etc/fstab || error_exit "Failed to add swap to fstab"',
			'',
			'# Verify swap is active',
			'free -h | grep -i swap || error_exit "Swap verification failed"',
			'echo "$(date): Swap file created and activated successfully"',
			'',
			'echo "$(date): Updating system packages..."',
			'dnf update -y || error_exit "Failed to update system packages"',
			'',
			'echo "$(date): Installing Node.js 20 LTS from NodeSource..."',
			'# Add NodeSource repository for Node.js 20 LTS',
			'curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - || error_exit "Failed to add NodeSource repository"',
			'dnf install -y nodejs || error_exit "Failed to install Node.js"',
			'',
			'# Verify Node.js installation',
			'node --version || error_exit "Node.js installation verification failed"',
			'npm --version || error_exit "npm installation verification failed"',
			'',
			'echo "$(date): Installing additional system packages..."',
			'# Install packages, handling curl conflict with curl-minimal (curl-minimal is sufficient)',
			'dnf install -y git unzip wget amazon-cloudwatch-agent || error_exit "Failed to install system packages"',
			'',
			'echo "$(date): Setting up application user and directories..."',
			'useradd -m -s /bin/bash macroai || error_exit "Failed to create macroai user"',
			'mkdir -p /opt/macro-ai /var/log/macro-ai || error_exit "Failed to create directories"',
			'chown -R macroai:macroai /opt/macro-ai /var/log/macro-ai || error_exit "Failed to set ownership"',
			'',
			'# Environment configuration resolved at CDK synthesis time - no runtime Parameter Store calls needed',
			'echo "=== ENVIRONMENT CONFIGURATION (CDK SYNTHESIS TIME) ===" >> /var/log/user-data.log',
			'echo "All environment variables resolved during deployment - creating .env file..." >> /var/log/user-data.log',
			'',
			'# Set basic environment variables',
			'echo "=== SETTING BASIC ENVIRONMENT VARIABLES ===" >> /var/log/user-data.log',
			`echo "PARAMETER_STORE_PREFIX=${environmentConfig.parameterPrefix}" >> /etc/environment`,
			`echo "Setting PARAMETER_STORE_PREFIX=${environmentConfig.parameterPrefix}" >> /var/log/user-data.log`,
			'echo "NODE_ENV=production" >> /etc/environment',
			'echo "Setting NODE_ENV=production" >> /var/log/user-data.log',
			'echo "SERVER_PORT=3040" >> /etc/environment',
			'echo "Setting SERVER_PORT=3040" >> /var/log/user-data.log',
			`echo "APP_ENV=pr-${prNumber}" >> /etc/environment`,
			`echo "Setting APP_ENV=pr-${prNumber}" >> /var/log/user-data.log`,
			`echo "PR_NUMBER=${prNumber}" >> /etc/environment`,
			`echo "Setting PR_NUMBER=${prNumber}" >> /var/log/user-data.log`,
			`echo "BRANCH_NAME=${branchName}" >> /etc/environment`,
			`echo "Setting BRANCH_NAME=${branchName}" >> /var/log/user-data.log`,
			`echo "CORS_ALLOWED_ORIGINS=${corsAllowedOrigins}" >> /etc/environment`,
			`echo "Setting CORS_ALLOWED_ORIGINS=${corsAllowedOrigins}" >> /var/log/user-data.log`,
			customDomain
				? `echo "CUSTOM_DOMAIN_NAME=${customDomain.domainName}" >> /etc/environment`
				: '',
			customDomain
				? `echo "Setting CUSTOM_DOMAIN_NAME=${customDomain.domainName}" >> /var/log/user-data.log`
				: 'echo "CUSTOM_DOMAIN_NAME not set (no custom domain)" >> /var/log/user-data.log',
			'',
			'# Set deployment artifact configuration',
			'echo "=== DEPLOYMENT ARTIFACT CONFIGURATION ===" >> /var/log/user-data.log',
			`echo "DEPLOYMENT_BUCKET=${deploymentBucket}" >> /etc/environment`,
			`echo "Setting DEPLOYMENT_BUCKET=${deploymentBucket}" >> /var/log/user-data.log`,
			`echo "DEPLOYMENT_KEY=${deploymentKey}" >> /etc/environment`,
			`echo "Setting DEPLOYMENT_KEY=${deploymentKey}" >> /var/log/user-data.log`,
			'echo "DEPLOYMENT_VERSION=$(date +%Y%m%d-%H%M%S)" >> /etc/environment',
			'echo "Setting DEPLOYMENT_VERSION=$(date +%Y%m%d-%H%M%S)" >> /var/log/user-data.log',
			'',
			'# Set deployment variables as shell variables for immediate use',
			`DEPLOYMENT_BUCKET="${deploymentBucket}"`,
			`DEPLOYMENT_KEY="${deploymentKey}"`,
			'DEPLOYMENT_VERSION="$(date +%Y%m%d-%H%M%S)"',
			'echo "=== END DEPLOYMENT ARTIFACT CONFIGURATION ===" >> /var/log/user-data.log',
			'',
			'# Create .env file with pre-resolved environment configuration from CDK synthesis',
			'echo "=== CREATING .ENV FILE WITH CDK SYNTHESIS CONFIGURATION ===" >> /var/log/user-data.log',
			"cat > /opt/macro-ai/.env << 'EOF'",
			'# Environment configuration generated at CDK synthesis time',
			'# This file contains all required environment variables',
			`# Generated for environment: pr-${prNumber}`,
			'',
			`PARAMETER_STORE_PREFIX=${environmentConfig.parameterPrefix}`,
			'NODE_ENV=production',
			'SERVER_PORT=3040',
			`APP_ENV=pr-${prNumber}`,
			`PR_NUMBER=${prNumber}`,
			`BRANCH_NAME=${branchName}`,
			`CORS_ALLOWED_ORIGINS=${corsAllowedOrigins}`,
			customDomain ? `CUSTOM_DOMAIN_NAME=${customDomain.domainName}` : '',
			deploymentBucket ? `DEPLOYMENT_BUCKET=${deploymentBucket}` : '',
			deploymentKey ? `DEPLOYMENT_KEY=${deploymentKey}` : '',
			'',
			'# Application environment variables resolved at CDK synthesis time',
			environmentConfig.getEnvFileContent(),
			'EOF',
			'',
			'# Set proper permissions for the .env file',
			'chown macroai:macroai /opt/macro-ai/.env',
			'chmod 600 /opt/macro-ai/.env',
			'echo "✅ .env file created with CDK synthesis configuration" >> /var/log/user-data.log',
			'',
			'# Download and extract deployment package',
			'echo "$(date): Downloading deployment package..."',
			'cd /opt/macro-ai',
			'aws s3 cp s3://${DEPLOYMENT_BUCKET}/${DEPLOYMENT_KEY} . || error_exit "Failed to download deployment package"',
			'',
			'# Extract deployment package',
			'echo "$(date): Extracting deployment package..."',
			'tar -xzf express-api-deployment.tar.gz || error_exit "Failed to extract deployment package"',
			'rm express-api-deployment.tar.gz',
			'',
			'# Install dependencies',
			'echo "$(date): Installing Node.js dependencies..."',
			'sudo -u macroai pnpm install --frozen-lockfile || error_exit "Failed to install dependencies"',
			'',
			'# Create systemd service with pre-resolved environment variables',
			'echo "$(date): Creating systemd service..."',
			"cat > /etc/systemd/system/macro-ai.service << 'EOF'",
			'[Unit]',
			'Description=Macro AI Express API',
			'After=network.target',
			'',
			'[Service]',
			'Type=simple',
			'User=macroai',
			'Group=macroai',
			'WorkingDirectory=/opt/macro-ai',
			'ExecStart=/usr/bin/node dist/index.js',
			'Restart=always',
			'RestartSec=10',
			'StandardOutput=journal',
			'StandardError=journal',
			'SyslogIdentifier=macro-ai',
			'',
			'# Environment variables resolved at CDK synthesis time',
			environmentConfig.getSystemdEnvironmentVariables(),
			'',
			'# Additional environment variables',
			`PARAMETER_STORE_PREFIX=${environmentConfig.parameterPrefix}`,
			'NODE_ENV=production',
			'SERVER_PORT=3040',
			`APP_ENV=pr-${prNumber}`,
			`PR_NUMBER=${prNumber}`,
			`BRANCH_NAME=${branchName}`,
			`CORS_ALLOWED_ORIGINS=${corsAllowedOrigins}`,
			customDomain ? `CUSTOM_DOMAIN_NAME=${customDomain.domainName}` : '',
			deploymentBucket ? `DEPLOYMENT_BUCKET=${deploymentBucket}` : '',
			deploymentKey ? `DEPLOYMENT_KEY=${deploymentKey}` : '',
			'',
			'[Install]',
			'WantedBy=multi-user.target',
			'EOF',
			'',
			'# Reload systemd and enable service',
			'systemctl daemon-reload',
			'systemctl enable macro-ai.service',
			'',
			'# Start the service',
			'echo "$(date): Starting Macro AI service..."',
			'systemctl start macro-ai.service || error_exit "Failed to start service"',
			'',
			'# Wait for service to be ready',
			'echo "$(date): Waiting for service to be ready..."',
			'sleep 10',
			'',
			'# Check service status',
			'if systemctl is-active --quiet macro-ai.service; then',
			'  echo "$(date): ✅ Macro AI service is running successfully"',
			'  echo "$(date): Service status:"',
			'  systemctl status macro-ai.service --no-pager -l',
			'else',
			'  echo "$(date): ❌ Macro AI service failed to start"',
			'  echo "$(date): Service logs:"',
			'  journalctl -u macro-ai.service --no-pager -l',
			'  error_exit "Service failed to start"',
			'fi',
			'',
			'# Health check',
			'echo "$(date): Performing health check..."',
			'for i in {1..30}; do',
			'  if curl -f http://localhost:3040/api/health > /dev/null 2>&1; then',
			'    echo "$(date): ✅ Health check passed"',
			'    break',
			'  fi',
			'  if [ $i -eq 30 ]; then',
			'    echo "$(date): ❌ Health check failed after 30 attempts"',
			'    error_exit "Health check failed"',
			'  fi',
			'  echo "$(date): Health check attempt $i/30 - waiting..."',
			'  sleep 2',
			'done',
			'',
			'# Success',
			'echo "$(date): 🎉 Macro AI preview deployment completed successfully!"',
			'echo "$(date): Service is running on port 3040"',
			'echo "$(date): Health check endpoint: http://localhost:3040/api/health"',
			'',
			'success_exit',
		)

		return userData
	}

	/**
	 * Create a simplified Auto Scaling Group for preview environments
	 * Avoids complex step scaling policies that require multiple intervals
	 */
	private createPreviewAutoScalingGroup(
		launchTemplate: ec2.LaunchTemplate,
	): autoscaling.AutoScalingGroup {
		const asg = new autoscaling.AutoScalingGroup(
			this,
			'PreviewAutoScalingGroup',
			{
				vpc: this.networking.vpc,
				launchTemplate,
				// Resource consolidation - minimal capacity for preview environments
				minCapacity: 1, // Single instance minimum for cost optimization
				maxCapacity: 2, // Limited scaling to control costs
				desiredCapacity: 1, // Start with single instance

				// Health check configuration - extended grace period for debugging
				healthChecks: {
					types: ['ELB'],
					gracePeriod: cdk.Duration.minutes(15), // Extended from 5 to 15 minutes for startup debugging
				},

				// Instance distribution - use public subnets for cost optimization
				vpcSubnets: {
					subnetType: ec2.SubnetType.PUBLIC,
				},

				// Termination policies
				terminationPolicies: [
					autoscaling.TerminationPolicy.OLDEST_INSTANCE,
					autoscaling.TerminationPolicy.DEFAULT,
				],

				// Auto scaling group name - parameterized with PR number to avoid conflicts
				autoScalingGroupName: `macro-ai-pr-${this.prNumber}-asg`,
			},
		)

		// Register with ALB target group if available
		// For PR previews, each PR gets its own ALB, so using default target group is fine
		if (this.networking.albConstruct) {
			asg.attachToApplicationTargetGroup(
				this.networking.albConstruct.defaultTargetGroup,
			)
		}

		// Add simple target tracking scaling policy (CPU-based)
		asg.scaleOnCpuUtilization('CpuScaling', {
			targetUtilizationPercent: 70,
		})

		// Add tags for preview environment (avoid conflicts with stack-level tags)
		cdk.Tags.of(asg).add('SubComponent', 'AutoScaling')
		cdk.Tags.of(asg).add('DeploymentType', 'ec2-preview')
		cdk.Tags.of(asg).add('ScalingType', 'target-tracking')
		// Note: Environment, Component, Purpose are inherited from stack-level TaggingStrategy

		return asg
	}

	/**
	 * Add scheduled scaling for cost optimization
	 * Scale down to 0 instances at 6 PM UTC (off-hours)
	 * Scale up to 1 instance at 8 AM UTC (business hours)
	 *
	 * This provides ~$1.45/month savings by reducing uptime by 50%
	 */
	private addScheduledScaling(): void {
		// Scale down to 0 instances at 6 PM UTC (18:00) every day
		// This shuts down preview environments during off-hours
		new autoscaling.ScheduledAction(this, 'ScaleDownSchedule', {
			autoScalingGroup: this.autoScaling,
			schedule: autoscaling.Schedule.cron({
				minute: '0',
				hour: '18', // 6 PM UTC
				day: '*', // Every day
				month: '*', // Every month
			}),
			minCapacity: 0,
			maxCapacity: 0,
			desiredCapacity: 0,
		})

		// Scale up to 1 instance at 8 AM UTC (08:00) every day
		// This starts preview environments for business hours
		new autoscaling.ScheduledAction(this, 'ScaleUpSchedule', {
			autoScalingGroup: this.autoScaling,
			schedule: autoscaling.Schedule.cron({
				minute: '0',
				hour: '8', // 8 AM UTC
				day: '*', // Every day
				month: '*', // Every month
			}),
			minCapacity: 1,
			maxCapacity: 1,
			desiredCapacity: 1,
		})

		// Add tags to identify scheduled scaling
		cdk.Tags.of(this.autoScaling).add('ScheduledScaling', 'enabled')
		cdk.Tags.of(this.autoScaling).add('OffHoursShutdown', '18:00-08:00 UTC')
		cdk.Tags.of(this.autoScaling).add('CostOptimization', 'scheduled-scaling')
	}

	/**
	 * Resolve cost alert email addresses from props and CDK context
	 * Supports configuration via props.costAlertEmails or context "costAlertEmails"
	 */
	private resolveCostAlertEmails(props: MacroAiPreviewStackProps): string[] {
		const fromProps = props.costAlertEmails ?? []
		// Allow overrides via cdk.json context: { "costAlertEmails": ["ops@example.com"] }
		const fromContext =
			(this.node.tryGetContext('costAlertEmails') as string[] | undefined) ?? []
		const emails = [...fromContext, ...fromProps].filter(Boolean)
		if (emails.length === 0) {
			// Prefer failing fast instead of silently configuring no alerts
			throw new Error(
				'Cost alert emails not configured. Provide via props.costAlertEmails or context "costAlertEmails".',
			)
		}
		return Array.from(new Set(emails))
	}
}
