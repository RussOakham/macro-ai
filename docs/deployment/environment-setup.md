# Environment Setup for Deployment

## Current Implementation Status 📋 PLANNED

This document provides comprehensive guidance for setting up production environments for the Macro AI application,
including secrets management, deployment prerequisites, and environment-specific configurations. The deployment
environment setup is **planned and designed** for secure, scalable production deployments.

## 🌍 Environment Strategy

### Environment Hierarchy

```mermaid
graph TB
    subgraph "Development"
        LOCAL[Local Development]
        DEV[Development Branch]
    end

    subgraph "Testing"
        STAGING[Staging Environment]
        UAT[User Acceptance Testing]
    end

    subgraph "Production"
        PROD[Production Environment]
        DR[Disaster Recovery]
    end

    LOCAL --> DEV
    DEV --> STAGING
    STAGING --> UAT
    UAT --> PROD
    PROD --> DR
```

### Environment Characteristics

#### Development Environment ✅ IMPLEMENTED

**Purpose**: Local development and feature testing

**Characteristics**:

- Single developer instance
- Minimal resource allocation
- Development-friendly configurations
- Local database and services

**Configuration**:

```bash
NODE_ENV=development
APP_ENV=development
API_KEY=dev-32-character-key-for-local-development
SERVER_PORT=3040
COOKIE_DOMAIN=localhost
RELATIONAL_DATABASE_URL=postgresql://postgres:password@localhost:5432/macro_ai_dev
```

## 🏗️ Infrastructure Scaling Strategy

Environments (staging/production) can operate at different infrastructure scales:

- **Hobby Scale**: Cost-optimized for <£10/month (Neon, Upstash, Lambda)
- **Enterprise Scale**: Production-ready for £100-300/month (RDS, ElastiCache, ECS)

### Environment + Scale Matrix

| Environment | Default Scale | Upgrade Path | Cost Target       |
| ----------- | ------------- | ------------ | ----------------- |
| staging     | hobby         | N/A          | <£5/month         |
| production  | hobby         | enterprise   | <£10 → £300/month |

#### Staging Environment (Hobby Scale) 📋 PLANNED

**Purpose**: Pre-production testing and validation

**Characteristics**:

- Production-like configuration at hobby scale
- Cost-optimized infrastructure (Neon, Upstash)
- Full feature testing capability
- Automatic deployment from `develop` branch
- Isolated from production data

**Configuration**:

```bash
NODE_ENV=production    # Uses production for library optimizations
APP_ENV=staging        # Application knows it's staging environment
CDK_DEPLOY_SCALE=hobby # Cost-optimized infrastructure scale
API_KEY=staging-unique-32-character-key-here
SERVER_PORT=3040
COOKIE_DOMAIN=staging.macro-ai.com
RELATIONAL_DATABASE_URL=postgresql://staging_user:secure_pass@neon-staging:5432/macro_ai_staging
```

**Environment Variable Strategy**:

- `NODE_ENV=production` ensures staging gets the same library optimizations as production (Express, logging, security)
- `APP_ENV=staging` allows application-specific staging behavior (URLs, feature flags, etc.)

#### Production Environment (Hobby → Enterprise Scale) 📋 PLANNED

**Purpose**: Live application serving end users

**Hobby Scale Characteristics**:

- Cost-optimized for personal projects
- Suitable for <100 users
- Automatic deployment from `main` branch
- Easy upgrade path to enterprise

**Enterprise Scale Characteristics**:

- High availability and redundancy
- Auto-scaling capabilities
- Comprehensive monitoring
- Security hardening

**Configuration (Hobby Scale)**:

```bash
NODE_ENV=production
APP_ENV=production
CDK_DEPLOY_SCALE=hobby # Cost-optimized infrastructure
API_KEY=production-unique-32-character-key-here
SERVER_PORT=3040
COOKIE_DOMAIN=macro-ai.com
RELATIONAL_DATABASE_URL=postgresql://prod_user:secure_pass@neon-prod:5432/macro_ai_prod?sslmode=require
```

**Configuration (Enterprise Scale)**:

```bash
NODE_ENV=production
APP_ENV=production
CDK_DEPLOY_SCALE=enterprise # Full AWS managed services
API_KEY=production-unique-32-character-key-here
SERVER_PORT=3040
COOKIE_DOMAIN=macro-ai.com
RELATIONAL_DATABASE_URL=postgresql://prod_user:very_secure_pass@rds-prod:5432/macro_ai_prod?sslmode=require
```

## 🔧 Environment Variable Strategy

