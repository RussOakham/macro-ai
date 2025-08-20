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
	 * Environment name for resource n'# S3 deployment artifact configuration',
'AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)',
'ENVIRONMENT_NAME=$(curl -s http://169.254.169.254/latest/meta-data/tags/instance/Environment || echo "development")',
'DEPLOYMENT_BUCKET="macro-ai-deployment-artifacts-${AWS_ACCOUNT_ID}"',
'DEPLOYMENT_KEY="express-api/${ENVIRONMENT_NAME}/express-api-deployment.tar.gz"',
'ARTIFACT_PATH="/tmp/express-api-deployment.tar.gz"',
'',
'echo "$(date): Using deployment configuration:"',
'echo "  AWS Account: ${AWS_ACCOUNT_ID}"',
'echo "  Environment: ${ENVIRONMENT_NAME}"',
'echo "  S3 Bucket: ${DEPLOYMENT_BUCKET}"',
'echo "  S3 Key: ${DEPLOYMENT_KEY}"',g and tagging
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
	 * Create simplified user data script for automated application deployment
	 */
	private createUserData(
		parameterStorePrefix: string,
		prNumber?: number,
		deploymentId?: string,
	): ec2.UserData {
		const userData = ec2.UserData.forLinux()

		// Add deployment timestamp to force instance replacement
		const timestamp = deploymentId ?? new Date().toISOString()

		// Create simplified deployment script
		userData.addCommands(
			'#!/bin/bash',
			'set -e',
			'',
			`# Deployment ID: ${timestamp}`,
			'# This timestamp forces new instances on every deployment to ensure fresh application code',
			'',
			'# Basic logging setup',
			'exec > >(tee /var/log/user-data.log) 2>&1',
			`echo "$(date): Starting Macro AI application deployment (Deployment ID: ${timestamp})"`,
			'',
			'# Update system and install Node.js 20 LTS',
			'echo "$(date): Updating system packages..."',
			'dnf update -y',
			'',
			'echo "$(date): Installing Node.js 20 LTS..."',
			'curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -',
			'dnf install -y nodejs',
			'',
			'# Verify Node.js installation',
			'node_version=$(node --version)',
			'echo "$(date): Node.js version: $node_version"',
			'',
			'# Create application user and directories',
			'echo "$(date): Setting up application user and directories..."',
			'useradd -m -s /bin/bash macroai',
			'mkdir -p /opt/macro-ai',
			'mkdir -p /var/log/macro-ai',
			'chown -R macroai:macroai /opt/macro-ai',
			'chown -R macroai:macroai /var/log/macro-ai',
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
			'# Download and extract S3 artifact',
			'echo "$(date): Downloading deployment artifact..."',
			'AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)',
			'DEPLOYMENT_BUCKET="macro-ai-deployment-artifacts-${AWS_ACCOUNT_ID}"',
			prNumber
				? `DEPLOYMENT_KEY="express-api/pr-${prNumber.toString()}/express-api-deployment.tar.gz"`
				: 'DEPLOYMENT_KEY="express-api/development/express-api-deployment.tar.gz"',
			'ARTIFACT_PATH="/tmp/express-api-deployment.tar.gz"',
			'',
			'# Download the deployment package from S3',
			'if aws s3 cp "s3://${DEPLOYMENT_BUCKET}/${DEPLOYMENT_KEY}" "$ARTIFACT_PATH"; then',
			'    echo "$(date): ✅ Deployment artifact downloaded successfully"',
			'    ',
			'    # Extract to application directory',
			'    cd /opt/macro-ai',
			'    tar -xzf "$ARTIFACT_PATH"',
			'    ',
			'    # Verify extracted contents',
			'    if [[ -d "dist" && -f "dist/index.js" && -f "package.json" ]]; then',
			'        echo "$(date): ✅ Deployment package extracted successfully"',
			'        ',
			'        # Install production dependencies',
			'        echo "$(date): Installing production dependencies..."',
			'        npm install --production --frozen-lockfile || npm install --production --no-audit --no-fund',
			'        ',
			'        echo "$(date): ✅ Express API application deployed!"',
			'    else',
			'        echo "$(date): ❌ Invalid deployment package structure"',
			'        echo "$(date): Expected: dist/index.js and package.json"',
			'        exit 1',
			'    fi',
			'else',
			'    echo "$(date): ❌ Failed to download deployment artifact"',
			'    echo "$(date): Expected S3 location: s3://${DEPLOYMENT_BUCKET}/${DEPLOYMENT_KEY}"',
			'    exit 1',
			'fi',
			'',
			'# Create systemd service',
			'echo "$(date): Creating systemd service..."',
			'cat > /etc/systemd/system/macro-ai.service << EOF',
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
			'',
			'# Environment variables',
			'Environment=NODE_ENV=production',
			'Environment=SERVER_PORT=3040',
			'Environment=APP_ENV=production',
			`Environment=PARAMETER_STORE_PREFIX=${parameterStorePrefix}`,
			prNumber ? `Environment=PR_NUMBER=${prNumber.toString()}` : '',
			`Environment=AWS_REGION=${cdk.Stack.of(this).region}`,
			'',
			'# Logging',
			'StandardOutput=journal',
			'StandardError=journal',
			'',
			'[Install]',
			'WantedBy=multi-user.target',
			'EOF',
			'',
			'# Set ownership and permissions',
			'chown -R macroai:macroai /opt/macro-ai',
			'',
			'# Enable and start the service',
			'systemctl daemon-reload',
			'systemctl enable macro-ai.service',
			'systemctl start macro-ai.service',
			'',
			'# Wait for service to start and verify',
			'sleep 10',
			'if systemctl is-active --quiet macro-ai.service; then',
			'    echo "$(date): ✅ Macro AI service started successfully"',
			'else',
			'    echo "$(date): ❌ Macro AI service failed to start"',
			'    systemctl status macro-ai.service',
			'    exit 1',
			'fi',
			'',
			'echo "$(date): ✅ Deployment completed successfully!"',
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
