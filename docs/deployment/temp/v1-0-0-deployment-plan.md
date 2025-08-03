# Macro AI v1.0.0 Production Deployment Implementation Plan

**Status**: 📋 PLANNED  
**Version**: v1.0.0  
**Target Date**: TBD  
**Environment**: AWS Production

## 🎯 Executive Summary

This document provides a comprehensive deployment implementation plan for Macro AI v1.0.0, optimizing the balance between
**performance**, **scalability**, and **cost-effectiveness**.

The architecture leverages AWS managed services with Infrastructure as Code (CDK), automated CI/CD pipelines, and
enterprise-grade security practices.

### Key Objectives

- **Performance**: Target <200ms API response times, <2s page load times
- **Scalability**: Auto-scale from 2-50 containers based on demand
- **Cost Optimization**: Estimated $150-800/month across environments
- **Security**: Zero-trust architecture with comprehensive monitoring
- **Reliability**: 99.9% uptime with automated failover

## 🏗️ Architecture Overview

### AWS Services Stack

| Service                       | Purpose                         | Environment Sizing             |
| ----------------------------- | ------------------------------- | ------------------------------ |
| **ECS Fargate**               | Containerized compute           | Dev: 1 task, Prod: 2-10 tasks  |
| **RDS PostgreSQL**            | Primary database with pgvector  | Dev: t3.micro, Prod: t3.medium |
| **ElastiCache Redis**         | Session & API caching           | Dev: t3.micro, Prod: t3.small  |
| **Application Load Balancer** | Traffic distribution            | Shared across environments     |
| **CloudFront**                | CDN for static assets           | Global edge locations          |
| **AWS Cognito**               | User authentication             | Pay-per-use                    |
| **AWS Secrets Manager**       | Secrets & credential management | ~$7/month for all environments |
| **S3**                        | Static assets & backups         | Standard/IA storage classes    |

### Performance Optimization Strategy

#### Database Performance

- **Connection Pooling**: 20 connections per API instance (Drizzle ORM)
- **Read Replicas**: Separate read traffic (70% reads, 30% writes)
- **Query Optimization**: pgvector indexes for AI embeddings
- **Connection Pool Configuration**:

  ```typescript
  pool: {
    min: 5,
    max: 20,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 600000
  }
  ```

#### CDN & Caching Strategy

- **CloudFront**: 24-hour cache for static assets, 5-minute for API responses
- **Redis Caching**:
  - Session data: 30-day TTL
  - API responses: 15-minute TTL
  - Chat history: 7-day TTL
- **Browser Caching**: 1-year for assets, no-cache for API

#### Auto-Scaling Configuration

- **CPU Threshold**: Scale out at 70%, scale in at 30%
- **Memory Threshold**: Scale out at 80%, scale in at 40%
- **Target Tracking**: Maintain 50% average CPU utilization
- **Scaling Policies**:

  ```yaml
  ScaleOutCooldown: 300s
  ScaleInCooldown: 600s
  MinCapacity: 2
  MaxCapacity: 10 (prod), 3 (staging), 1 (dev)
  ```

### Scalability Architecture

#### Horizontal Scaling Thresholds

- **Development**: 1 task, no auto-scaling
- **Staging**: 1-3 tasks, basic auto-scaling
- **Production**: 2-10 tasks, advanced auto-scaling with predictive scaling

#### Load Balancer Configuration

- **Health Checks**: `/health` endpoint every 30s
- **Unhealthy Threshold**: 3 consecutive failures
- **Healthy Threshold**: 2 consecutive successes
- **Timeout**: 5 seconds
- **Deregistration Delay**: 30 seconds

#### Database Scaling Strategy

- **Read Replicas**: 1 replica in production, cross-AZ
- **Connection Pooling**: PgBouncer for connection management
- **Vertical Scaling**: Automated instance class upgrades based on metrics

### Cost Management Strategy

#### Instance Sizing Recommendations

**Development Environment** (~$50/month):

- ECS Tasks: 0.25 vCPU, 512 MB RAM
- RDS: db.t3.micro (1 vCPU, 1 GB RAM)
- ElastiCache: cache.t3.micro (1 vCPU, 0.5 GB RAM)

**Staging Environment** (~$100/month):

- ECS Tasks: 0.5 vCPU, 1024 MB RAM
- RDS: db.t3.small (2 vCPU, 2 GB RAM)
- ElastiCache: cache.t3.small (2 vCPU, 1.5 GB RAM)

**Production Environment** (~$300-800/month):

- ECS Tasks: 1 vCPU, 2048 MB RAM
- RDS: db.t3.medium (2 vCPU, 4 GB RAM) + Read Replica
- ElastiCache: cache.t3.small (2 vCPU, 1.5 GB RAM)

#### Cost Optimization Strategies

1. **Reserved Instances**: 40% savings on RDS after 6 months
2. **Spot Instances**: Not recommended for production workloads
3. **S3 Intelligent Tiering**: Automatic cost optimization for storage
4. **CloudWatch Logs**: 7-day retention for development, 30-day for production
5. **Scheduled Scaling**: Scale down non-production environments after hours

#### Cost Monitoring & Alerts

- **Budget Alerts**: $100 (dev), $150 (staging), $1000 (prod)
- **Cost Anomaly Detection**: 20% increase threshold
- **Resource Tagging**: Environment, Project, Owner tags for cost allocation

## 📋 Implementation Phases

### Phase 1: Infrastructure Foundation (Week 1-2)

- [ ] AWS CDK project initialization
- [ ] VPC and networking setup
- [ ] Security groups and IAM roles
- [ ] RDS PostgreSQL with pgvector extension
- [ ] ElastiCache Redis cluster
- [ ] S3 buckets for assets and logs

### Phase 2: Container Platform (Week 2-3)

- [ ] Docker image creation and optimization
- [ ] ECR repository setup
- [ ] ECS Fargate cluster configuration
- [ ] Application Load Balancer setup
- [ ] CloudFront distribution