### Two-Variable Pattern: NODE_ENV + APP_ENV

Macro AI uses a **two-variable environment pattern** that aligns with enterprise best practices:

#### Why Two Variables?

**NODE_ENV (Library Behavior)**:

- Controls third-party library optimizations (Express, React, webpack, etc.)
- Standard Node.js convention: `development`, `production`, `test`
- Libraries trigger production optimizations only on `NODE_ENV=production`

**APP_ENV (Application Behavior)**:

- Controls application-specific logic (URLs, feature flags, configurations)
- Custom values: `development`, `staging`, `production`, `test`
- Allows staging to get production optimizations while maintaining staging behavior

#### Benefits

1. **Library Optimizations**: Staging environments get the same performance optimizations as production
2. **Security Hardening**: Production-level security settings apply to staging
3. **Convention Compliance**: Maintains standard Node.js ecosystem conventions
4. **Third-party Compatibility**: Avoids unexpected behavior from libraries expecting standard NODE_ENV values

#### Usage Guidelines

**For Library-Dependent Logic** (use `NODE_ENV`):

```typescript
// Security, logging, performance optimizations
if (config.nodeEnv === 'production') {
	// Production-level behavior for both staging and production
}
```

**For Application-Specific Logic** (use `APP_ENV`):

```typescript
// URLs, feature flags, environment-specific configurations
switch (config.appEnv) {
	case 'staging':
		return 'https://api-staging.macro-ai.com'
	case 'production':
		return 'https://api.macro-ai.com'
	default:
		return 'http://localhost:3040'
}
```

## 🔐 Secrets Management

### AWS Secrets Manager Integration 📋 PLANNED

#### Secret Organization Strategy

```text
/macro-ai/
├── dev/
│   ├── api-keys
│   ├── database-credentials
│   └── external-services
├── staging/
│   ├── api-keys
│   ├── database-credentials
│   └── external-services
└── production/
    ├── api-keys
    ├── database-credentials
    └── external-services
```

#### Secret Categories

**1. API Configuration Secrets**

```json
{
	"name": "/macro-ai/production/api-keys",
	"description": "API configuration secrets for production",
	"secretString": {
		"API_KEY": "production-32-character-api-key-here",
		"COOKIE_ENCRYPTION_KEY": "production-32-character-encryption-key-here"
	}
}
```

**2. Database Credentials**

```json
{
	"name": "/macro-ai/production/database-credentials",
	"description": "Database connection credentials",
	"secretString": {
		"RELATIONAL_DATABASE_URL": "postgresql://prod_user:secure_password@prod-db.cluster-xyz.us-east-1.rds.amazonaws.com:5432/macro_ai_prod?sslmode=require",
		"DB_USERNAME": "prod_user",
		"DB_PASSWORD": "very_secure_database_password"
	}
}
```

**3. External Service Credentials**

```json
{
	"name": "/macro-ai/production/external-services",
	"description": "External service API keys and credentials",
	"secretString": {
		"OPENAI_API_KEY": "sk-production-openai-api-key-here",
		"AWS_COGNITO_USER_POOL_ID": "us-east-1_XXXXXXXXX",
		"AWS_COGNITO_USER_POOL_CLIENT_ID": "production-client-id",
		"AWS_COGNITO_USER_POOL_SECRET_KEY": "production-client-secret"
	}
}
```

#### Secret Access Patterns

