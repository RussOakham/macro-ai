import * as cdk from 'aws-cdk-lib'
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import type { Construct } from 'constructs'

import { DeploymentStatusConstruct } from '../constructs/deployment-status-construct.js'
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
	public readonly autoScaling: autoscaling.AutoScalingGroup
	public readonly monitoring: MonitoringConstruct
	public readonly deploymentStatus: DeploymentStatusConstruct

	constructor(scope: Construct, id: string, props: MacroAiPreviewStackProps) {
		super(scope, id, props)

		const {
			environmentName,
			prNumber,
			branchName,
			corsAllowedOrigins,
			scale = 'preview',
		} = props

		// Note: Base-level tags (Project, Environment, EnvironmentType, Component, Purpose, CreatedBy, ManagedBy, PRNumber, Branch, ExpiryDate, Scale, AutoShutdown)
		// are applied centrally via StackProps.tags in app.ts using TaggingStrategy.
		// Constructs should use only Sub* prefixed tags to avoid conflicts.

		// Create Parameter Store construct for configuration
		this.parameterStore = new ParameterStoreConstruct(this, 'ParameterStore', {
			environmentName,
		})

		// Create networking infrastructure optimized for preview environments
		this.networking = new NetworkingConstruct(this, 'Networking', {
			environmentName,
			enableFlowLogs: false, // Cost optimization for preview
			maxAzs: 2, // Minimum for ALB
			enableDetailedMonitoring: false, // Cost optimization
			parameterStorePrefix: this.parameterStore.parameterPrefix,
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

		// Create deployment status tracking
		this.deploymentStatus = new DeploymentStatusConstruct(
			this,
			'DeploymentStatus',
			{
				environmentName,
				applicationName: 'macro-ai',
			},
		)

		// Stack outputs for GitHub Actions workflow
		new cdk.CfnOutput(this, 'ApiEndpoint', {
			value: `https://${this.networking.albConstruct!.applicationLoadBalancer.loadBalancerDnsName}/api`,
			description: 'API endpoint URL for the preview environment',
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

		new cdk.CfnOutput(this, 'EC2InstanceId', {
			value: 'dynamic', // Will be populated by instances
			description: 'EC2 Instance ID (dynamic)',
			exportName: `${this.stackName}-EC2InstanceId`,
		})

		new cdk.CfnOutput(this, 'VpcId', {
			value: this.networking.vpcId,
			description: 'VPC ID for the preview environment',
			exportName: `${this.stackName}-VpcId`,
		})

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

		new cdk.CfnOutput(this, 'DeploymentStatusTableName', {
			value: this.deploymentStatus.deploymentHistoryTable.tableName,
			description: 'DynamoDB table name for deployment status tracking',
			exportName: `${this.stackName}-DeploymentStatusTableName`,
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

		// Create user data with CORS configuration
		const userData = this.createPreviewUserData(
			this.parameterStore.parameterPrefix,
			corsAllowedOrigins,
			prNumber,
			branchName,
		)

		// Create launch template with preview-specific configuration
		return new ec2.LaunchTemplate(this, 'PreviewLaunchTemplate', {
			launchTemplateName: `macro-ai-${environmentName}-preview-launch-template`,
			instanceType: ec2.InstanceType.of(
				ec2.InstanceClass.T3,
				ec2.InstanceSize.MICRO,
			), // Cost-optimized for preview
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
		})
	}

	/**
	 * Create user data script with CORS configuration for preview environments
	 */
	private createPreviewUserData(
		parameterStorePrefix: string,
		corsAllowedOrigins: string,
		prNumber: number,
		branchName: string,
	): ec2.UserData {
		const userData = ec2.UserData.forLinux()

		// Add comprehensive deployment script with CORS configuration
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
			'dnf install -y git unzip wget curl amazon-cloudwatch-agent || error_exit "Failed to install system packages"',
			'',
			'echo "$(date): Setting up application user and directories..."',
			'useradd -m -s /bin/bash macroai || error_exit "Failed to create macroai user"',
			'mkdir -p /opt/macro-ai /var/log/macro-ai || error_exit "Failed to create directories"',
			'chown -R macroai:macroai /opt/macro-ai /var/log/macro-ai || error_exit "Failed to set ownership"',
			'',
			'# Set environment variables including CORS configuration',
			`echo "PARAMETER_STORE_PREFIX=${parameterStorePrefix}" >> /etc/environment`,
			'echo "NODE_ENV=production" >> /etc/environment',
			'echo "SERVER_PORT=3040" >> /etc/environment',
			'echo "APP_ENV=production" >> /etc/environment',
			`echo "PR_NUMBER=${prNumber}" >> /etc/environment`,
			`echo "BRANCH_NAME=${branchName}" >> /etc/environment`,
			`echo "CORS_ALLOWED_ORIGINS=${corsAllowedOrigins}" >> /etc/environment`,
			'',
			'# Create .env file for the application',
			'cat > /opt/macro-ai/.env << EOF',
			`PARAMETER_STORE_PREFIX=${parameterStorePrefix}`,
			'NODE_ENV=production',
			'SERVER_PORT=3040',
			'APP_ENV=production',
			`PR_NUMBER=${prNumber}`,
			`BRANCH_NAME=${branchName}`,
			`CORS_ALLOWED_ORIGINS=${corsAllowedOrigins}`,
			'EOF',
			'chown macroai:macroai /opt/macro-ai/.env',
			'chmod 600 /opt/macro-ai/.env',
			'',
			'echo "$(date): CORS configuration set to: ${corsAllowedOrigins}"',
			'echo "$(date): Preview environment setup completed for PR ${prNumber} (${branchName})"',
			'',
			'echo "$(date): Deploying minimal preview API service..."',
			'mkdir -p /opt/macro-ai/app/dist || error_exit "Failed to create app directory"',
			'chown -R macroai:macroai /opt/macro-ai /var/log/macro-ai',
			'',
			'# Create minimal package.json',
			'cat > /opt/macro-ai/app/package.json << EOF',
			'{',
			'  "name": "macro-ai-preview-api",',
			'  "version": "1.0.0",',
			'  "main": "dist/index.js",',
			'  "engines": { "node": ">=20.0.0" },',
			'  "dependencies": {',
			'    "express": "^4.21.2",',
			'    "cors": "^2.8.5"',
			'  }',
			'}',
			'EOF',
			'',
			'# Create minimal Express server using CommonJS for reliability',
			'cat > /opt/macro-ai/app/dist/index.js << EOF',
			'const express = require("express");',
			'const app = express();',
			'const port = process.env.SERVER_PORT || 3040;',
			'',
			'// Health check endpoint',
			'app.get("/api/health", (req, res) => {',
			'  res.json({ ',
			'    status: "healthy", ',
			'    timestamp: new Date().toISOString(),',
			'    port: port,',
			'    env: process.env.NODE_ENV || "development"',
			'  });',
			'});',
			'',
			'// Root endpoint for basic connectivity test',
			'app.get("/", (req, res) => {',
			'  res.json({ message: "Macro AI Preview API", status: "running" });',
			'});',
			'',
			'app.listen(port, "0.0.0.0", () => {',
			'  console.log(`Preview API listening on port ${port}`);',
			'  console.log(`Health check available at http://localhost:${port}/api/health`);',
			'});',
			'EOF',
			'',
			'# Install runtime dependencies',
			'cd /opt/macro-ai/app',
			'npm install --production --no-audit --no-fund || error_exit "Failed to install runtime dependencies"',
			'',
			'# Create systemd service',
			'cat > /etc/systemd/system/macro-ai.service << EOF',
			'[Unit]',
			'Description=Macro AI Preview Express API',
			'After=network.target',
			'Wants=network-online.target',
			'',
			'[Service]',
			'Type=simple',
			'User=macroai',
			'Group=macroai',
			'WorkingDirectory=/opt/macro-ai/app',
			'ExecStart=/usr/bin/node dist/index.js',
			'Restart=always',
			'RestartSec=10',
			'Environment=NODE_ENV=production',
			'Environment=APP_ENV=production',
			'Environment=SERVER_PORT=3040',
			'',
			'[Install]',
			'WantedBy=multi-user.target',
			'EOF',
			'',
			'systemctl daemon-reload || error_exit "Failed to reload systemd"',
			'systemctl enable macro-ai.service || error_exit "Failed to enable macro-ai service"',
			'',
			'echo "$(date): Starting macro-ai service..."',
			'systemctl start macro-ai.service || error_exit "Failed to start macro-ai service"',
			'',
			'echo "$(date): Waiting for service to start..."',
			'sleep 10',
			'',
			'echo "$(date): Checking service status..."',
			'systemctl status macro-ai.service || echo "Service status check failed"',
			'systemctl is-active --quiet macro-ai.service || error_exit "Macro AI preview service is not running"',
			'',
			'echo "$(date): Testing health endpoint..."',
			'curl -f http://localhost:3040/api/health || echo "Health check failed, but continuing..."',
			'',
			'echo "$(date): Preview API service started successfully"',
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
				minCapacity: 1,
				maxCapacity: 2,
				desiredCapacity: 1,

				// Health check configuration
				healthChecks: {
					types: ['ELB'],
					gracePeriod: cdk.Duration.minutes(5),
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

				// Auto scaling group name
				autoScalingGroupName: `macro-ai-preview-asg`,
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
}