### Phase 3: CI/CD Pipeline (Week 3-4)

- [ ] GitHub Actions workflow setup
- [ ] Automated testing pipeline
- [ ] Security scanning integration
- [ ] Multi-environment deployment
- [ ] Rollback procedures

### Phase 4: Monitoring & Security (Week 4-5)

- [ ] CloudWatch dashboards and alarms
- [ ] AWS Secrets Manager integration
- [ ] WAF and security headers
- [ ] Backup and disaster recovery
- [ ] Performance testing and optimization

### Phase 5: Production Deployment (Week 5-6)

- [ ] Production environment deployment
- [ ] DNS and SSL certificate setup
- [ ] Load testing and performance validation
- [ ] Security audit and penetration testing
- [ ] Go-live checklist and monitoring

## 🔧 Technical Implementation Details

### Container Configuration

**Express API Container**:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
EXPOSE 3040
CMD ["node", "dist/index.js"]
```

**React UI Container**:

```dockerfile
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Environment Variables Strategy

**Development**:

- Local .env files
- Docker Compose for databases
- Mock external services

**Staging/Production**:

- AWS Secrets Manager for sensitive data
- Systems Manager Parameter Store for configuration
- Environment-specific overrides

### Database Migration Strategy

**Schema Management**:

```bash
# Generate migrations
pnpm db:generate:express-api

# Apply to development
pnpm db:push:express-api

# Production deployment
drizzle-kit migrate --config=drizzle.config.prod.ts
```

