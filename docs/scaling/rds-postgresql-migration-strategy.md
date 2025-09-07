# RDS PostgreSQL Migration Strategy

## Overview

This document outlines a comprehensive migration strategy from Neon PostgreSQL to Amazon RDS PostgreSQL for high-traffic
scenarios. The migration is designed to be zero-downtime, secure, and maintain data integrity throughout the process.

## Migration Triggers

### When to Consider RDS Migration

1. **Storage Requirements**: > 10TB (Neon's current limit)
2. **Performance Requirements**: > 128 vCPU, > 128GB RAM
3. **Compliance Requirements**: Specific compliance needs (SOC 2, HIPAA, etc.)
4. **Cost Optimization**: Significant cost savings at scale
5. **Integration Requirements**: Better AWS service integration
6. **High Availability**: Multi-AZ deployment requirements
7. **Backup Requirements**: Long-term backup retention needs

### Cost Analysis

#### Neon vs RDS Cost Comparison

```yaml
# Example: High-traffic production workload
# 100GB storage, 8 vCPU, 32GB RAM, 24/7 operation

neon_scale_plan:
  monthly_cost: $69
  compute_hours: 1000
  storage_gb: 100
  additional_costs:
    - overage_charges: variable
    - backup_storage: $0.10/GB/month
    - data_transfer: $0.09/GB

rds_equivalent:
  instance_type: db.r6g.xlarge
  monthly_cost: $350-450
  storage_gb: 100
  additional_costs:
    - backup_storage: $0.095/GB/month
    - data_transfer: $0.09/GB
    - multi_az: +100% cost
    - provisioned_iops: $0.20/IOPS/month

# Break-even analysis
break_even_point: 500GB_storage_8_vCPU
cost_advantage_rds: 1000GB+_storage
```

## Pre-Migration Assessment

### Current State Analysis

#### Database Metrics Collection

```sql
-- Collect current database statistics
SELECT
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation,
  most_common_vals,
  most_common_freqs
FROM pg_stats
WHERE schemaname = 'public'
ORDER BY tablename, attname;

-- Table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_tup_read DESC;
```

#### Application Usage Patterns

```typescript
// Collect application metrics
interface DatabaseMetrics {
	connectionCount: number
	queryDuration: {
		p50: number
		p95: number
		p99: number
	}
	transactionRate: number
	errorRate: number
	connectionPoolUtilization: number
}

// Monitor for 30 days before migration
const metrics = await collectDatabaseMetrics({
	duration: '30d',
	granularity: '1h',
})
```

### Migration Readiness Checklist

- [ ] **Data Assessment**: Complete database size and growth analysis
- [ ] **Performance Baseline**: Establish current performance metrics
- [ ] **Dependency Mapping**: Identify all applications and services
- [ ] **Backup Strategy**: Verify current backup and recovery procedures
- [ ] **Network Planning**: Design VPC and security group configuration
- [ ] **Monitoring Setup**: Prepare RDS monitoring and alerting
- [ ] **Team Training**: Train team on RDS management and troubleshooting
- [ ] **Rollback Plan**: Prepare rollback procedures and testing

## RDS Architecture Design

### Multi-Environment Setup

```yaml
# RDS instances for different environments
environments:
  development:
    instance_class: db.t3.micro
    storage: 20
    multi_az: false
    backup_retention: 7
    monitoring_interval: 0

  staging:
    instance_class: db.t3.small
    storage: 100
    multi_az: false
    backup_retention: 14
    monitoring_interval: 0

  production:
    instance_class: db.r6g.xlarge
    storage: 1000
    multi_az: true
    backup_retention: 30
    monitoring_interval: 60
    performance_insights: true
    enhanced_monitoring: true
```

### Network Architecture

```yaml
# VPC and networking configuration
vpc_configuration:
  vpc_cidr: 10.0.0.0/16

  subnets:
    private_subnet_1:
      cidr: 10.0.1.0/24
      az: us-east-1a
    private_subnet_2:
      cidr: 10.0.2.0/24
      az: us-east-1b
    private_subnet_3:
      cidr: 10.0.3.0/24
      az: us-east-1c

  security_groups:
    rds_security_group:
      ingress:
        - port: 5432
          protocol: tcp
          source: ecs_security_group
        - port: 5432
          protocol: tcp
          source: lambda_security_group
      egress:
        - port: 5432
          protocol: tcp
          destination: 0.0.0.0/0
```

### Security Configuration

```yaml
# RDS security settings
security_configuration:
  encryption:
    storage_encrypted: true
    kms_key_id: alias/aws/rds

  network:
    vpc_security_group_ids: [sg-rds-xxxxxxxxx]
    db_subnet_group_name: macro-ai-db-subnet-group
    publicly_accessible: false

  access_control:
    master_username: postgres
    master_password: 'managed_by_secrets_manager'
    parameter_group: macro-ai-postgres-15

  monitoring:
    performance_insights: true
    enhanced_monitoring: true
    log_exports:
      - postgresql
      - upgrade
```

## Migration Strategy

### Phase 1: Preparation and Setup

#### 1.1 RDS Infrastructure Provisioning

```typescript
// CDK construct for RDS setup
export class RdsPostgresConstruct extends Construct {
	public readonly rdsInstance: rds.DatabaseInstance
	public readonly rdsProxy: rds.DatabaseProxy

	constructor(scope: Construct, id: string, props: RdsPostgresConstructProps) {
		super(scope, id)

		// Create RDS instance
		this.rdsInstance = new rds.DatabaseInstance(this, 'PostgresInstance', {
			engine: rds.DatabaseInstanceEngine.postgres({
				version: rds.PostgresEngineVersion.VER_15_4,
			}),
			instanceType: ec2.InstanceType.of(
				ec2.InstanceClass.R6G,
				ec2.InstanceSize.XLARGE,
			),
			allocatedStorage: 1000,
			maxAllocatedStorage: 10000,
			storageType: rds.StorageType.GP3,
			storageEncrypted: true,

			// High availability
			multiAz: true,
			backupRetention: cdk.Duration.days(30),
			backupWindow: '03:00-04:00',
			maintenanceWindow: 'sun:04:00-sun:05:00',

			// Performance
			performanceInsightsRetention: rds.PerformanceInsightsRetention.LONG_TERM,
			enablePerformanceInsights: true,
			monitoringInterval: cdk.Duration.seconds(60),

			// Security
			vpc: props.vpc,
			vpcSubnets: {
				subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
			},
			securityGroups: [props.securityGroup],

			// Database configuration
			databaseName: 'macro_ai',
			credentials: rds.Credentials.fromSecret(props.secret),
			parameterGroup: props.parameterGroup,

			// Monitoring
			cloudwatchLogsExports: ['postgresql', 'upgrade'],
			deletionProtection: true,
			deleteAutomatedBackups: false,
		})

		// Create RDS Proxy for connection pooling
		this.rdsProxy = new rds.DatabaseProxy(this, 'PostgresProxy', {
			proxyTarget: rds.ProxyTarget.fromInstance(this.rdsInstance),
			secrets: [props.secret],
			vpc: props.vpc,
			securityGroups: [props.securityGroup],
			maxConnectionsPercent: 100,
			maxIdleConnectionsPercent: 50,
			requireTLS: true,
		})
	}
}
```

#### 1.2 Database Schema Preparation

```sql
-- Create database schema on RDS
CREATE DATABASE macro_ai;
\c macro_ai;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS audit;

-- Set search path
ALTER DATABASE macro_ai SET search_path TO public, analytics, audit;
```

#### 1.3 Connection Pooling Setup

```typescript
// PgBouncer configuration for RDS
const pgbouncerConfig = {
	// PgBouncer settings
	max_connections: 200,
	default_pool_size: 25,
	min_pool_size: 5,
	reserve_pool_size: 5,
	reserve_pool_timeout: 3,

	// Connection settings
	server_round_robin: 1,
	ignore_startup_parameters: 'extra_float_digits',

	// Logging
	log_connections: 1,
	log_disconnections: 1,
	log_pooler_errors: 1,

	// Authentication
	auth_type: 'md5',
	auth_file: '/etc/pgbouncer/userlist.txt',

	// Database settings
	databases: {
		macro_ai: {
			host: 'macro-ai-postgres.cluster-xyz.us-east-1.rds.amazonaws.com',
			port: 5432,
			dbname: 'macro_ai',
			pool_size: 25,
			max_connections: 100,
		},
	},
}
```

### Phase 2: Data Migration

#### 2.1 Initial Data Export

```bash
#!/bin/bash
# Export data from Neon

# Set environment variables
NEON_HOST="ep-xyz.us-east-1.aws.neon.tech"
NEON_DB="macro_ai"
NEON_USER="postgres"
RDS_HOST="macro-ai-postgres.cluster-xyz.us-east-1.rds.amazonaws.com"
RDS_DB="macro_ai"
RDS_USER="postgres"

# Export schema
pg_dump -h $NEON_HOST -U $NEON_USER -d $NEON_DB \
  --schema-only --no-owner --no-privileges \
  -f schema.sql

# Export data
pg_dump -h $NEON_HOST -U $NEON_USER -d $NEON_DB \
  --data-only --no-owner --no-privileges \
  -f data.sql

# Export specific tables (for large databases)
for table in users sessions analytics events; do
  pg_dump -h $NEON_HOST -U $NEON_USER -d $NEON_DB \
    --table=$table --data-only --no-owner --no-privileges \
    -f ${table}_data.sql
done
```

#### 2.2 Data Import to RDS

```bash
#!/bin/bash
# Import data to RDS

# Import schema
psql -h $RDS_HOST -U $RDS_USER -d $RDS_DB -f schema.sql

# Import data
psql -h $RDS_HOST -U $RDS_USER -d $RDS_DB -f data.sql

# Import specific tables
for table in users sessions analytics events; do
  psql -h $RDS_HOST -U $RDS_USER -d $RDS_DB -f ${table}_data.sql
done

# Update sequences
psql -h $RDS_HOST -U $RDS_USER -d $RDS_DB -c "
  SELECT setval(pg_get_serial_sequence('users', 'id'),
                COALESCE(MAX(id), 1)) FROM users;
  SELECT setval(pg_get_serial_sequence('sessions', 'id'),
                COALESCE(MAX(id), 1)) FROM sessions;
"
```

#### 2.3 Data Validation

```sql
-- Validate data integrity
-- Compare row counts
SELECT
  'users' as table_name,
  (SELECT COUNT(*) FROM neon_users) as neon_count,
  (SELECT COUNT(*) FROM rds_users) as rds_count,
  (SELECT COUNT(*) FROM neon_users) - (SELECT COUNT(*) FROM rds_users) as difference
UNION ALL
SELECT
  'sessions' as table_name,
  (SELECT COUNT(*) FROM neon_sessions) as neon_count,
  (SELECT COUNT(*) FROM rds_sessions) as rds_count,
  (SELECT COUNT(*) FROM neon_sessions) - (SELECT COUNT(*) FROM rds_sessions) as difference;

-- Validate data consistency
SELECT
  'users' as table_name,
  COUNT(*) as total_rows,
  COUNT(DISTINCT id) as unique_ids,
  COUNT(DISTINCT email) as unique_emails
FROM users
UNION ALL
SELECT
  'sessions' as table_name,
  COUNT(*) as total_rows,
  COUNT(DISTINCT id) as unique_ids,
  COUNT(DISTINCT user_id) as unique_users
FROM sessions;

-- Check for data corruption
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
```

### Phase 3: Application Migration

#### 3.1 Connection String Updates

```typescript
// Environment-specific connection configuration
interface DatabaseConfig {
	host: string
	port: number
	database: string
	username: string
	password: string
	ssl: boolean
	pool: {
		min: number
		max: number
		acquireTimeoutMillis: number
		idleTimeoutMillis: number
	}
}

// Development environment
const devConfig: DatabaseConfig = {
	host: process.env.DEV_DB_HOST || 'localhost',
	port: parseInt(process.env.DEV_DB_PORT || '5432'),
	database: process.env.DEV_DB_NAME || 'macro_ai_dev',
	username: process.env.DEV_DB_USER || 'postgres',
	password: process.env.DEV_DB_PASSWORD || 'password',
	ssl: false,
	pool: {
		min: 2,
		max: 10,
		acquireTimeoutMillis: 60000,
		idleTimeoutMillis: 300000,
	},
}

// Production environment
const prodConfig: DatabaseConfig = {
	host:
		process.env.PROD_DB_HOST ||
		'macro-ai-postgres.cluster-xyz.us-east-1.rds.amazonaws.com',
	port: parseInt(process.env.PROD_DB_PORT || '5432'),
	database: process.env.PROD_DB_NAME || 'macro_ai',
	username: process.env.PROD_DB_USER || 'postgres',
	password: process.env.PROD_DB_PASSWORD || 'managed_by_secrets_manager',
	ssl: true,
	pool: {
		min: 5,
		max: 50,
		acquireTimeoutMillis: 60000,
		idleTimeoutMillis: 300000,
	},
}
```

#### 3.2 Gradual Traffic Migration

```typescript
// Feature flag for database migration
class DatabaseMigrationManager {
	private useRds: boolean = false
	private migrationPercentage: number = 0

	constructor() {
		this.useRds = process.env.USE_RDS === 'true'
		this.migrationPercentage = parseInt(process.env.MIGRATION_PERCENTAGE || '0')
	}

	async getDatabaseConnection(userId: string): Promise<DatabaseConnection> {
		// Use RDS for a percentage of users
		if (this.useRds && this.shouldUseRds(userId)) {
			return this.getRdsConnection()
		}

		// Use Neon for remaining users
		return this.getNeonConnection()
	}

	private shouldUseRds(userId: string): boolean {
		// Use consistent hashing to determine which users go to RDS
		const hash = this.hash(userId)
		return hash % 100 < this.migrationPercentage
	}

	private hash(str: string): number {
		let hash = 0
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i)
			hash = (hash << 5) - hash + char
			hash = hash & hash // Convert to 32-bit integer
		}
		return Math.abs(hash)
	}
}
```

#### 3.3 Data Synchronization

```typescript
// Real-time data synchronization between Neon and RDS
class DatabaseSynchronizer {
	private neonClient: DatabaseConnection
	private rdsClient: DatabaseConnection
	private syncQueue: SyncOperation[] = []

	constructor(neonClient: DatabaseConnection, rdsClient: DatabaseConnection) {
		this.neonClient = neonClient
		this.rdsClient = rdsClient
	}

	async syncData(operation: SyncOperation): Promise<void> {
		try {
			// Apply operation to both databases
			await this.applyOperation(this.neonClient, operation)
			await this.applyOperation(this.rdsClient, operation)

			console.log(`Successfully synced operation: ${operation.id}`)
		} catch (error) {
			console.error(`Failed to sync operation: ${operation.id}`, error)

			// Queue for retry
			this.syncQueue.push(operation)
		}
	}

	private async applyOperation(
		client: DatabaseConnection,
		operation: SyncOperation,
	): Promise<void> {
		switch (operation.type) {
			case 'INSERT':
				await client.query(operation.sql, operation.params)
				break
			case 'UPDATE':
				await client.query(operation.sql, operation.params)
				break
			case 'DELETE':
				await client.query(operation.sql, operation.params)
				break
			default:
				throw new Error(`Unknown operation type: ${operation.type}`)
		}
	}
}
```

### Phase 4: Cutover and Validation

#### 4.1 Final Data Sync

```bash
#!/bin/bash
# Final data synchronization before cutover

# Create a snapshot of current Neon state
pg_dump -h $NEON_HOST -U $NEON_USER -d $NEON_DB \
  --data-only --no-owner --no-privileges \
  -f final_sync.sql

# Apply incremental changes to RDS
psql -h $RDS_HOST -U $RDS_USER -d $RDS_DB -f final_sync.sql

# Verify data consistency
psql -h $RDS_HOST -U $RDS_USER -d $RDS_DB -c "
  SELECT
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes
  FROM pg_stat_user_tables
  ORDER BY schemaname, tablename;
"
```

#### 4.2 Application Cutover

```typescript
// Zero-downtime cutover process
class DatabaseCutover {
	private neonClient: DatabaseConnection
	private rdsClient: DatabaseConnection
	private isCutoverComplete: boolean = false

	async performCutover(): Promise<void> {
		try {
			// 1. Stop accepting new connections to Neon
			await this.stopNeonConnections()

			// 2. Wait for existing connections to complete
			await this.waitForNeonConnections()

			// 3. Apply final data sync
			await this.finalDataSync()

			// 4. Switch application to RDS
			await this.switchToRds()

			// 5. Verify application functionality
			await this.verifyApplication()

			// 6. Mark cutover as complete
			this.isCutoverComplete = true

			console.log('Database cutover completed successfully')
		} catch (error) {
			console.error('Database cutover failed:', error)
			await this.rollbackCutover()
			throw error
		}
	}

	private async stopNeonConnections(): Promise<void> {
		// Update load balancer to stop routing to Neon
		await this.updateLoadBalancer('rds')
	}

	private async waitForNeonConnections(): Promise<void> {
		// Wait for existing connections to complete
		const maxWaitTime = 300000 // 5 minutes
		const startTime = Date.now()

		while (Date.now() - startTime < maxWaitTime) {
			const activeConnections = await this.getActiveConnections('neon')
			if (activeConnections === 0) {
				break
			}

			await this.sleep(1000) // Wait 1 second
		}
	}

	private async switchToRds(): Promise<void> {
		// Update application configuration to use RDS
		await this.updateApplicationConfig('rds')

		// Update connection strings
		await this.updateConnectionStrings('rds')
	}

	private async verifyApplication(): Promise<void> {
		// Run health checks
		const healthChecks = [
			this.checkDatabaseConnectivity(),
			this.checkApplicationEndpoints(),
			this.checkDataIntegrity(),
			this.checkPerformanceMetrics(),
		]

		const results = await Promise.all(healthChecks)

		if (results.some((result) => !result.success)) {
			throw new Error('Application verification failed')
		}
	}
}
```

#### 4.3 Rollback Procedures

```typescript
// Rollback procedures in case of issues
class DatabaseRollback {
	private neonClient: DatabaseConnection
	private rdsClient: DatabaseConnection

	async rollbackCutover(): Promise<void> {
		try {
			// 1. Switch application back to Neon
			await this.switchToNeon()

			// 2. Verify application functionality
			await this.verifyApplication()

			// 3. Notify team of rollback
			await this.notifyTeam('rollback')

			console.log('Database rollback completed successfully')
		} catch (error) {
			console.error('Database rollback failed:', error)
			throw error
		}
	}

	private async switchToNeon(): Promise<void> {
		// Update application configuration to use Neon
		await this.updateApplicationConfig('neon')

		// Update connection strings
		await this.updateConnectionStrings('neon')
	}
}
```

## Post-Migration Optimization

### Performance Tuning

#### 1. Query Optimization

```sql
-- Analyze query performance
SELECT
  query,
  calls,
  total_time,
  mean_time,
  stddev_time,
  rows,
  100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 20;

-- Create missing indexes
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_sessions_user_id ON sessions(user_id);
CREATE INDEX CONCURRENTLY idx_analytics_created_at ON analytics(created_at);

-- Update table statistics
ANALYZE users;
ANALYZE sessions;
ANALYZE analytics;
```

#### 2. Connection Pooling Optimization

```typescript
// Optimize connection pooling for RDS
const optimizedPoolConfig = {
	// PgBouncer settings
	max_connections: 200,
	default_pool_size: 25,
	min_pool_size: 5,
	reserve_pool_size: 5,
	reserve_pool_timeout: 3,

	// RDS-specific optimizations
	server_round_robin: 1,
	ignore_startup_parameters: 'extra_float_digits',

	// Connection management
	pool_mode: 'transaction',
	max_client_conn: 1000,
	default_pool_size: 25,

	// Logging and monitoring
	log_connections: 1,
	log_disconnections: 1,
	log_pooler_errors: 1,
	stats_period: 60,
}
```

#### 3. Monitoring and Alerting

```yaml
# CloudWatch alarms for RDS
rds_alarms:
  - name: 'RDS-CPU-Utilization'
    metric: 'CPUUtilization'
    threshold: 80
    comparison: 'GreaterThanThreshold'
    period: 300
    evaluation_periods: 2

  - name: 'RDS-Database-Connections'
    metric: 'DatabaseConnections'
    threshold: 180
    comparison: 'GreaterThanThreshold'
    period: 300
    evaluation_periods: 2

  - name: 'RDS-Freeable-Memory'
    metric: 'FreeableMemory'
    threshold: 1000000000
    comparison: 'LessThanThreshold'
    period: 300
    evaluation_periods: 2

  - name: 'RDS-Free-Storage-Space'
    metric: 'FreeStorageSpace'
    threshold: 2000000000
    comparison: 'LessThanThreshold'
    period: 300
    evaluation_periods: 2
```

### Backup and Recovery

#### 1. Automated Backups

```yaml
# RDS backup configuration
backup_configuration:
  backup_retention_period: 30
  backup_window: '03:00-04:00'
  maintenance_window: 'sun:04:00-sun:05:00'

  # Point-in-time recovery
  point_in_time_recovery: true

  # Cross-region backups
  cross_region_backup: true
  cross_region_backup_retention: 7

  # Automated snapshots
  automated_snapshots: true
  snapshot_retention: 7
```

#### 2. Disaster Recovery Procedures

```bash
#!/bin/bash
# RDS disaster recovery procedures

# 1. Create recovery instance
aws rds create-db-instance \
  --db-instance-identifier macro-ai-recovery-$(date +%Y%m%d) \
  --db-instance-class db.r6g.xlarge \
  --engine postgres \
  --engine-version 15.4 \
  --allocated-storage 1000 \
  --storage-type gp3 \
  --db-name macro_ai \
  --master-username postgres \
  --master-user-password "recovery-password" \
  --vpc-security-group-ids sg-xxxxxxxxx \
  --db-subnet-group-name macro-ai-db-subnet-group \
  --backup-retention-period 30 \
  --multi-az \
  --storage-encrypted \
  --kms-key-id alias/aws/rds

# 2. Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier macro-ai-recovery-$(date +%Y%m%d) \
  --db-snapshot-identifier macro-ai-snapshot-$(date +%Y%m%d) \
  --db-instance-class db.r6g.xlarge

# 3. Update application configuration
# Update connection strings to point to recovery instance

# 4. Verify data integrity
psql -h macro-ai-recovery-$(date +%Y%m%d).cluster-xyz.us-east-1.rds.amazonaws.com \
  -U postgres -d macro_ai -c "SELECT COUNT(*) FROM users;"
```

## Cost Optimization

### Right-Sizing Strategy

```yaml
# RDS instance right-sizing
right_sizing_strategy:
  # Monitor for 30 days
  monitoring_period: 30_days

  # Metrics to track
  metrics:
    - cpu_utilization
    - memory_utilization
    - database_connections
    - read_iops
    - write_iops
    - storage_utilization

  # Right-sizing thresholds
  thresholds:
    cpu_utilization:
      underutilized: < 20%
      overutilized: > 80%
    memory_utilization:
      underutilized: < 20%
      overutilized: > 80%
    database_connections:
      underutilized: < 20%
      overutilized: > 80%

  # Recommended actions
  actions:
    underutilized: "Consider smaller instance class"
    overutilized: "Consider larger instance class"
    optimal: "Current instance class is appropriate"
```

### Storage Optimization

```sql
-- Storage optimization queries
-- Identify large tables
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Identify unused indexes
SELECT
  schemaname,
  tablename,
  indexname,
  idx_tup_read,
  idx_tup_fetch,
  idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY schemaname, tablename, indexname;

-- Identify duplicate indexes
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY schemaname, tablename, indexname;
```

## Monitoring and Maintenance

### Performance Monitoring

```typescript
// RDS performance monitoring
class RdsPerformanceMonitor {
	private cloudWatch: CloudWatchClient

	async getPerformanceMetrics(): Promise<PerformanceMetrics> {
		const metrics = await this.cloudWatch.getMetricStatistics({
			Namespace: 'AWS/RDS',
			MetricName: 'CPUUtilization',
			Dimensions: [
				{
					Name: 'DBInstanceIdentifier',
					Value: 'macro-ai-postgres',
				},
			],
			StartTime: new Date(Date.now() - 3600000), // 1 hour ago
			EndTime: new Date(),
			Period: 300, // 5 minutes
			Statistics: ['Average', 'Maximum'],
		})

		return {
			cpuUtilization: metrics.Datapoints,
			memoryUtilization: await this.getMemoryUtilization(),
			connectionCount: await this.getConnectionCount(),
			storageUtilization: await this.getStorageUtilization(),
		}
	}

	async getSlowQueries(): Promise<SlowQuery[]> {
		// Query pg_stat_statements for slow queries
		const result = await this.query(`
      SELECT 
        query,
        calls,
        total_time,
        mean_time,
        stddev_time,
        rows
      FROM pg_stat_statements
      WHERE mean_time > 1000
      ORDER BY mean_time DESC
      LIMIT 20
    `)

		return result.rows
	}
}
```

### Maintenance Procedures

```yaml
# RDS maintenance procedures
maintenance_procedures:
  # Weekly maintenance
  weekly:
    - update_statistics
    - vacuum_analyze
    - check_disk_space
    - review_slow_queries
    - check_backup_status

  # Monthly maintenance
  monthly:
    - review_performance_metrics
    - optimize_indexes
    - check_security_updates
    - review_cost_optimization
    - test_disaster_recovery

  # Quarterly maintenance
  quarterly:
    - comprehensive_performance_review
    - security_audit
    - capacity_planning
    - disaster_recovery_test
    - documentation_update
```

## Conclusion

This comprehensive RDS migration strategy provides a clear path for migrating from Neon PostgreSQL to Amazon RDS PostgreSQL
while maintaining zero downtime and data integrity. The phased approach ensures a smooth transition with proper validation
and rollback procedures.

### Key Success Factors

1. **Thorough Planning**: Complete assessment and preparation before migration
2. **Gradual Migration**: Phased approach with feature flags and gradual traffic migration
3. **Data Integrity**: Comprehensive validation and synchronization procedures
4. **Monitoring**: Continuous monitoring and alerting throughout the process
5. **Rollback Plan**: Clear rollback procedures in case of issues
6. **Post-Migration Optimization**: Performance tuning and cost optimization after migration

### Next Steps

1. **Complete Assessment**: Finish current state analysis and requirements gathering
2. **Infrastructure Setup**: Provision RDS infrastructure and configure networking
3. **Migration Testing**: Test migration procedures in staging environment
4. **Production Migration**: Execute migration with proper monitoring and rollback procedures
5. **Post-Migration Optimization**: Tune performance and optimize costs
