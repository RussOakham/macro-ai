# AWS Deployment Strategy

## Current Implementation Status 🚀 PULUMI + AMPLIFY DEPLOYMENT

This document outlines the current AWS deployment strategy for the Macro AI application, featuring a hybrid Pulumi and
Amplify deployment approach with automated CI/CD pipelines and comprehensive monitoring.

**Deployment Status**: ✅ **ACTIVE** (Pulumi Infrastructure + Amplify Frontend)
**Infrastructure**: Pulumi (TypeScript) with Doppler secrets management
**Frontend**: AWS Amplify for static site deployment
**Backend**: Pulumi-managed ECS Fargate containers

The infrastructure is **deployed and operational** with scalable, secure, and cost-effective cloud deployment.

## 🏗️ Architecture Overview

### High-Level AWS Architecture

```mermaid
graph TB
    subgraph "Internet"
        Users[Users]
    end

    subgraph "AWS Cloud"
        subgraph "CDN & DNS"
            CF[CloudFront CDN]
            R53[Route 53 DNS]
        end

        subgraph "Load Balancing"
            ALB[Application Load Balancer]
        end

        subgraph "Compute - ECS Fargate"
            ECS[ECS Cluster]
            API[Express API Tasks]
            UI[Client UI Tasks]
        end

        subgraph "Database"
            RDS[RDS PostgreSQL + pgvector]
            REDIS[ElastiCache Redis]
        end

        subgraph "Authentication"
            COGNITO[AWS Cognito]
        end

        subgraph "Storage & Secrets"
            S3[S3 Buckets]
            SM[Secrets Manager]
        end

        subgraph "Monitoring"
            CW[CloudWatch]
            XR[X-Ray Tracing]
        end
    end

    Users --> CF
    CF --> ALB
    ALB --> ECS
    ECS --> API
    ECS --> UI
    API --> RDS
    API --> REDIS
    API --> COGNITO
    API --> S3
    API --> SM

    CW --> ECS
    XR --> API
```

### Core AWS Services

#### Compute Services ✅ RECOMMENDED

- **Amazon ECS with Fargate**: Serverless container orchestration
- **Application Load Balancer (ALB)**: Traffic distribution and SSL termination
- **Auto Scaling**: Automatic scaling based on demand

#### Database Services ✅ RECOMMENDED

- **Amazon RDS PostgreSQL**: Managed relational database with pgvector support
- **Amazon ElastiCache Redis**: In-memory caching and session storage
- **RDS Proxy**: Connection pooling and failover

#### Storage and Content Delivery ✅ RECOMMENDED

- **Amazon S3**: Static asset storage and backups
- **Amazon CloudFront**: Global content delivery network
- **AWS Certificate Manager**: SSL/TLS certificate management

#### Security and Identity ✅ IMPLEMENTED

- **AWS Cognito**: User authentication and authorization (already implemented)
- **AWS Secrets Manager**: Secure secret storage
- **AWS IAM**: Identity and access management
- **AWS WAF**: Web application firewall

#### Monitoring and Logging ✅ RECOMMENDED

- **Amazon CloudWatch**: Metrics, logs, and alarms
- **AWS X-Ray**: Distributed tracing
- **AWS CloudTrail**: API audit logging

## 🚀 Deployment Strategies

### 1. Blue-Green Deployment ✅ RECOMMENDED

**Benefits:**

- Zero-downtime deployments
- Instant rollback capability
- Production testing before traffic switch

**Implementation:**

```yaml
# ECS Service with Blue-Green deployment
Resources:
  ECSService:
    Type: AWS::ECS::Service
    Properties:
      DeploymentConfiguration:
        DeploymentCircuitBreaker:
          Enable: true
          Rollback: true
        MaximumPercent: 200
        MinimumHealthyPercent: 100
      EnableExecuteCommand: true
```

### 2. Rolling Deployment ✅ ALTERNATIVE

**Benefits:**

- Gradual traffic migration
- Resource efficient
- Built-in health checks

**Use Cases:**

- Development and staging environments
- Cost-sensitive deployments

### 3. Canary Deployment 📋 ADVANCED

**Benefits:**

- Risk mitigation through gradual rollout
- Real-world testing with limited exposure
- Automated rollback on metrics threshold

**Implementation:**

- AWS CodeDeploy with Lambda traffic shifting
- CloudWatch metrics-based rollback triggers

## 🏗️ Infrastructure as Code (IaC)

### Pulumi (TypeScript) ✅ CURRENT DEPLOYMENT

