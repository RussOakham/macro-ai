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

#### Staging Environment 📋 PLANNED

**Purpose**: Pre-production testing and validation

**Characteristics**:

- Production-like configuration
- Cost-optimized infrastructure (Neon, Upstash)
- Full feature testing capability
- Automatic deployment from `develop` branch
- Isolated from production data

**Configuration**:

```bash
NODE_ENV=production    # Uses production for library optimizations
APP_ENV=staging        # Application knows it's staging environment
API_KEY=staging-unique-32-character-key-here
SERVER_PORT=3040
COOKIE_DOMAIN=staging.macro-ai.com
RELATIONAL_DATABASE_URL=postgresql://staging_user:secure_pass@neon-staging:5432/macro_ai_staging
```

**Environment Variable Strategy**:

- `NODE_ENV=production` ensures staging gets the same library optimizations as production (Express, logging, security)
- `APP_ENV=staging` allows application-specific staging behavior (URLs, feature flags, etc.)

#### Production Environment 📋 PLANNED

**Purpose**: Live application serving end users

**Characteristics**:

- Production-ready infrastructure
- High availability and redundancy
- Auto-scaling capabilities
- Comprehensive monitoring
- Security hardening
- Automatic deployment from `main` branch

**Configuration**:

```bash
NODE_ENV=production
APP_ENV=production
API_KEY=production-unique-32-character-key-here
SERVER_PORT=3040
COOKIE_DOMAIN=macro-ai.com
RELATIONAL_DATABASE_URL=postgresql://prod_user:secure_pass@neon-prod:5432/macro_ai_prod?sslmode=require
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

### Doppler Secrets Management ✅ IMPLEMENTED

#### Doppler Project Organization

```text
macro-ai-dev/          # Development project
├── dev/              # Development config (shared with preview environments)
├── staging/          # Staging config
└── prod/             # Production config

macro-ai-staging/      # Staging project
└── staging/          # Staging-specific config

macro-ai-prod/         # Production project
└── prod/             # Production-specific config
```

#### Secret Categories

**1. API Configuration Secrets**

```bash
# Doppler CLI commands for managing secrets
doppler secrets set API_KEY "production-32-character-api-key-here" --project macro-ai-prod --config prod
doppler secrets set COOKIE_ENCRYPTION_KEY "production-32-character-encryption-key-here" --project macro-ai-prod --config prod
```

**2. Database Credentials**

```bash
# Set database connection strings
doppler secrets set RELATIONAL_DATABASE_URL "postgresql://prod_user:secure_password@prod-db.cluster-xyz.us-east-1.rds.amazonaws.com:5432/macro_ai_prod?sslmode=require" --project macro-ai-prod --config prod
doppler secrets set REDIS_URL "redis://prod-redis-cluster:6379" --project macro-ai-prod --config prod
```

**3. External Service Credentials**

```bash
# Set external service credentials
doppler secrets set OPENAI_API_KEY "sk-production-openai-api-key-here" --project macro-ai-prod --config prod
doppler secrets set AWS_COGNITO_USER_POOL_ID "us-east-1_XXXXXXXXX" --project macro-ai-prod --config prod
doppler secrets set AWS_COGNITO_USER_POOL_CLIENT_ID "production-client-id" --project macro-ai-prod --config prod
doppler secrets set AWS_COGNITO_USER_POOL_SECRET_KEY "production-client-secret" --project macro-ai-prod --config prod
```

#### Secret Access Patterns

**Doppler Environment Variables**:

Doppler automatically injects secrets as environment variables in the ECS tasks. No additional IAM permissions or code
changes are required for secret access.

**Application Secret Usage**:

````typescript
// Secrets are automatically available as environment variables
const openaiApiKey = process.env.OPENAI_API_KEY
const databaseUrl = process.env.RELATIONAL_DATABASE_URL
const redisUrl = process.env.REDIS_URL
}

// No additional secret management code needed - Doppler handles everything automatically

## 🔧 Environment Configuration Management

### Doppler Integration ✅ IMPLEMENTED

Doppler automatically handles secret injection into ECS tasks through environment variables. The application code remains unchanged and simply reads from `process.env`.

### Environment-Specific Configuration

Each environment has its own Doppler configuration that defines which secrets are available:

- **Development**: Local secrets for development
- **Staging**: Production-like secrets for testing
- **Production**: Live production secrets

### Secret Rotation Strategy

Doppler provides built-in secret rotation capabilities:

1. **Automatic Rotation**: Secrets can be rotated on a schedule
2. **Version Control**: Previous secret versions are retained
3. **Rollback Support**: Easy rollback to previous secret versions if needed

## 🌐 Domain and DNS Configuration

### Environment-Specific Domains

| Environment | Domain | Purpose |
|-------------|--------|---------|
| Development | `localhost:3040` | Local development |
| Staging | `staging.macro-ai.com` | Pre-production testing |
| Production | `macro-ai.com` | Live application |

### DNS Configuration

**Route 53 Hosted Zone**: `macro-ai.com`

**DNS Records**:
- `staging.macro-ai.com` → Load Balancer (Staging)
- `macro-ai.com` → Load Balancer (Production)

## 🔧 Environment Prerequisites

### Required Tools

1. **Doppler CLI**: For secret management
   ```bash
   brew install doppler
   doppler login
   ```

2. **AWS CLI**: For infrastructure management
   ```bash
   aws configure
   ```

3. **Pulumi CLI**: For infrastructure as code
   ```bash
   brew install pulumi
   ```

### Environment Access

Each team member should have:

- **Doppler Access**: Read access to appropriate projects
- **AWS Access**: Appropriate IAM permissions for deployment
- **GitHub Access**: Repository access for CI/CD triggers

## 🔍 Environment Validation

### Pre-Deployment Checks

Before deploying to any environment:

1. **Secret Validation**: Verify all required secrets are set in Doppler
2. **Infrastructure Check**: Ensure Pulumi stack is up-to-date
3. **DNS Validation**: Confirm DNS records point to correct load balancers
4. **Health Checks**: Verify application health endpoints

### Post-Deployment Validation

After deployment:

1. **Application Health**: Check API endpoints respond correctly
2. **Database Connectivity**: Verify database connections work
3. **External Services**: Confirm third-party integrations function
4. **Monitoring**: Validate CloudWatch metrics and alarms

```typescript
// Secrets are automatically available as environment variables
const openaiApiKey = process.env.OPENAI_API_KEY
const databaseUrl = process.env.RELATIONAL_DATABASE_URL
const redisUrl = process.env.REDIS_URL

### Secret Rotation Strategy ✅ IMPLEMENTED

#### Automated Rotation

Doppler provides built-in secret rotation capabilities:

```bash
# Rotate a specific secret
doppler secrets rotate API_KEY --project macro-ai-prod --config prod

# Set up automatic rotation schedule
doppler secrets set-rotation API_KEY --interval 90d --project macro-ai-prod --config prod

# View rotation history
doppler secrets history API_KEY --project macro-ai-prod --config prod

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
	RELATIONAL_DATABASE_URL: z.url(),
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
````
