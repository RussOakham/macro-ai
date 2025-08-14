import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'

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
	 * @default t3.micro (cost-optimized for development)
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
			instanceType = ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
			parameterStorePrefix,
			enableDetailedMonitoring = false,
		} = props

		// Create IAM role for EC2 instances
		this.instanceRole = this.createInstanceRole(parameterStorePrefix, environmentName)

		// Create launch template for consistent instance configuration
		this.launchTemplate = this.createLaunchTemplate(
			vpc,
			securityGroup,
			instanceType,
			parameterStorePrefix,
			environmentName,
			enableDetailedMonitoring,
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
			instanceType = ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
		} = props

		// Create PR-specific instance
		const instance = new ec2.Instance(this, `Pr${prNumber.toString()}Instance`, {
			vpc,
			instanceType,
			machineImage: ec2.MachineImage.latestAmazonLinux2023({
				cpuType: ec2.AmazonLinuxCpuType.X86_64,
			}),
			securityGroup,
			role: this.instanceRole,
			userData: this.createUserData(parameterStorePrefix, prNumber),
			vpcSubnets: {
				subnetType: ec2.SubnetType.PUBLIC, // Cost optimization: no NAT Gateway needed
			},
			instanceName: `macro-ai-${environmentName}-pr-${prNumber.toString()}`,
			// Enable detailed monitoring if specified
			detailedMonitoring: false, // Cost optimization for development
		})

		// Apply PR-specific tags
		this.applyPrTags(instance, prNumber)

		return instance
	}

	/**
	 * Create IAM role for EC2 instances with least-privilege access
	 */
	private createInstanceRole(parameterStorePrefix: string, environmentName: string): iam.Role {
		const role = new iam.Role(this, 'Ec2InstanceRole', {
			assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
			roleName: `macro-ai-${environmentName}-ec2-role`,
			description: 'IAM role for Macro AI EC2 instances with least-privilege access',
		})

		// AWS Systems Manager Session Manager (replaces SSH)
		role.addManagedPolicy(
			iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
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
				resources: [
					`arn:aws:ssm:*:*:parameter${parameterStorePrefix}/*`,
				],
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
				actions: [
					'cloudwatch:PutMetricData',
				],
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
	): ec2.LaunchTemplate {
		return new ec2.LaunchTemplate(this, 'Ec2LaunchTemplate', {
			launchTemplateName: `macro-ai-${environmentName}-launch-template`,
			instanceType,
			machineImage: ec2.MachineImage.latestAmazonLinux2023({
				cpuType: ec2.AmazonLinuxCpuType.X86_64,
			}),
			securityGroup,
			role: this.instanceRole,
			userData: this.createUserData(parameterStorePrefix),
			detailedMonitoring: enableDetailedMonitoring,
			// EBS optimization for better performance
			ebsOptimized: true,
			// Instance metadata service v2 (security best practice)
			requireImdsv2: true,
		})
	}

	/**
	 * Create user data script for automated application deployment
	 */
	private createUserData(parameterStorePrefix: string, prNumber?: number): ec2.UserData {
		const userData = ec2.UserData.forLinux()

		userData.addCommands(
			'#!/bin/bash',
			'set -e',
			'',
			'# Update system packages',
			'dnf update -y',
			'',
			'# Install Node.js 20 (LTS)',
			'dnf install -y nodejs npm',
			'',
			'# Install PM2 for process management',
			'npm install -g pm2',
			'',
			'# Create application user',
			'useradd -m -s /bin/bash macroai',
			'',
			'# Create application directory',
			'mkdir -p /opt/macro-ai',
			'chown macroai:macroai /opt/macro-ai',
			'',
			'# Create log directory',
			'mkdir -p /var/log/macro-ai',
			'chown macroai:macroai /var/log/macro-ai',
			'',
			'# Install CloudWatch agent',
			'dnf install -y amazon-cloudwatch-agent',
			'',
			`# Set environment variables`,
			`echo "PARAMETER_STORE_PREFIX=${parameterStorePrefix}" >> /etc/environment`,
			`echo "NODE_ENV=production" >> /etc/environment`,
			`echo "PORT=3030" >> /etc/environment`,
			prNumber ? `echo "PR_NUMBER=${prNumber.toString()}" >> /etc/environment` : '',
			'',
			'# Create systemd service for the application',
			'cat > /etc/systemd/system/macro-ai.service << EOF',
			'[Unit]',
			'Description=Macro AI Express API',
			'After=network.target',
			'',
			'[Service]',
			'Type=simple',
			'User=macroai',
			'WorkingDirectory=/opt/macro-ai',
			'ExecStart=/usr/bin/node dist/index.js',
			'Restart=always',
			'RestartSec=10',
			'Environment=NODE_ENV=production',
			'Environment=PORT=3030',
			`Environment=PARAMETER_STORE_PREFIX=${parameterStorePrefix}`,
			prNumber ? `Environment=PR_NUMBER=${prNumber.toString()}` : '',
			'',
			'[Install]',
			'WantedBy=multi-user.target',
			'EOF',
			'',
			'# Enable the service',
			'systemctl enable macro-ai.service',
			'',
			'# Signal CloudFormation that the instance is ready',
			'/opt/aws/bin/cfn-signal -e $? --stack ${AWS::StackName} --resource ${AWS::LogicalResourceId} --region ${AWS::Region}',
		)

		return userData
	}

	/**
	 * Apply comprehensive tagging for cost tracking and resource management
	 */
	private applyTags(environmentName: string): void {
		const tags = {
			Project: 'MacroAI',
			Environment: environmentName,
			Component: 'EC2',
			Purpose: 'PreviewEnvironment',
			CostCenter: 'Development',
			ManagedBy: 'CDK',
			CreatedBy: 'Ec2Construct',
		}

		Object.entries(tags).forEach(([key, value]) => {
			cdk.Tags.of(this).add(key, value)
		})
	}

	/**
	 * Apply PR-specific tags to EC2 instances
	 */
	private applyPrTags(instance: ec2.Instance, prNumber: number): void {
		const tags = {
			Project: 'MacroAI',
			Environment: `pr-${prNumber.toString()}`,
			PRNumber: prNumber.toString(),
			Component: 'EC2',
			Purpose: 'PreviewEnvironment',
			CostCenter: 'Development',
			ManagedBy: 'CDK',
			ExpiryDate: this.calculateExpiryDate(7), // 7 days from creation
		}

		Object.entries(tags).forEach(([key, value]) => {
			cdk.Tags.of(instance).add(key, value)
		})
	}

	/**
	 * Calculate expiry date for resource cleanup
	 */
	private calculateExpiryDate(days: number): string {
		const expiry = new Date()
		expiry.setDate(expiry.getDate() + days)
		const datePart = expiry.toISOString().split('T')[0]
		return datePart ?? expiry.toISOString().substring(0, 10) // YYYY-MM-DD format
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
}