**Benefits:**

- Type-safe infrastructure definitions
- Familiar programming languages (TypeScript)
- Multi-cloud support and portability
- Excellent IDE support and debugging
- Doppler integration for secrets management

**Project Structure:**

```text
infrastructure/
├── pulumi/
│   ├── index.ts                   # Main Pulumi program
│   ├── Pulumi.yaml               # Pulumi project configuration
│   ├── Pulumi.dev.yaml           # Development stack config
│   ├── Pulumi.stg.yaml           # Staging stack config
│   └── Pulumi.pr.yaml            # Preview stack config
└── package.json
```

**Sample Pulumi Infrastructure:**

```typescript
import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import * as doppler from '@pulumiverse/doppler'

// Get configuration
const config = new pulumi.Config()
const environment = config.require('environment')

// Create Doppler secret reference
const secrets = new doppler.Secret('macro-ai-secrets', {
	project: `macro-ai-${environment}`,
	config: environment === 'pr' ? 'dev' : environment,
})

// Create VPC
const vpc = new aws.ec2.Vpc('macro-ai-vpc', {
	cidrBlock: '10.0.0.0/16',
	enableDnsHostnames: true,
	enableDnsSupport: true,
	tags: {
		Name: 'macro-ai-vpc',
		Environment: environment,
	},
})

// Create ECS cluster
const cluster = new aws.ecs.Cluster('macro-ai-cluster', {
	name: `macro-ai-${environment}`,
	tags: {
		Environment: environment,
	},
})

// Create ECS service
const service = new aws.ecs.Service('macro-ai-service', {
	cluster: cluster.arn,
	desiredCount: 1,
	taskDefinition: createTaskDefinition().arn,
	tags: {
		Environment: environment,
	},
})

function createTaskDefinition(): aws.ecs.TaskDefinition {
	return new aws.ecs.TaskDefinition('macro-ai-task', {
		family: `macro-ai-${environment}`,
		cpu: '256',
		memory: '512',
		networkMode: 'awsvpc',
		requiresCompatibilities: ['FARGATE'],
		executionRoleArn: createExecutionRole().arn,
		taskRoleArn: createTaskRole().arn,
		containerDefinitions: JSON.stringify([
			{
				name: 'api',
				image: 'macro-ai/express-api:latest',
				portMappings: [
					{
						containerPort: 3040,
						protocol: 'tcp',
					},
				],
				environment: [
					{ name: 'NODE_ENV', value: 'production' },
					{ name: 'APP_ENV', value: environment },
				],
				secrets: [
					{
						name: 'API_KEY',
						valueFrom: secrets.secrets['API_KEY'],
					},
					{
						name: 'DATABASE_URL',
						valueFrom: secrets.secrets['DATABASE_URL'],
					},
				],
				logConfiguration: {
					logDriver: 'awslogs',
					options: {
						'awslogs-group': `/aws/ecs/macro-ai-${environment}`,
						'awslogs-region': 'us-east-1',
						'awslogs-stream-prefix': 'ecs',
					},
				},
			},
		]),
	})
}

function createExecutionRole(): aws.iam.Role {
	return new aws.iam.Role('macro-ai-execution-role', {
		assumeRolePolicy: {
			Version: '2012-10-17',
			Statement: [
				{
					Action: 'sts:AssumeRole',
					Effect: 'Allow',
					Principal: {
						Service: 'ecs-tasks.amazonaws.com',
					},
				},
			],
		},
		managedPolicyArns: [
			'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy',
		],
	})
}

function createTaskRole(): aws.iam.Role {
	return new aws.iam.Role('macro-ai-task-role', {
		assumeRolePolicy: {
			Version: '2012-10-17',
			Statement: [
				{
					Action: 'sts:AssumeRole',
					Effect: 'Allow',
					Principal: {
						Service: 'ecs-tasks.amazonaws.com',
					},
				},
			],
		},
	})
}
```

### Terraform Alternative 📋 ALTERNATIVE

**Benefits:**

- Mature ecosystem and community
- Multi-cloud support
- Extensive provider ecosystem

**Use Cases:**

- Multi-cloud deployments
- Existing Terraform expertise
- Complex hybrid architectures

## 🔧 Environment Configuration

### Staging Environment (Hobby Scale)

**Characteristics:**

- Single AZ deployment
- Cost-optimized resource allocation
- Production-like configurations
- Automatic deployment from `develop` branch

**Configuration:**