**ECS Task Role Policy**:

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": ["secretsmanager:GetSecretValue"],
			"Resource": [
				"arn:aws:secretsmanager:us-east-1:123456789012:secret:/macro-ai/production/*"
			]
		}
	]
}
```

**Application Secret Loading**:

```typescript
import {
	SecretsManagerClient,
	GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager'

class SecretManager {
	private client: SecretsManagerClient

	constructor() {
		this.client = new SecretsManagerClient({ region: 'us-east-1' })
	}

	async getSecret(secretName: string): Promise<Record<string, string>> {
		try {
			const command = new GetSecretValueCommand({ SecretId: secretName })
			const response = await this.client.send(command)

			// Check if SecretString exists and is not null/undefined
			if (!response.SecretString) {
				console.warn(`Secret ${secretName} has no SecretString value`)
				return {}
			}

			// Safely parse JSON with error handling
			try {
				const parsed = JSON.parse(response.SecretString)

				// Ensure the parsed result is an object
				if (
					typeof parsed !== 'object' ||
					parsed === null ||
					Array.isArray(parsed)
				) {
					console.warn(
						`Secret ${secretName} does not contain a valid JSON object`,
					)
					return {}
				}

				return parsed
			} catch (parseError) {
				console.error(
					`Failed to parse JSON for secret ${secretName}:`,
					parseError,
				)
				return {}
			}
		} catch (error) {
			console.error(`Failed to retrieve secret ${secretName}:`, error)
			return {}
		}
	}

	private mergeSecretsWithEnvCheck(
		secrets: Record<string, string>,
		secretType: string,
	): void {
		const overrides: string[] = []

		for (const [key, value] of Object.entries(secrets)) {
			// Check if environment variable already exists
			if (process.env[key] !== undefined) {
				overrides.push(key)
				console.warn(
					`Environment variable ${key} already exists and will be overridden by ${secretType} secret`,
				)
			}

			// Set the environment variable
			process.env[key] = value
		}

		if (overrides.length > 0) {
			console.info(
				`Overridden ${overrides.length} existing environment variables from ${secretType}:`,
				overrides,
			)
		}
	}

	async loadEnvironmentSecrets(): Promise<void> {
		const environment = process.env.NODE_ENV || 'development'

		if (environment === 'production' || environment === 'staging') {
			try {
				const apiSecrets = await this.getSecret(
					`/macro-ai/${environment}/api-keys`,
				)
				const dbSecrets = await this.getSecret(
					`/macro-ai/${environment}/database-credentials`,
				)
				const serviceSecrets = await this.getSecret(
					`/macro-ai/${environment}/external-services`,
				)

				// Merge secrets into process.env with conflict detection
				this.mergeSecretsWithEnvCheck(apiSecrets, 'API keys')
				this.mergeSecretsWithEnvCheck(dbSecrets, 'database credentials')
				this.mergeSecretsWithEnvCheck(serviceSecrets, 'external services')

				console.info(
					`Successfully loaded secrets for ${environment} environment`,
				)
			} catch (error) {
				console.error('Failed to load environment secrets:', error)
				// Don't throw - allow application to continue with existing env vars
			}
		}
	}
}
```

### Secret Rotation Strategy 📋 PLANNED

#### Automated Rotation

```yaml
# AWS Lambda function for secret rotation
Resources:
  SecretRotationFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: macro-ai-secret-rotation
      Runtime: nodejs20.x
      Handler: index.handler
      Code:
        ZipFile: |
          exports.handler = async (event) => {
            // Implement secret rotation logic
            // Update database passwords
            // Rotate API keys
            // Update application configurations
          }
      Environment:
        Variables:
          ENVIRONMENT: !Ref Environment
```

#### Rotation Schedule

- **Database Passwords**: Every 90 days
- **API Keys**: Every 180 days
- **Encryption Keys**: Every 365 days
- **External Service Keys**: As required by service providers

## 🏗️ Infrastructure Prerequisites

### AWS Account Setup 📋 PLANNED

#### Required AWS Services

**1. Compute Services**

- Amazon ECS with Fargate
- Application Load Balancer (ALB)
- Auto Scaling Groups

**2. Database Services**

- Amazon RDS PostgreSQL with pgvector
- Amazon ElastiCache Redis
- RDS Proxy for connection pooling

**3. Storage Services**

- Amazon S3 for static assets
- Amazon EFS for shared storage (if needed)

**4. Security Services**

- AWS Secrets Manager
- AWS Certificate Manager
- AWS WAF

**5. Monitoring Services**

- Amazon CloudWatch
- AWS X-Ray
- AWS CloudTrail

#### IAM Roles and Policies

**ECS Task Execution Role**:

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": [
				"ecr:GetAuthorizationToken",
				"ecr:BatchCheckLayerAvailability",
				"ecr:GetDownloadUrlForLayer",
				"ecr:BatchGetImage",
				"logs:CreateLogStream",
				"logs:PutLogEvents",
				"secretsmanager:GetSecretValue"
			],
			"Resource": "*"
		}
	]
}
```

**ECS Task Role**:

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": ["secretsmanager:GetSecretValue"],
			"Resource": ["arn:aws:secretsmanager:*:*:secret:/macro-ai/*"]
		},
		{
			"Effect": "Allow",
			"Action": ["cognito-idp:*"],
			"Resource": "*"
		}
	]
}
```

### Network Configuration 📋 PLANNED

#### VPC Architecture

```typescript
// VPC with public and private subnets
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

**Application Load Balancer Security Group**:

- Inbound: HTTP (80), HTTPS (443) from 0.0.0.0/0
- Outbound: All traffic to ECS security group

**ECS Security Group**:

- Inbound: HTTP (3040) from ALB security group
- Outbound: HTTPS (443) to 0.0.0.0/0, PostgreSQL (5432) to database security group