**pgvector Extension Setup**:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE INDEX ON embeddings USING ivfflat (embedding vector_cosine_ops);
```

## 🛡️ Security Implementation

### Network Security

- **VPC**: Private subnets for all compute and data resources
- **Security Groups**: Least privilege access rules
- **NACLs**: Additional network-level protection
- **WAF**: Protection against common web attacks

### Application Security

- **HTTPS Only**: TLS 1.3 encryption for all traffic
- **Security Headers**: HSTS, CSP, X-Frame-Options
- **Rate Limiting**: API and authentication endpoints
- **Input Validation**: Zod schemas for all API inputs

### Data Security

- **Encryption at Rest**: RDS, S3, and EBS encryption
- **Encryption in Transit**: TLS for all communications
- **Secrets Management**: AWS Secrets Manager with automatic rotation
- **Backup Encryption**: Automated encrypted backups

## 🔐 AWS Secrets Manager Implementation

### Production Secrets Manager

```typescript
// src/config/production-secrets.ts
import {
	SecretsManagerClient,
	GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager'

const secretsClient = new SecretsManagerClient({
	region: process.env.AWS_REGION || 'us-east-1',
})

export class ProductionSecretsManager {
	private static cache = new Map<string, { value: any; expires: number }>()

	static async getSecret(secretId: string, useCache = true): Promise<any> {
		// Check cache first (10-minute TTL for production)
		if (useCache) {
			const cached = this.cache.get(secretId)
			if (cached && Date.now() < cached.expires) {
				return cached.value
			}
		}

		try {
			const command = new GetSecretValueCommand({ SecretId: secretId })
			const response = await secretsClient.send(command)

			let secretValue
			if (response.SecretString) {
				try {
					secretValue = JSON.parse(response.SecretString)
				} catch {
					secretValue = response.SecretString
				}
			} else if (response.SecretBinary) {
				secretValue = Buffer.from(response.SecretBinary).toString('ascii')
			}

			// Cache for 10 minutes
			if (useCache) {
				this.cache.set(secretId, {
					value: secretValue,
					expires: Date.now() + 10 * 60 * 1000,
				})
			}

			return secretValue
		} catch (error) {
			console.error(`Failed to retrieve secret ${secretId}:`, error)
			throw error
		}
	}

	// Automatic rotation validation
	static async validateRotation(secretId: string): Promise<boolean> {
		try {
			const secret = await this.getSecret(secretId, false)

			// Test secret functionality based on type
			switch (secretId) {
				case 'macro-ai/prod/database':
					return await this.testDatabaseConnection(secret)
				case 'macro-ai/prod/openai-api-key':
					return await this.testOpenAIKey(secret)
				case 'macro-ai/prod/redis-credentials':
					return await this.testRedisConnection(secret)
				default:
					return true
			}
		} catch (error) {
			console.error(`Rotation validation failed for ${secretId}:`, error)
			return false
		}
	}

	private static async testDatabaseConnection(
		credentials: any,
	): Promise<boolean> {
		try {
			// Test database connection with new credentials
			const { drizzle } = await import('drizzle-orm/postgres-js')
			const postgres = (await import('postgres')).default

			const sql = postgres(credentials.url, { max: 1 })
			const db = drizzle(sql)

			await sql`SELECT 1`
			await sql.end()

			return true
		} catch (error) {
			console.error('Database connection test failed:', error)
			return false
		}
	}

	private static async testOpenAIKey(apiKey: string): Promise<boolean> {
		try {
			const response = await fetch('https://api.openai.com/v1/models', {
				headers: {
					Authorization: `Bearer ${apiKey}`,
				},
			})

			return response.ok
		} catch (error) {
			console.error('OpenAI API key test failed:', error)
			return false
		}
	}

	private static async testRedisConnection(credentials: any): Promise<boolean> {
		try {
			const Redis = (await import('ioredis')).default
			const redis = new Redis(credentials.url)

			await redis.ping()
			await redis.disconnect()

			return true
		} catch (error) {
			console.error('Redis connection test failed:', error)
			return false
		}
	}
}
```

### CDK Secrets Manager Implementation

```typescript
// infrastructure/lib/constructs/secrets/production-secrets-manager.ts
import {
	aws_secretsmanager as secretsmanager,
	aws_iam as iam,
	aws_lambda as lambda,
	Duration,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'

export interface ProductionSecretsManagerProps {
	environment: string
	lambdaRole: iam.Role
	databaseInstance?: any
}

export class ProductionSecretsManager extends Construct {
	public readonly secrets: { [key: string]: secretsmanager.Secret } = {}
	public readonly rotationLambda: lambda.Function

	constructor(
		scope: Construct,
		id: string,
		props: ProductionSecretsManagerProps,
	) {
		super(scope, id)

		// Database credentials with automatic rotation
		this.secrets.database = new secretsmanager.Secret(this, 'DatabaseSecret', {
			secretName: `macro-ai/${props.environment}/database`,
			description: 'Database credentials for macro-ai',
			generateSecretString: {
				secretStringTemplate: JSON.stringify({
					username: 'postgres',
					engine: 'postgres',
					host: props.databaseInstance?.instanceEndpoint?.hostname,
					port: 5432,
					dbname: 'macro_ai',
				}),
				generateStringKey: 'password',
				excludeCharacters: '"@/\\\'',
			},
		})

		// OpenAI API key (manual rotation)
		this.secrets.openaiApiKey = new secretsmanager.Secret(
			this,
			'OpenAIApiKeySecret',
			{
				secretName: `macro-ai/${props.environment}/openai-api-key`,
				description: 'OpenAI API key for macro-ai',
			},
		)

		// JWT signing secrets
		this.secrets.jwtSecrets = new secretsmanager.Secret(
			this,
			'JWTSecretsSecret',
			{
				secretName: `macro-ai/${props.environment}/jwt-secrets`,
				description: 'JWT signing secrets for macro-ai',
				generateSecretString: {
					secretStringTemplate: JSON.stringify({}),
					generateStringKey: 'accessTokenSecret',
					passwordLength: 64,
					excludeCharacters: '"@/\\\'',
				},
			},
		)

		// Redis credentials
		this.secrets.redisCredentials = new secretsmanager.Secret(
			this,
			'RedisCredentialsSecret',
			{
				secretName: `macro-ai/${props.environment}/redis-credentials`,
				description: 'Redis connection credentials for macro-ai',
			},
		)

		// Third-party API credentials
		this.secrets.thirdPartyApis = new secretsmanager.Secret(
			this,
			'ThirdPartyApisSecret',
			{
				secretName: `macro-ai/${props.environment}/third-party-apis`,
				description: 'Third-party API credentials for macro-ai',
			},
		)

		// Create rotation Lambda for database credentials
		this.rotationLambda = new lambda.Function(this, 'RotationLambda', {
			runtime: lambda.Runtime.NODEJS_20_X,
			handler: 'index.handler',
			code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Rotation event:', JSON.stringify(event, null, 2));
          // Implement rotation logic here
          return { statusCode: 200 };
        };
      `),
			timeout: Duration.minutes(5),
		})

		// Enable automatic rotation for database credentials
		if (props.databaseInstance) {
			this.secrets.database.addRotationSchedule('DatabaseRotationSchedule', {
				automaticallyAfter: Duration.days(30),
				rotationLambda: this.rotationLambda,
			})
		}

		// Create IAM policy for Lambda access to secrets
		this.createSecretsAccessPolicy(props.lambdaRole)

		// Create cross-region replication for critical secrets
		if (props.environment === 'prod') {
			this.setupCrossRegionReplication()
		}
	}

	private createSecretsAccessPolicy(lambdaRole: iam.Role) {
		lambdaRole.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'secretsmanager:GetSecretValue',
					'secretsmanager:DescribeSecret',
				],
				resources: Object.values(this.secrets).map(
					(secret) => secret.secretArn,
				),
			}),
		)

		// Allow rotation Lambda to update secrets
		this.rotationLambda.addToRolePolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					'secretsmanager:DescribeSecret',
					'secretsmanager:GetSecretValue',
					'secretsmanager:PutSecretValue',
					'secretsmanager:UpdateSecretVersionStage',
				],
				resources: Object.values(this.secrets).map(
					(secret) => secret.secretArn,
				),
			}),
		)
	}

	private setupCrossRegionReplication() {
		// Replicate critical secrets to backup region
		const criticalSecrets = [this.secrets.database, this.secrets.jwtSecrets]

		criticalSecrets.forEach((secret, index) => {
			secret.addReplicaRegion({
				region: 'us-west-2', // Backup region
				encryptionKey: undefined, // Use default KMS key in backup region
			})
		})
	}
}
```

## 📊 Monitoring & Observability

### CloudWatch Metrics

- **Application Metrics**: Response time, error rate, throughput
- **Infrastructure Metrics**: CPU, memory, disk, network
- **Business Metrics**: User registrations, chat sessions, API usage

### Alerting Strategy

- **Critical**: P1 alerts for service outages (5-minute threshold)
- **Warning**: P2 alerts for performance degradation (15-minute threshold)
- **Info**: P3 alerts for capacity planning (1-hour threshold)

### Log Aggregation

- **Application Logs**: Structured JSON logging with Pino
- **Access Logs**: ALB and CloudFront access logs
- **Audit Logs**: Authentication and authorization events

## 🚀 Deployment Procedures

### Automated Deployment Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS
on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Deploy infrastructure
        run: |
          cd infrastructure
          npm install
          cdk deploy --require-approval never

      - name: Build and push images
        run: |
          docker build -t macro-ai/api:${{ github.sha }} apps/express-api
          docker build -t macro-ai/ui:${{ github.sha }} apps/client-ui

          aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REGISTRY
          docker push macro-ai/api:${{ github.sha }}
          docker push macro-ai/ui:${{ github.sha }}

      - name: Update ECS services
        run: |
          aws ecs update-service --cluster macro-ai-cluster --service api-service --force-new-deployment
          aws ecs update-service --cluster macro-ai-cluster --service ui-service --force-new-deployment
```

### Rollback Procedures

**Automated Rollback Triggers**:

- Error rate > 5% for 5 minutes
- Response time > 2 seconds for 10 minutes
- Health check failures > 50% for 3 minutes

**Manual Rollback Process**:

```bash
# Rollback to previous task definition
aws ecs update-service --cluster macro-ai-cluster --service api-service --task-definition macro-ai-api:PREVIOUS_REVISION

# Rollback infrastructure changes
cd infrastructure && cdk deploy --require-approval never --rollback
```

## 📈 Performance Benchmarks

### Target Metrics

- **API Response Time**: <200ms (95th percentile)
- **Page Load Time**: <2 seconds (first contentful paint)
- **Database Query Time**: <50ms (average)
- **Cache Hit Rate**: >90% for frequently accessed data
- **Uptime**: 99.9% availability

### Load Testing Strategy

- **Baseline**: 100 concurrent users, 1000 requests/minute
- **Peak Load**: 500 concurrent users, 5000 requests/minute
- **Stress Test**: 1000 concurrent users until failure point
- **Endurance**: 24-hour test at 50% peak load

## 🔄 Maintenance & Operations

### Backup Strategy

- **Database**: Automated daily backups with 30-day retention
- **Application Data**: S3 cross-region replication
- **Configuration**: Infrastructure as Code in Git

### Update Procedures

- **Security Updates**: Automated patching for managed services
- **Application Updates**: Blue-green deployment strategy
- **Database Schema**: Migration scripts with rollback capability

### Disaster Recovery

- **RTO**: 4 hours (Recovery Time Objective)
- **RPO**: 1 hour (Recovery Point Objective)
- **Multi-AZ**: Automatic failover for database and cache
- **Cross-Region**: Backup replication to secondary region

## 🏗️ AWS CDK Implementation

### Project Structure

```text
infrastructure/
├── bin/
│   └── macro-ai-app.ts              # CDK app entry point
├── lib/
│   ├── constructs/
│   │   ├── compute/
│   │   │   ├── ecs-fargate.ts       # ECS cluster and services
│   │   │   └── load-balancer.ts     # ALB configuration
│   │   ├── database/
│   │   │   ├── rds-postgres.ts      # PostgreSQL with pgvector
│   │   │   └── elasticache.ts       # Redis cluster
│   │   ├── networking/
│   │   │   ├── vpc.ts               # VPC and subnets
│   │   │   └── security-groups.ts   # Security configurations
│   │   ├── storage/
│   │   │   └── s3-buckets.ts        # S3 buckets for assets/logs
│   │   └── monitoring/
│   │       └── cloudwatch.ts        # Dashboards and alarms
│   ├── stacks/
│   │   ├── network-stack.ts         # VPC and networking
│   │   ├── data-stack.ts            # RDS and ElastiCache
│   │   ├── compute-stack.ts         # ECS and ALB
│   │   └── monitoring-stack.ts      # CloudWatch and alerts
│   └── config/
│       ├── dev.ts                   # Development configuration
│       ├── staging.ts               # Staging configuration
│       └── prod.ts                  # Production configuration
├── package.json
├── cdk.json
└── tsconfig.json
```

### Key CDK Constructs

**ECS Fargate Service Configuration**:

```typescript
// lib/constructs/compute/ecs-fargate.ts
import { aws_ecs as ecs, aws_logs as logs } from 'aws-cdk-lib'

export class EcsFargateConstruct extends Construct {
	constructor(scope: Construct, id: string, props: EcsFargateProps) {
		super(scope, id)

		// API Service Task Definition
		const apiTaskDef = new ecs.FargateTaskDefinition(this, 'ApiTaskDef', {
			memoryLimitMiB: props.environment === 'prod' ? 2048 : 1024,
			cpu: props.environment === 'prod' ? 1024 : 512,
		})

		apiTaskDef.addContainer('api', {
			image: ecs.ContainerImage.fromRegistry(
				`${props.ecrRepository}/api:latest`,
			),
			portMappings: [{ containerPort: 3040 }],
			logging: ecs.LogDrivers.awsLogs({
				streamPrefix: 'api',
				logRetention:
					props.environment === 'prod'
						? logs.RetentionDays.ONE_MONTH
						: logs.RetentionDays.ONE_WEEK,
			}),
			environment: {
				NODE_ENV: props.environment,
				APP_ENV: props.environment,
			},
			secrets: {
				API_KEY: ecs.Secret.fromSecretsManager(props.apiKeySecret),
				RELATIONAL_DATABASE_URL: ecs.Secret.fromSecretsManager(props.dbSecret),
				REDIS_URL: ecs.Secret.fromSecretsManager(props.redisSecret),
			},
		})

		// Auto Scaling Configuration
		const apiService = new ecs.FargateService(this, 'ApiService', {
			cluster: props.cluster,
			taskDefinition: apiTaskDef,
			desiredCount: props.environment === 'prod' ? 2 : 1,
			assignPublicIp: false,
		})

		const scaling = apiService.autoScaleTaskCount({
			minCapacity: props.environment === 'prod' ? 2 : 1,
			maxCapacity: props.environment === 'prod' ? 10 : 3,
		})

		scaling.scaleOnCpuUtilization('CpuScaling', {
			targetUtilizationPercent: 50,
			scaleInCooldown: Duration.minutes(10),
			scaleOutCooldown: Duration.minutes(5),
		})

		scaling.scaleOnMemoryUtilization('MemoryScaling', {
			targetUtilizationPercent: 70,
			scaleInCooldown: Duration.minutes(10),
			scaleOutCooldown: Duration.minutes(5),
		})
	}
}
```

**RDS PostgreSQL with pgvector**:

```typescript
// lib/constructs/database/rds-postgres.ts
import { aws_rds as rds, aws_ec2 as ec2 } from 'aws-cdk-lib'

export class RdsPostgresConstruct extends Construct {
	constructor(scope: Construct, id: string, props: RdsPostgresProps) {
		super(scope, id)

		// Parameter Group for pgvector
		const parameterGroup = new rds.ParameterGroup(this, 'PostgresParams', {
			engine: rds.DatabaseInstanceEngine.postgres({
				version: rds.PostgresEngineVersion.VER_15_4,
			}),
			parameters: {
				shared_preload_libraries: 'vector',
				max_connections: props.environment === 'prod' ? '200' : '100',
				work_mem: '16MB',
				maintenance_work_mem: '256MB',
			},
		})

		// Primary Database Instance
		const database = new rds.DatabaseInstance(this, 'Database', {
			engine: rds.DatabaseInstanceEngine.postgres({
				version: rds.PostgresEngineVersion.VER_15_4,
			}),
			instanceType:
				props.environment === 'prod'
					? ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM)
					: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
			vpc: props.vpc,
			vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
			securityGroups: [props.databaseSecurityGroup],
			parameterGroup,
			multiAz: props.environment === 'prod',
			deletionProtection: props.environment === 'prod',
			backupRetention:
				props.environment === 'prod' ? Duration.days(30) : Duration.days(7),
			storageEncrypted: true,
			monitoringInterval:
				props.environment === 'prod' ? Duration.seconds(60) : undefined,
		})

		// Read Replica for Production
		if (props.environment === 'prod') {
			new rds.DatabaseInstanceReadReplica(this, 'ReadReplica', {
				sourceDatabaseInstance: database,
				instanceType: ec2.InstanceType.of(
					ec2.InstanceClass.T3,
					ec2.InstanceSize.SMALL,
				),
				vpc: props.vpc,
				vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
				securityGroups: [props.databaseSecurityGroup],
			})
		}
	}
}
```

### Environment-Specific Configurations

**Production Configuration**:

```typescript
// lib/config/prod.ts
export const prodConfig = {
	environment: 'prod',
	vpc: {
		maxAzs: 3,
		natGateways: 3,
	},
	database: {
		instanceType: ec2.InstanceType.of(
			ec2.InstanceClass.T3,
			ec2.InstanceSize.MEDIUM,
		),
		multiAz: true,
		deletionProtection: true,
		backupRetention: Duration.days(30),
		readReplicas: 1,
	},
	ecs: {
		desiredCount: 2,
		minCapacity: 2,
		maxCapacity: 10,
		cpu: 1024,
		memoryLimitMiB: 2048,
	},
	cache: {
		nodeType: 'cache.t3.small',
		numCacheNodes: 2,
	},
	monitoring: {
		detailedMonitoring: true,
		logRetention: logs.RetentionDays.ONE_MONTH,
	},
}
```

**Development Configuration**:

```typescript
// lib/config/dev.ts
export const devConfig = {
	environment: 'dev',
	vpc: {
		maxAzs: 1,
		natGateways: 1,
	},
	database: {
		instanceType: ec2.InstanceType.of(
			ec2.InstanceClass.T3,
			ec2.InstanceSize.MICRO,
		),
		multiAz: false,
		deletionProtection: false,
		backupRetention: Duration.days(1),
		readReplicas: 0,
	},
	ecs: {
		desiredCount: 1,
		minCapacity: 1,
		maxCapacity: 1,
		cpu: 512,
		memoryLimitMiB: 1024,
	},
	cache: {
		nodeType: 'cache.t3.micro',
		numCacheNodes: 1,
	},
	monitoring: {
		detailedMonitoring: false,
		logRetention: logs.RetentionDays.ONE_WEEK,
	},
}
```

## 🐳 Docker Implementation

### Multi-Stage Dockerfile for Express API

```dockerfile
# apps/express-api/Dockerfile
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat
RUN corepack enable pnpm

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM base AS build
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM base AS runtime
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressjs

COPY --from=deps --chown=expressjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=expressjs:nodejs /app/dist ./dist
COPY --from=build --chown=expressjs:nodejs /app/package.json ./package.json

USER expressjs
EXPOSE 3040
ENV NODE_ENV=production
ENV PORT=3040

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3040/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["node", "dist/index.js"]
```

### Optimized Dockerfile for React UI

```dockerfile
# apps/client-ui/Dockerfile
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat
RUN corepack enable pnpm

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:alpine AS runtime
RUN addgroup --system --gid 1001 nginx-app
RUN adduser --system --uid 1001 nginx-app

# Custom nginx configuration
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

# Security headers and performance optimizations
RUN chown -R nginx-app:nginx-app /usr/share/nginx/html
RUN chown -R nginx-app:nginx-app /var/cache/nginx
RUN chown -R nginx-app:nginx-app /var/log/nginx

USER nginx-app
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

### Nginx Configuration for React UI

```nginx
# apps/client-ui/nginx.conf
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.macro-ai.com;" always;

    # Performance optimizations
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    server {
        listen 80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # Handle React Router
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
```

## 🔐 Manual AWS Setup Requirements

### Prerequisites (Manual Setup Required)

#### 1. AWS Account Configuration

- [ ] **AWS Account**: Create or use existing AWS account
- [ ] **IAM User**: Create deployment user with programmatic access
- [ ] **IAM Policies**: Attach required policies for CDK deployment

  ```json
  {
  	"Version": "2012-10-17",
  	"Statement": [
  		{
  			"Effect": "Allow",
  			"Action": [
  				"cloudformation:*",
  				"ecs:*",
  				"rds:*",
  				"elasticache:*",
  				"ec2:*",
  				"elasticloadbalancing:*",
  				"cloudfront:*",
  				"s3:*",
  				"iam:*",
  				"logs:*",
  				"secretsmanager:*",
  				"ssm:*"
  			],
  			"Resource": "*"
  		}
  	]
  }
  ```

#### 2. Domain and DNS Setup

- [ ] **Domain Registration**: Register domain (e.g., macro-ai.com)
- [ ] **Route 53 Hosted Zone**: Create hosted zone for domain
- [ ] **SSL Certificate**: Request ACM certificate for domain and \*.domain
- [ ] **DNS Validation**: Complete certificate validation

#### 3. External Service Configuration

- [ ] **OpenAI API Key**: Obtain API key from OpenAI
- [ ] **GitHub Repository**: Ensure repository access for CI/CD
- [ ] **Container Registry**: Set up ECR repositories

#### 4. Security Configuration

- [ ] **AWS Secrets Manager**: Create initial secrets
  - API keys (OpenAI, internal API key)
  - Database credentials
  - Cookie encryption keys
- [ ] **Parameter Store**: Create configuration parameters
  - Environment-specific settings
  - Feature flags

### GitHub Actions Secrets Setup

Required secrets in GitHub repository:

```bash
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
ECR_REGISTRY=123456789012.dkr.ecr.us-east-1.amazonaws.com
```

### Initial Database Setup

After RDS deployment, manually run:

```sql
-- Connect to PostgreSQL as superuser
CREATE EXTENSION IF NOT EXISTS vector;

-- Create application database and user
CREATE DATABASE macro_ai_prod;
CREATE USER macro_ai_app WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE macro_ai_prod TO macro_ai_app;

-- Grant vector extension permissions
\c macro_ai_prod
GRANT USAGE ON SCHEMA public TO macro_ai_app;
GRANT CREATE ON SCHEMA public TO macro_ai_app;
```

## 🚀 CI/CD Pipeline Implementation

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy Macro AI

on:
  push:
    branches: [main, develop]
    tags: ['v*']
  pull_request:
    branches: [main]

env:
  AWS_REGION: us-east-1
  ECR_REGISTRY: ${{ secrets.ECR_REGISTRY }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run type checking
        run: pnpm type-check

      - name: Run linting
        run: pnpm lint

      - name: Run unit tests
        run: pnpm test:coverage

      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'

  build-and-push:
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v')

    strategy:
      matrix:
        service: [api, ui]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, tag, and push image
        env:
          IMAGE_TAG: ${{ github.sha }}
        run: |
          if [ "${{ matrix.service }}" = "api" ]; then
            docker build -t $ECR_REGISTRY/macro-ai-api:$IMAGE_TAG apps/express-api
            docker push $ECR_REGISTRY/macro-ai-api:$IMAGE_TAG
            docker tag $ECR_REGISTRY/macro-ai-api:$IMAGE_TAG $ECR_REGISTRY/macro-ai-api:latest
            docker push $ECR_REGISTRY/macro-ai-api:latest
          else
            docker build -t $ECR_REGISTRY/macro-ai-ui:$IMAGE_TAG apps/client-ui
            docker push $ECR_REGISTRY/macro-ai-ui:$IMAGE_TAG
            docker tag $ECR_REGISTRY/macro-ai-ui:$IMAGE_TAG $ECR_REGISTRY/macro-ai-ui:latest
            docker push $ECR_REGISTRY/macro-ai-ui:latest
          fi

  deploy-staging:
    needs: [build-and-push]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: staging

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install CDK
        run: npm install -g aws-cdk

      - name: Deploy infrastructure
        run: |
          cd infrastructure
          npm install
          cdk deploy MacroAiStagingStack --require-approval never

      - name: Update ECS services
        run: |
          aws ecs update-service \
            --cluster macro-ai-staging-cluster \
            --service macro-ai-staging-api-service \
            --force-new-deployment

          aws ecs update-service \
            --cluster macro-ai-staging-cluster \
            --service macro-ai-staging-ui-service \
            --force-new-deployment

      - name: Wait for deployment
        run: |
          aws ecs wait services-stable \
            --cluster macro-ai-staging-cluster \
            --services macro-ai-staging-api-service macro-ai-staging-ui-service

  integration-tests:
    needs: [deploy-staging]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run integration tests
        env:
          API_BASE_URL: https://staging-api.macro-ai.com
        run: pnpm test:integration

      - name: Run E2E tests
        env:
          BASE_URL: https://staging.macro-ai.com
        run: pnpm test:e2e

  deploy-production:
    needs: [integration-tests]
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/v')
    environment: production

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install CDK
        run: npm install -g aws-cdk

      - name: Update Secrets Manager
        run: |
          # Update production secrets with latest values
          aws secretsmanager update-secret \
            --secret-id "macro-ai/prod/openai-api-key" \
            --secret-string "${{ secrets.OPENAI_API_KEY }}"

          # Update database credentials if needed
          aws secretsmanager update-secret \
            --secret-id "macro-ai/prod/database" \
            --secret-string '{"username":"postgres","password":"${{ secrets.DB_PASSWORD }}","host":"${{ secrets.DB_HOST }}","port":5432,"dbname":"macro_ai"}'

          # Update Redis credentials
          aws secretsmanager update-secret \
            --secret-id "macro-ai/prod/redis-credentials" \
            --secret-string '{"url":"${{ secrets.REDIS_URL }}"}'

      - name: Deploy infrastructure
        run: |
          cd infrastructure
          npm install
          cdk deploy MacroAiProductionStack --require-approval never

      - name: Update ECS services
        run: |
          aws ecs update-service \
            --cluster macro-ai-production-cluster \
            --service macro-ai-production-api-service \
            --force-new-deployment

          aws ecs update-service \
            --cluster macro-ai-production-cluster \
            --service macro-ai-production-ui-service \
            --force-new-deployment

      - name: Wait for deployment
        run: |
          aws ecs wait services-stable \
            --cluster macro-ai-production-cluster \
            --services macro-ai-production-api-service macro-ai-production-ui-service

      - name: Run smoke tests
        env:
          API_BASE_URL: https://api.macro-ai.com
        run: pnpm test:smoke

      - name: Create GitHub release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref }}
          release_name: Release ${{ github.ref }}
          draft: false
          prerelease: false
```

### Deployment Scripts

**Infrastructure Deployment Script**:

```bash
#!/bin/bash
# scripts/deploy-infrastructure.sh

set -e

ENVIRONMENT=${1:-staging}
STACK_NAME="MacroAi${ENVIRONMENT^}Stack"

echo "🚀 Deploying infrastructure for $ENVIRONMENT environment..."

# Install dependencies
cd infrastructure
npm install

# Bootstrap CDK if needed
if ! aws cloudformation describe-stacks --stack-name CDKToolkit >/dev/null 2>&1; then
    echo "📦 Bootstrapping CDK..."
    cdk bootstrap
fi

# Deploy stack
echo "🏗️ Deploying $STACK_NAME..."
cdk deploy $STACK_NAME --require-approval never

# Get outputs
echo "📋 Stack outputs:"
aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
    --output table

echo "✅ Infrastructure deployment completed!"
```

**Application Deployment Script**:

```bash
#!/bin/bash
# scripts/deploy-application.sh

set -e

ENVIRONMENT=${1:-staging}
IMAGE_TAG=${2:-latest}

echo "🚀 Deploying application for $ENVIRONMENT environment..."

# Update ECS services
CLUSTER_NAME="macro-ai-${ENVIRONMENT}-cluster"
API_SERVICE="macro-ai-${ENVIRONMENT}-api-service"
UI_SERVICE="macro-ai-${ENVIRONMENT}-ui-service"

echo "🔄 Updating API service..."
aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service $API_SERVICE \
    --force-new-deployment

echo "🔄 Updating UI service..."
aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service $UI_SERVICE \
    --force-new-deployment

echo "⏳ Waiting for services to stabilize..."
aws ecs wait services-stable \
    --cluster $CLUSTER_NAME \
    --services $API_SERVICE $UI_SERVICE

echo "✅ Application deployment completed!"
```

## 📊 Cost Analysis & Optimization

### Detailed Cost Breakdown

**Development Environment** (~$50/month):

```text
ECS Fargate (1 task):           $15/month
RDS t3.micro:                   $12/month
ElastiCache t3.micro:           $11/month
ALB:                            $16/month
AWS Secrets Manager:            $2.15/month
Data Transfer:                  $3/month
CloudWatch Logs:                $2/month
S3 Storage:                     $1/month
Total:                          ~$62/month
```

**Staging Environment** (~$120/month):

```text
ECS Fargate (1-3 tasks):        $45/month
RDS t3.small:                   $25/month
ElastiCache t3.small:           $35/month
ALB:                            $16/month
AWS Secrets Manager:            $2.15/month
Data Transfer:                  $8/month
CloudWatch Logs:                $5/month
S3 Storage:                     $2/month
Total:                          ~$138/month
```

**Production Environment** (~$400-800/month):

```text
ECS Fargate (2-10 tasks):       $150-750/month
RDS t3.medium + Read Replica:   $100/month
ElastiCache t3.small:           $35/month
ALB:                            $16/month
AWS Secrets Manager:            $2.15/month
CloudFront:                     $10/month
Data Transfer:                  $20/month
CloudWatch Logs:                $15/month
S3 Storage:                     $5/month
Backup & Monitoring:            $10/month
Total:                          ~$363-963/month
```

### Cost Optimization Strategies

**Reserved Instances (40% savings)**:

- RDS Reserved Instances after 6 months
- ElastiCache Reserved Nodes for production

**Scheduled Scaling**:

```yaml
# Scale down non-production environments
Development: Scale to 0 tasks 6 PM - 8 AM weekdays, weekends
Staging: Scale to 1 task 10 PM - 6 AM weekdays
```

## 🔒 Security Comparison: Secrets Manager vs Parameter Store

### AWS Secrets Manager (Production Choice)

**Security Features:**

- ✅ **Automatic Rotation**: Built-in rotation for RDS, custom rotation for API keys
- ✅ **Customer-Managed KMS Keys**: Full control over encryption keys
- ✅ **Cross-Region Replication**: Disaster recovery with separate encryption
- ✅ **Fine-Grained Access Control**: Resource-based policies with conditions
- ✅ **Comprehensive Audit Logging**: Detailed access logs and compliance reporting
- ✅ **Version Management**: Multiple versions with staging labels
- ✅ **Rollback Capabilities**: Easy reversion to previous versions

**Cost Impact:**

```text
Secret Storage (5 secrets):      $2.00/month
API Calls (~100k/month):         $0.50/month
Total Secrets Manager Cost:      $2.50/month per environment
```

**Use Cases:**

- Database credentials requiring automatic rotation
- API keys with compliance requirements
- Production environments with enterprise security needs
- Multi-region deployments requiring replication

### Parameter Store Alternative (Hobby/Development)

**Security Features:**

- ✅ **Basic Encryption**: AWS managed KMS keys
- ✅ **Cost Effective**: Free tier for standard parameters
- ⚠️ **Manual Rotation**: Requires custom rotation procedures
- ⚠️ **Limited Audit**: Basic CloudTrail logging only
- ❌ **No Versioning**: Cannot rollback to previous values
- ❌ **No Cross-Region Replication**: Manual backup required

**Cost Impact:**

```text
Standard Parameters:             $0.00/month (free tier)
Advanced Parameters:             $0.05 per 10k calls
Total Parameter Store Cost:      $0.00-0.15/month
```

**Use Cases:**

- Development and testing environments
- Cost-sensitive hobby projects
- Non-critical configuration data
- Simple secrets without rotation requirements

### Migration Strategy

**When to Upgrade from Parameter Store to Secrets Manager:**

1. **User Growth**: >100 active users requiring enterprise security
2. **Compliance Requirements**: SOC, PCI DSS, or other regulatory standards
3. **Operational Maturity**: Need for automatic rotation and lifecycle management
4. **Budget Flexibility**: Can accommodate $2.50/month per environment

**Migration Process:**

1. **Parallel Implementation**: Deploy hybrid secrets manager
2. **Data Migration**: Transfer secrets with validation
3. **Rotation Setup**: Configure automatic rotation schedules
4. **Validation**: Test all secret access patterns
5. **Cutover**: Switch to Secrets Manager with zero downtime

**S3 Storage Optimization**:

- Intelligent Tiering for logs and backups
- Lifecycle policies for old data
- Compression for log files

**CloudWatch Cost Controls**:

- Log retention policies (7 days dev, 30 days prod)
- Metric filters to reduce noise
- Custom metrics only for critical KPIs

### Cost Monitoring Setup

**Budget Alerts**:

```typescript
// lib/constructs/monitoring/budgets.ts
new budgets.CfnBudget(this, 'MonthlyBudget', {
	budget: {
		budgetName: `macro-ai-${props.environment}-monthly`,
		budgetLimit: {
			amount: props.environment === 'prod' ? 1000 : 100,
			unit: 'USD',
		},
		timeUnit: 'MONTHLY',
		budgetType: 'COST',
	},
	notificationsWithSubscribers: [
		{
			notification: {
				notificationType: 'ACTUAL',
				comparisonOperator: 'GREATER_THAN',
				threshold: 80,
			},
			subscribers: [
				{
					subscriptionType: 'EMAIL',
					address: 'alerts@macro-ai.com',
				},
			],
		},
	],
})
```

## 🔍 Monitoring & Alerting Implementation

### CloudWatch Dashboard

```typescript
// lib/constructs/monitoring/dashboard.ts
export class MonitoringDashboard extends Construct {
	constructor(scope: Construct, id: string, props: MonitoringProps) {
		super(scope, id)

		const dashboard = new cloudwatch.Dashboard(this, 'MacroAiDashboard', {
			dashboardName: `macro-ai-${props.environment}`,
		})

		// API Performance Metrics
		dashboard.addWidgets(
			new cloudwatch.GraphWidget({
				title: 'API Response Time',
				left: [props.apiService.metricResponseTime()],
				right: [props.apiService.metricRequestCount()],
			}),

			new cloudwatch.GraphWidget({
				title: 'Error Rate',
				left: [props.apiService.metricErrorRate()],
			}),

			new cloudwatch.GraphWidget({
				title: 'Database Performance',
				left: [
					props.database.metricCPUUtilization(),
					props.database.metricDatabaseConnections(),
				],
			}),

			new cloudwatch.GraphWidget({
				title: 'Cache Performance',
				left: [
					props.cache.metricCacheHitRate(),
					props.cache.metricCPUUtilization(),
				],
			}),
		)
	}
}
```

### Critical Alerts

```typescript
// lib/constructs/monitoring/alarms.ts
export class CriticalAlarms extends Construct {
	constructor(scope: Construct, id: string, props: AlarmProps) {
		super(scope, id)

		// High Error Rate Alarm
		new cloudwatch.Alarm(this, 'HighErrorRate', {
			metric: props.apiService.metricErrorRate(),
			threshold: 5, // 5% error rate
			evaluationPeriods: 2,
			datapointsToAlarm: 2,
			treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
		}).addAlarmAction(new cloudwatchActions.SnsAction(props.alertTopic))

		// High Response Time Alarm
		new cloudwatch.Alarm(this, 'HighResponseTime', {
			metric: props.apiService.metricResponseTime({
				statistic: 'Average',
			}),
			threshold: 2000, // 2 seconds
			evaluationPeriods: 3,
			datapointsToAlarm: 2,
		}).addAlarmAction(new cloudwatchActions.SnsAction(props.alertTopic))

		// Database CPU Alarm
		new cloudwatch.Alarm(this, 'DatabaseHighCPU', {
			metric: props.database.metricCPUUtilization(),
			threshold: 80, // 80% CPU
			evaluationPeriods: 2,
			datapointsToAlarm: 2,
		}).addAlarmAction(new cloudwatchActions.SnsAction(props.alertTopic))

		// Low Cache Hit Rate
		new cloudwatch.Alarm(this, 'LowCacheHitRate', {
			metric: props.cache.metricCacheHitRate(),
			threshold: 70, // 70% hit rate
			evaluationPeriods: 3,
			datapointsToAlarm: 2,
			comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
		}).addAlarmAction(new cloudwatchActions.SnsAction(props.alertTopic))
	}
}
```

---

## 📋 Implementation Checklist

### Phase 1: Infrastructure Foundation ✅ READY

- [ ] Create AWS CDK project structure
- [ ] Implement VPC and networking constructs
- [ ] Set up RDS PostgreSQL with pgvector
- [ ] Configure ElastiCache Redis cluster
- [ ] Create S3 buckets for assets and logs
- [ ] Set up IAM roles and security groups
- [ ] Deploy development environment

### Phase 2: Container Platform ⚠️ DEPENDENCIES

- [ ] Create optimized Dockerfiles
- [ ] Set up ECR repositories
- [ ] Implement ECS Fargate constructs
- [ ] Configure Application Load Balancer
- [ ] Set up CloudFront distribution
- [ ] Test container deployments

### Phase 3: CI/CD Pipeline 📋 PLANNED

- [ ] Implement GitHub Actions workflows
- [ ] Set up automated testing pipeline
- [ ] Configure security scanning
- [ ] Create deployment scripts
- [ ] Test multi-environment deployments
- [ ] Implement rollback procedures

### Phase 4: Monitoring & Security 📋 PLANNED

- [ ] Set up CloudWatch dashboards
- [ ] Configure critical alerts
- [ ] Implement AWS Secrets Manager
- [ ] Set up WAF and security headers
- [ ] Configure backup strategies
- [ ] Implement disaster recovery

### Phase 5: Production Deployment 📋 PLANNED

- [ ] Deploy production environment
- [ ] Configure custom domain and SSL
- [ ] Run load testing and optimization
- [ ] Complete security audit
- [ ] Execute go-live checklist
- [ ] Monitor and optimize performance

---

**Next Steps**: Review and approve this deployment plan, then proceed with Phase 1 implementation.

**Estimated Timeline**: 5-6 weeks for complete implementation
**Estimated Cost**: $150-800/month depending on usage
**Risk Level**: Medium (well-architected with proven patterns)

**Key Success Metrics**:

- API Response Time: <200ms (95th percentile)
- Page Load Time: <2 seconds
- Uptime: >99.9%
- Cost per User: <$2/month at scale
- Security Score: 100% (AWS Config Rules)