```typescript
export const stagingConfig = {
	environment: 'staging',
	vpc: {
		maxAzs: 1,
		natGateways: 0, // Use public subnets only
	},
	database: {
		// Using Neon PostgreSQL
		provider: 'neon',
		connectionString: process.env.NEON_DATABASE_URL,
	},
	cache: {
		// Using Upstash Redis
		provider: 'upstash',
		connectionString: process.env.UPSTASH_REDIS_URL,
	},
	lambda: {
		memorySize: 512,
		timeout: cdk.Duration.seconds(30),
	},
	monitoring: {
		detailedMonitoring: false,
		logRetention: logs.RetentionDays.ONE_MONTH,
	},
}
```

### Production Environment (Hobby Scale)

**Characteristics:**

- Production configuration
- Automatic deployment from `main` branch

**Configuration:**

```typescript
export const productionConfig = {
	environment: 'production',
	vpc: {
		maxAzs: 1,
		natGateways: 1,
	},
	database: {
		// Using Neon PostgreSQL
		provider: 'neon',
		connectionString: process.env.NEON_DATABASE_URL,
		backupRetention: cdk.Duration.days(7),
	},
	cache: {
		// Using Upstash Redis
		provider: 'upstash',
		connectionString: process.env.UPSTASH_REDIS_URL,
	},
	lambda: {
		memorySize: 1024,
		timeout: cdk.Duration.seconds(30),
	},
	monitoring: {
		detailedMonitoring: true,
		logRetention: logs.RetentionDays.THREE_MONTHS,
	},
}
```

### Production Environment

**Characteristics:**

- High availability and redundancy
- Auto-scaling capabilities
- Comprehensive monitoring
- Security hardening

**Configuration:**

```typescript
export const productionConfig = {
	environment: 'production',
	vpc: {
		maxAzs: 1,
		natGateways: 1,
	},
	database: {
		// Using Neon PostgreSQL
		provider: 'neon',
		connectionString: process.env.NEON_DATABASE_URL,
	},
	cache: {
		// Using Upstash Redis
		provider: 'upstash',
		connectionString: process.env.UPSTASH_REDIS_URL,
	},
	ecs: {
		desiredCount: 1,
		cpu: 256,
		memoryLimitMiB: 512,
	},
	monitoring: {
		logRetention: logs.RetentionDays.THREE_DAYS,
	},
}
```

## 🔐 Security Configuration

### Network Security

#### VPC Configuration

```typescript
const vpc = new ec2.Vpc(this, 'MacroAiVpc', {
	maxAzs: 3,
	subnetConfiguration: [
		{
			cidrMask: 24,
			name: 'Public',
			subnetType: ec2.SubnetType.PUBLIC,
		},
		{
			cidrMask: 24,
			name: 'Private',
			subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
		},
		{
			cidrMask: 28,
			name: 'Database',
			subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
		},
	],
})
```

#### Security Groups

```typescript
// API Security Group
const apiSecurityGroup = new ec2.SecurityGroup(this, 'ApiSecurityGroup', {
	vpc,
	description: 'Security group for Express API',
	allowAllOutbound: true,
})

apiSecurityGroup.addIngressRule(
	ec2.Peer.securityGroupId(albSecurityGroup.securityGroupId),
	ec2.Port.tcp(3030),
	'Allow ALB to API',
)

// Database Security Group
const dbSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
	vpc,
	description: 'Security group for RDS PostgreSQL',
	allowAllOutbound: false,
})

dbSecurityGroup.addIngressRule(
	ec2.Peer.securityGroupId(apiSecurityGroup.securityGroupId),
	ec2.Port.tcp(5432),
	'Allow API to Database',
)
```

### Secrets Management

#### AWS Secrets Manager Integration

```typescript
// Database credentials
const dbSecret = new secretsManager.Secret(this, 'DatabaseSecret', {
	description: 'RDS PostgreSQL credentials',
	generateSecretString: {
		secretStringTemplate: JSON.stringify({ username: 'postgres' }),
		generateStringKey: 'password',
		excludeCharacters: '"@/\\',
	},
})

// API keys and configuration
const apiSecret = new secretsManager.Secret(this, 'ApiSecret', {
	description: 'API configuration secrets',
	secretObjectValue: {
		API_KEY: cdk.SecretValue.unsafePlainText(generateApiKey()),
		COOKIE_ENCRYPTION_KEY: cdk.SecretValue.unsafePlainText(
			generateEncryptionKey(),
		),
		OPENAI_API_KEY: cdk.SecretValue.unsafePlainText('REPLACE_WITH_ACTUAL_KEY'),
	},
})
```