**Database Security Group**:

- Inbound: PostgreSQL (5432) from ECS security group
- Outbound: None

## 🚀 Deployment Prerequisites

### Container Registry Setup 📋 PLANNED

#### Amazon ECR Configuration

```bash
# Create ECR repositories
aws ecr create-repository --repository-name macro-ai/express-api
aws ecr create-repository --repository-name macro-ai/client-ui

# Configure repository policies
aws ecr put-repository-policy \
  --repository-name macro-ai/express-api \
  --policy-text file://ecr-policy.json
```

**ECR Repository Policy**:

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Sid": "AllowECSAccess",
			"Effect": "Allow",
			"Principal": {
				"Service": "ecs-tasks.amazonaws.com"
			},
			"Action": [
				"ecr:GetDownloadUrlForLayer",
				"ecr:BatchGetImage",
				"ecr:BatchCheckLayerAvailability"
			]
		}
	]
}
```

### Database Setup 📋 PLANNED

#### RDS PostgreSQL Configuration

```typescript
const database = new rds.DatabaseInstance(this, 'MacroAiDatabase', {
	engine: rds.DatabaseInstanceEngine.postgres({
		version: rds.PostgresEngineVersion.VER_15,
	}),
	instanceType: ec2.InstanceType.of(
		ec2.InstanceClass.R6G,
		ec2.InstanceSize.LARGE,
	),
	vpc,
	credentials: rds.Credentials.fromSecret(dbSecret),
	multiAz: true,
	deletionProtection: true,
	backupRetention: cdk.Duration.days(30),
	performanceInsights: true,
	monitoringInterval: cdk.Duration.minutes(1),
	enablePerformanceInsights: true,
	parameterGroup: new rds.ParameterGroup(this, 'DatabaseParameterGroup', {
		engine: rds.DatabaseInstanceEngine.postgres({
			version: rds.PostgresEngineVersion.VER_15,
		}),
		parameters: {
			shared_preload_libraries: 'vector',
			max_connections: '200',
			work_mem: '4MB',
		},
	}),
})
```

#### Database Migration Strategy

```bash
# Production database migration process
1. Create database snapshot
2. Apply migrations in transaction
3. Verify data integrity
4. Update application configuration
5. Restart application services
6. Validate application functionality
```

### SSL/TLS Certificate Setup 📋 PLANNED

#### AWS Certificate Manager

```typescript
const certificate = new acm.Certificate(this, 'MacroAiCertificate', {
	domainName: 'macro-ai.com',
	subjectAlternativeNames: ['*.macro-ai.com'],
	validation: acm.CertificateValidation.fromDns(hostedZone),
})
```

#### Domain Configuration

```typescript
const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
	domainName: 'macro-ai.com',
})

new route53.ARecord(this, 'ApiRecord', {
	zone: hostedZone,
	recordName: 'api',
	target: route53.RecordTarget.fromAlias(
		new targets.LoadBalancerTarget(loadBalancer),
	),
})

new route53.ARecord(this, 'AppRecord', {
	zone: hostedZone,
	recordName: 'app',
	target: route53.RecordTarget.fromAlias(
		new targets.CloudFrontTarget(distribution),
	),
})
```

## 📊 Environment Monitoring

### CloudWatch Configuration 📋 PLANNED

#### Log Groups

```typescript
const apiLogGroup = new logs.LogGroup(this, 'ApiLogGroup', {
	logGroupName: '/ecs/macro-ai-api',
	retention: logs.RetentionDays.SIX_MONTHS,
	removalPolicy: cdk.RemovalPolicy.RETAIN,
})

const uiLogGroup = new logs.LogGroup(this, 'UiLogGroup', {
	logGroupName: '/ecs/macro-ai-ui',
	retention: logs.RetentionDays.SIX_MONTHS,
	removalPolicy: cdk.RemovalPolicy.RETAIN,
})
```

#### Alarms and Metrics

```typescript
// High CPU utilization alarm
const cpuAlarm = new cloudwatch.Alarm(this, 'HighCpuAlarm', {
	metric: apiService.metricCpuUtilization(),
	threshold: 80,
	evaluationPeriods: 2,
	treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
})

// Database connection alarm
const dbConnectionsAlarm = new cloudwatch.Alarm(
	this,
	'DatabaseConnectionsAlarm',
	{
		metric: database.metricDatabaseConnections(),
		threshold: 80,
		evaluationPeriods: 2,
	},
)

// Application error rate alarm
const errorRateAlarm = new cloudwatch.Alarm(this, 'ErrorRateAlarm', {
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
```

### Health Checks 📋 PLANNED

#### Application Health Endpoints

```typescript
// Express API health check
app.get('/api/health', async (req, res) => {
	const health = {
		status: 'healthy',
		timestamp: new Date().toISOString(),
		version: process.env.APP_VERSION,
		environment: process.env.NODE_ENV,
		checks: {
			database: await checkDatabaseConnection(),
			redis: await checkRedisConnection(),
			cognito: await checkCognitoConnection(),
			openai: await checkOpenAIConnection(),
		},
	}

	const isHealthy = Object.values(health.checks).every(
		(check) => check.status === 'healthy',
	)
	res.status(isHealthy ? 200 : 503).json(health)
})
```

#### Load Balancer Health Check Configuration

```typescript
const targetGroup = new elbv2.ApplicationTargetGroup(this, 'ApiTargetGroup', {
	port: 3040,
	vpc,
	protocol: elbv2.ApplicationProtocol.HTTP,
	healthCheck: {
		enabled: true,
		path: '/api/health',
		protocol: elbv2.Protocol.HTTP,
		healthyHttpCodes: '200',
		interval: cdk.Duration.seconds(30),
		timeout: cdk.Duration.seconds(5),
		healthyThresholdCount: 2,
		unhealthyThresholdCount: 3,
	},
})
```

## 🔧 Environment Configuration Management

### Configuration Validation 📋 PLANNED

#### Environment-Specific Validation

```typescript
import { z } from 'zod'

const productionConfigSchema = z.object({
	NODE_ENV: z.literal('production'),
	APP_ENV: z.literal('production'),
	API_KEY: z.string().min(32),
	SERVER_PORT: z.coerce.number().default(3040),
	COOKIE_DOMAIN: z.string().min(1),
	COOKIE_ENCRYPTION_KEY: z.string().min(32),
	RELATIONAL_DATABASE_URL: z.string().url(),
	OPENAI_API_KEY: z.string().startsWith('sk-'),
	AWS_COGNITO_REGION: z.string().min(1),
	AWS_COGNITO_USER_POOL_ID: z.string().min(1),
	AWS_COGNITO_USER_POOL_CLIENT_ID: z.string().min(1),
	AWS_COGNITO_USER_POOL_SECRET_KEY: z.string().min(1),
	// AWS Cognito credentials removed - using IAM roles instead
})

const stagingConfigSchema = productionConfigSchema.extend({
	APP_ENV: z.literal('staging'), // NODE_ENV stays 'production' for library optimizations
})

export function validateEnvironmentConfig() {
	const appEnv = process.env.APP_ENV

	try {
		if (appEnv === 'production') {
			productionConfigSchema.parse(process.env)
		} else if (appEnv === 'staging') {
			stagingConfigSchema.parse(process.env)
		}

		console.log(`✅ Environment configuration validated for ${appEnv}`)
	} catch (error) {
		console.error(`❌ Environment configuration validation failed:`, error)
		process.exit(1)
	}
}
```

### Feature Flags 📋 PLANNED

#### Environment-Based Feature Flags

```typescript
interface FeatureFlags {
	enableAdvancedAnalytics: boolean
	enableBetaFeatures: boolean
	enableDebugLogging: boolean
	enablePerformanceMonitoring: boolean
}

export const getFeatureFlags = (): FeatureFlags => {
	const appEnv = process.env.APP_ENV

	switch (appEnv) {
		case 'production':
			return {
				enableAdvancedAnalytics: true,
				enableBetaFeatures: false,
				enableDebugLogging: false,
				enablePerformanceMonitoring: true,
			}
		case 'staging':
			return {
				enableAdvancedAnalytics: true,
				enableBetaFeatures: true,
				enableDebugLogging: true,
				enablePerformanceMonitoring: true,
			}
		default:
			return {
				enableAdvancedAnalytics: false,
				enableBetaFeatures: true,
				enableDebugLogging: true,
				enablePerformanceMonitoring: false,
			}
	}
}
```

## 📚 Related Documentation

- **[AWS Deployment](./aws-deployment.md)** - Infrastructure architecture and deployment strategies
- **[CI/CD Pipeline](./ci-cd-pipeline.md)** - Automated deployment and quality gates
- **[Monitoring and Logging](./monitoring-logging.md)** - Observability and alerting setup
- **[Environment Configuration](../getting-started/environment-configuration.md)** - Development environment setup
- **[Security Architecture](../architecture/security-architecture.md)** - Security best practices and implementation