### IAM Roles and Policies

#### ECS Task Role

```typescript
const taskRole = new iam.Role(this, 'EcsTaskRole', {
	assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
	inlinePolicies: {
		SecretsManagerPolicy: new iam.PolicyDocument({
			statements: [
				new iam.PolicyStatement({
					effect: iam.Effect.ALLOW,
					actions: ['secretsmanager:GetSecretValue'],
					resources: [apiSecret.secretArn, dbSecret.secretArn],
				}),
			],
		}),
		CognitoPolicy: new iam.PolicyDocument({
			statements: [
				new iam.PolicyStatement({
					effect: iam.Effect.ALLOW,
					actions: [
						'cognito-idp:AdminCreateUser',
						'cognito-idp:AdminGetUser',
						'cognito-idp:ListUsers',
						'cognito-idp:SignUp',
						'cognito-idp:ConfirmSignUp',
						'cognito-idp:InitiateAuth',
						'cognito-idp:ForgotPassword',
						'cognito-idp:ConfirmForgotPassword',
						'cognito-idp:GlobalSignOut',
					],
					resources: ['*'],
				}),
			],
		}),
	},
})
```

## 📊 Monitoring and Observability

### CloudWatch Configuration

#### Metrics and Alarms

```typescript
// ECS Service Alarms
const cpuAlarm = new cloudwatch.Alarm(this, 'HighCpuAlarm', {
	metric: apiService.metricCpuUtilization(),
	threshold: 80,
	evaluationPeriods: 2,
	treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
})

const memoryAlarm = new cloudwatch.Alarm(this, 'HighMemoryAlarm', {
	metric: apiService.metricMemoryUtilization(),
	threshold: 85,
	evaluationPeriods: 2,
})

// Database Alarms
const dbConnectionsAlarm = new cloudwatch.Alarm(
	this,
	'DatabaseConnectionsAlarm',
	{
		metric: database.metricDatabaseConnections(),
		threshold: 80,
		evaluationPeriods: 2,
	},
)
```

#### Log Groups and Retention

```typescript
const apiLogGroup = new logs.LogGroup(this, 'ApiLogGroup', {
	logGroupName: '/ecs/macro-ai-api',
	retention: logs.RetentionDays.ONE_MONTH,
	removalPolicy: cdk.RemovalPolicy.DESTROY,
})

const uiLogGroup = new logs.LogGroup(this, 'UiLogGroup', {
	logGroupName: '/ecs/macro-ai-ui',
	retention: logs.RetentionDays.ONE_MONTH,
	removalPolicy: cdk.RemovalPolicy.DESTROY,
})
```

### X-Ray Tracing

```typescript
// Enable X-Ray tracing for ECS tasks
taskDefinition.addContainer('api', {
	// ... other configuration
	environment: {
		// X-Ray configuration - _X_AMZN_TRACE_ID is automatically injected by X-Ray
		AWS_XRAY_TRACING_NAME: 'macro-ai-api',
		AWS_XRAY_DEBUG_MODE: 'TRUE',
	},
	// Enable X-Ray tracing at the container level
	logging: ecs.LogDrivers.awsLogs({
		streamPrefix: 'macro-ai-api',
		logGroup: logGroup,
	}),
})

// Add X-Ray daemon as a sidecar container
taskDefinition.addContainer('xray-daemon', {
	image: ecs.ContainerImage.fromRegistry('amazon/aws-xray-daemon:latest'),
	memoryLimitMiB: 32,
	cpu: 32,
	essential: false,
	portMappings: [
		{
			containerPort: 2000,
			protocol: ecs.Protocol.UDP,
		},
	],
	environment: {
		AWS_REGION: 'us-east-1', // Replace with your region
	},
})
```

#### X-Ray Configuration Notes ⚠️ IMPORTANT

**Automatic Trace ID Injection**:
The `_X_AMZN_TRACE_ID` environment variable should **never** be manually set in container configurations.
X-Ray automatically injects this trace header at runtime when:

- The X-Ray daemon is running as a sidecar container
- The ECS task has the necessary IAM permissions
- The application uses the AWS X-Ray SDK

**Required IAM Permissions**:

```typescript
// Add X-Ray permissions to the task role
taskRole.addToPolicy(
	new iam.PolicyStatement({
		effect: iam.Effect.ALLOW,
		actions: [
			'xray:PutTraceSegments',
			'xray:PutTelemetryRecords',
			'xray:GetSamplingRules',
			'xray:GetSamplingTargets',
		],
		resources: ['*'],
	}),
)
```

**Application Integration**: To enable X-Ray tracing in the Express application, add the AWS X-Ray SDK:

```typescript
// Add to your Express app setup
import AWSXRay from 'aws-xray-sdk-express'

const app = express()

// Enable X-Ray tracing (only in production)
if (process.env.NODE_ENV === 'production') {
	app.use(AWSXRay.express.openSegment('macro-ai-api'))
	// ... other middleware
	app.use(AWSXRay.express.closeSegment())
}
```

## 💰 Cost Optimization

### Resource Right-Sizing

#### ECS Fargate Optimization

```typescript
// Use Fargate Spot for non-critical workloads
const spotTaskDefinition = new ecs.FargateTaskDefinition(this, 'SpotTaskDef', {
	memoryLimitMiB: 512,
	cpu: 256,
	runtimePlatform: {
		operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
		cpuArchitecture: ecs.CpuArchitecture.ARM64, // Graviton2 for cost savings
	},
})
```

#### RDS Cost Optimization

```typescript
// Use Reserved Instances for predictable workloads
const database = new rds.DatabaseInstance(this, 'Database', {
	// ... other configuration
	instanceType: ec2.InstanceType.of(
		ec2.InstanceClass.T4G,
		ec2.InstanceSize.MICRO,
	), // Graviton2
	storageType: rds.StorageType.GP3, // More cost-effective than GP2
	allocatedStorage: 20,
	maxAllocatedStorage: 100, // Enable storage autoscaling
})
```

### Auto Scaling Configuration

```typescript
const scaling = apiService.autoScaleTaskCount({
	minCapacity: 1,
	maxCapacity: 10,
})

scaling.scaleOnCpuUtilization('CpuScaling', {
	targetUtilizationPercent: 70,
	scaleInCooldown: cdk.Duration.minutes(5),
	scaleOutCooldown: cdk.Duration.minutes(2),
})

scaling.scaleOnMemoryUtilization('MemoryScaling', {
	targetUtilizationPercent: 80,
})
```

## 🚀 Deployment Automation

### CI/CD Pipeline Integration

#### GitHub Actions with AWS CDK

```yaml
name: Deploy to AWS
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: |
          npm install -g aws-cdk
          cd infrastructure && npm install

      - name: Deploy infrastructure
        run: |
          cd infrastructure
          cdk deploy --require-approval never

      - name: Build and push Docker images
        run: |
          # Build and push API image
          docker build -t macro-ai/express-api:${{ github.sha }} apps/express-api
          docker push macro-ai/express-api:${{ github.sha }}

          # Build and push UI image
          docker build -t macro-ai/client-ui:${{ github.sha }} apps/client-ui
          docker push macro-ai/client-ui:${{ github.sha }}

      - name: Update ECS services
        run: |
          aws ecs update-service --cluster macro-ai-cluster --service api-service --force-new-deployment
          aws ecs update-service --cluster macro-ai-cluster --service ui-service --force-new-deployment
```

### Rollback Strategy

#### Automated Rollback

```typescript
// CloudWatch alarm-based rollback
const deploymentAlarm = new cloudwatch.Alarm(this, 'DeploymentAlarm', {
	metric: new cloudwatch.Metric({
		namespace: 'AWS/ApplicationELB',
		metricName: 'HTTPCode_Target_5XX_Count',
		dimensionsMap: {
			LoadBalancer: loadBalancer.loadBalancerFullName,
		},
		statistic: 'Sum',
	}),
	threshold: 10,
	evaluationPeriods: 2,
})

// Trigger rollback on alarm
deploymentAlarm.addAlarmAction(
	new cloudwatchActions.SnsAction(
		sns.Topic.fromTopicArn(
			this,
			'AlertTopic',
			'arn:aws:sns:us-east-1:123456789012:alerts',
		),
	),
)
```

## 📚 Related Documentation

- **[Environment Setup](./environment-setup.md)** - Production environment configuration
- **[CI/CD Pipeline](./ci-cd-pipeline.md)** - Continuous integration and deployment
- **[Monitoring and Logging](./monitoring-logging.md)** - Observability and alerting
- **[Database Design](../architecture/database-design.md)** - Database architecture and scaling
- **[Security Architecture](../architecture/security-architecture.md)** - Security best practices
