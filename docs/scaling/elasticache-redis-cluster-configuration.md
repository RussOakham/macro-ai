# ElastiCache Redis Cluster Configuration

## Overview

This document outlines a comprehensive ElastiCache Redis cluster configuration strategy for scaling the Macro AI application.
It covers cluster design, migration from Upstash, performance optimization, and operational procedures.

## Migration Triggers

### When to Consider ElastiCache Migration

1. **Performance Requirements**: Sub-millisecond latency requirements
2. **Cost Optimization**: Significant cost savings at scale (>1M requests/month)
3. **Integration Requirements**: Better AWS service integration
4. **Compliance Requirements**: Specific compliance needs (SOC 2, HIPAA, etc.)
5. **High Availability**: Multi-AZ deployment requirements
6. **Advanced Features**: Redis modules and advanced data structures
7. **Operational Control**: Full control over Redis configuration and maintenance

### Cost Analysis

#### Upstash vs ElastiCache Cost Comparison

```yaml
# Example: High-traffic production workload
# 10M requests/month, 2GB memory, 1GB storage

upstash_pay_as_you_go:
  monthly_requests: 10_000_000
  monthly_memory: 2_GB
  monthly_storage: 1_GB

  cost_calculation:
    requests_cost: $20.00 # 10M * $0.2/100K
    memory_cost: $0.40 # 2GB * $0.2/GB
    storage_cost: $0.20 # 1GB * $0.2/GB
    total_monthly: $20.60

elasticache_equivalent:
  instance_type: cache.r6g.large
  monthly_cost: $150-200
  memory: 12.93_GB
  additional_costs:
    - backup_storage: $0.095/GB/month
    - data_transfer: $0.09/GB
    - multi_az: +100% cost
    - provisioned_iops: $0.20/IOPS/month

# Break-even analysis
break_even_point: 50M_requests_monthly
cost_advantage_elasticache: 100M+_requests_monthly
```

## ElastiCache Architecture Design

### Multi-Environment Setup

```yaml
# ElastiCache clusters for different environments
environments:
  development:
    cluster_mode: disabled
    node_type: cache.t3.micro
    num_cache_nodes: 1
    multi_az: false
    backup_retention: 0
    snapshot_retention: 0

  staging:
    cluster_mode: disabled
    node_type: cache.t3.small
    num_cache_nodes: 1
    multi_az: false
    backup_retention: 1
    snapshot_retention: 1

  production:
    cluster_mode: enabled
    node_type: cache.r6g.large
    num_cache_nodes: 3
    multi_az: true
    backup_retention: 7
    snapshot_retention: 7
    automatic_failover: true
    at_rest_encryption: true
    transit_encryption: true
```

### Cluster Configuration

#### Single-Node Configuration (Development/Staging)

```yaml
# Single-node Redis for development and staging
single_node_config:
  engine: redis
  engine_version: '7.0'
  node_type: cache.t3.small
  num_cache_nodes: 1

  # Performance
  parameter_group: default.redis7
  maintenance_window: 'sun:05:00-sun:06:00'

  # Security
  vpc_security_group_ids: [sg-xxxxxxxxx]
  subnet_group_name: macro-ai-cache-subnet-group
  at_rest_encryption: true
  transit_encryption: true
  auth_token: 'managed_by_secrets_manager'

  # Monitoring
  notification_topic_arn: 'arn:aws:sns:us-east-1:123456789012:macro-ai-cache-alerts'
```

#### Cluster Mode Configuration (Production)

```yaml
# Redis cluster for production
cluster_config:
  engine: redis
  engine_version: '7.0'
  node_type: cache.r6g.large
  num_cache_nodes: 3

  # High availability
  multi_az: true
  automatic_failover: true
  backup_retention: 7
  snapshot_retention: 7
  snapshot_window: '03:00-05:00'

  # Performance
  parameter_group: default.redis7
  maintenance_window: 'sun:05:00-sun:06:00'

  # Security
  vpc_security_group_ids: [sg-xxxxxxxxx]
  subnet_group_name: macro-ai-cache-subnet-group
  at_rest_encryption: true
  transit_encryption: true
  auth_token: 'managed_by_secrets_manager'

  # Monitoring
  notification_topic_arn: 'arn:aws:sns:us-east-1:123456789012:macro-ai-cache-alerts'
  log_delivery_configurations:
    - log_type: 'slow-log'
      destination_type: 'cloudwatch-logs'
      destination_details:
        log_group: '/aws/elasticache/redis/slow-log'
    - log_type: 'engine-log'
      destination_type: 'cloudwatch-logs'
      destination_details:
        log_group: '/aws/elasticache/redis/engine-log'
```

## CDK Implementation

### ElastiCache Construct

```typescript
// ElastiCache Redis cluster construct
export class ElastiCacheRedisConstruct extends Construct {
	public readonly redisCluster: elasticache.CfnCacheCluster
	public readonly redisReplicationGroup: elasticache.CfnReplicationGroup
	public readonly redisSubnetGroup: elasticache.CfnSubnetGroup
	public readonly redisParameterGroup: elasticache.CfnParameterGroup
	public readonly redisSecurityGroup: ec2.SecurityGroup

	constructor(
		scope: Construct,
		id: string,
		props: ElastiCacheRedisConstructProps,
	) {
		super(scope, id)

		const {
			environmentName,
			vpc,
			nodeType = 'cache.t3.small',
			numCacheNodes = 1,
			multiAz = false,
			backupRetention = 0,
			snapshotRetention = 0,
			enableClusterMode = false,
			enableEncryption = true,
			enableAuth = true,
		} = props

		// Create subnet group
		this.redisSubnetGroup = new elasticache.CfnSubnetGroup(
			this,
			'RedisSubnetGroup',
			{
				cacheSubnetGroupName: `${environmentName}-redis-subnet-group`,
				description: `Subnet group for ${environmentName} Redis cluster`,
				subnetIds: vpc.privateSubnets.map((subnet) => subnet.subnetId),
			},
		)

		// Create security group
		this.redisSecurityGroup = new ec2.SecurityGroup(
			this,
			'RedisSecurityGroup',
			{
				vpc,
				description: `Security group for ${environmentName} Redis cluster`,
				allowAllOutbound: false,
			},
		)

		// Allow inbound Redis traffic from ECS
		this.redisSecurityGroup.addIngressRule(
			ec2.Peer.securityGroupId(props.ecsSecurityGroup.securityGroupId),
			ec2.Port.tcp(6379),
			'Allow Redis access from ECS',
		)

		// Allow inbound Redis traffic from Lambda
		this.redisSecurityGroup.addIngressRule(
			ec2.Peer.securityGroupId(props.lambdaSecurityGroup.securityGroupId),
			ec2.Port.tcp(6379),
			'Allow Redis access from Lambda',
		)

		// Create parameter group
		this.redisParameterGroup = new elasticache.CfnParameterGroup(
			this,
			'RedisParameterGroup',
			{
				cacheParameterGroupFamily: 'redis7.x',
				description: `Parameter group for ${environmentName} Redis cluster`,
				properties: {
					'maxmemory-policy': 'allkeys-lru',
					timeout: '300',
					'tcp-keepalive': '60',
					'maxmemory-samples': '5',
					'lazyfree-lazy-eviction': 'yes',
					'lazyfree-lazy-expire': 'yes',
					'lazyfree-lazy-server-del': 'yes',
					'replica-lazy-flush': 'yes',
				},
			},
		)

		if (enableClusterMode) {
			// Create replication group for cluster mode
			this.redisReplicationGroup = new elasticache.CfnReplicationGroup(
				this,
				'RedisReplicationGroup',
				{
					replicationGroupId: `${environmentName}-redis-cluster`,
					description: `Redis cluster for ${environmentName}`,

					// Node configuration
					cacheNodeType: nodeType,
					numCacheClusters: numCacheNodes,

					// High availability
					multiAzEnabled: multiAz,
					automaticFailoverEnabled: multiAz,

					// Backup configuration
					snapshotRetentionLimit: snapshotRetention,
					snapshotWindow: '03:00-05:00',

					// Security
					atRestEncryptionEnabled: enableEncryption,
					transitEncryptionEnabled: enableEncryption,
					authToken: enableAuth ? 'managed_by_secrets_manager' : undefined,

					// Network configuration
					cacheSubnetGroupName: this.redisSubnetGroup.ref,
					securityGroupIds: [this.redisSecurityGroup.securityGroupId],

					// Parameter group
					cacheParameterGroupName: this.redisParameterGroup.ref,

					// Maintenance
					preferredMaintenanceWindow: 'sun:05:00-sun:06:00',

					// Monitoring
					notificationTopicArn: props.notificationTopicArn,

					// Logging
					logDeliveryConfigurations: [
						{
							logType: 'slow-log',
							destinationType: 'cloudwatch-logs',
							destinationDetails: {
								logGroup: `/aws/elasticache/redis/${environmentName}/slow-log`,
							},
						},
						{
							logType: 'engine-log',
							destinationType: 'cloudwatch-logs',
							destinationDetails: {
								logGroup: `/aws/elasticache/redis/${environmentName}/engine-log`,
							},
						},
					],
				},
			)
		} else {
			// Create single-node cluster
			this.redisCluster = new elasticache.CfnCacheCluster(
				this,
				'RedisCluster',
				{
					cacheClusterId: `${environmentName}-redis`,
					engine: 'redis',
					engineVersion: '7.0',
					cacheNodeType: nodeType,
					numCacheNodes: numCacheNodes,

					// Security
					atRestEncryptionEnabled: enableEncryption,
					transitEncryptionEnabled: enableEncryption,
					authToken: enableAuth ? 'managed_by_secrets_manager' : undefined,

					// Network configuration
					cacheSubnetGroupName: this.redisSubnetGroup.ref,
					vpcSecurityGroupIds: [this.redisSecurityGroup.securityGroupId],

					// Parameter group
					cacheParameterGroupName: this.redisParameterGroup.ref,

					// Maintenance
					preferredMaintenanceWindow: 'sun:05:00-sun:06:00',

					// Monitoring
					notificationTopicArn: props.notificationTopicArn,
				},
			)
		}
	}

	// Get Redis endpoint
	public getRedisEndpoint(): string {
		if (this.redisReplicationGroup) {
			return this.redisReplicationGroup.attrRedisEndpointAddress
		}
		return this.redisCluster.attrRedisEndpointAddress
	}

	// Get Redis port
	public getRedisPort(): string {
		if (this.redisReplicationGroup) {
			return this.redisReplicationGroup.attrRedisEndpointPort
		}
		return this.redisCluster.attrRedisEndpointPort
	}
}
```

### Integration with Application

```typescript
// Redis client configuration for ElastiCache
class ElastiCacheRedisClient {
	private client: Redis
	private clusterClient: RedisCluster

	constructor(config: ElastiCacheConfig) {
		if (config.clusterMode) {
			this.clusterClient = new RedisCluster({
				clusterNodes: config.clusterNodes,
				options: {
					password: config.authToken,
					tls: config.transitEncryption ? {} : undefined,
					retryDelayOnFailover: 100,
					retryDelayOnClusterDown: 300,
					maxRetriesPerRequest: 3,
					enableReadyCheck: false,
					redisOptions: {
						password: config.authToken,
						tls: config.transitEncryption ? {} : undefined,
					},
				},
			})
		} else {
			this.client = new Redis({
				host: config.host,
				port: config.port,
				password: config.authToken,
				tls: config.transitEncryption ? {} : undefined,
				retryDelayOnFailover: 100,
				maxRetriesPerRequest: 3,
				enableReadyCheck: false,
			})
		}
	}

	async get(key: string): Promise<string | null> {
		if (this.clusterClient) {
			return await this.clusterClient.get(key)
		}
		return await this.client.get(key)
	}

	async set(key: string, value: string, ttl?: number): Promise<void> {
		if (this.clusterClient) {
			if (ttl) {
				await this.clusterClient.setex(key, ttl, value)
			} else {
				await this.clusterClient.set(key, value)
			}
		} else {
			if (ttl) {
				await this.client.setex(key, ttl, value)
			} else {
				await this.client.set(key, value)
			}
		}
	}

	async del(key: string): Promise<number> {
		if (this.clusterClient) {
			return await this.clusterClient.del(key)
		}
		return await this.client.del(key)
	}

	async exists(key: string): Promise<boolean> {
		if (this.clusterClient) {
			return (await this.clusterClient.exists(key)) === 1
		}
		return (await this.client.exists(key)) === 1
	}

	async mget(keys: string[]): Promise<(string | null)[]> {
		if (this.clusterClient) {
			return await this.clusterClient.mget(...keys)
		}
		return await this.client.mget(...keys)
	}

	async mset(keyValues: Record<string, string>): Promise<void> {
		if (this.clusterClient) {
			await this.clusterClient.mset(keyValues)
		} else {
			await this.client.mset(keyValues)
		}
	}
}
```

## Migration Strategy

### Phase 1: Preparation and Setup

#### 1.1 ElastiCache Infrastructure Provisioning

```typescript
// CDK stack for ElastiCache
export class ElastiCacheStack extends cdk.Stack {
	public readonly redisCluster: ElastiCacheRedisConstruct

	constructor(scope: Construct, id: string, props: ElastiCacheStackProps) {
		super(scope, id, props)

		// Create ElastiCache cluster
		this.redisCluster = new ElastiCacheRedisConstruct(this, 'RedisCluster', {
			environmentName: props.environmentName,
			vpc: props.vpc,
			nodeType: props.nodeType,
			numCacheNodes: props.numCacheNodes,
			multiAz: props.multiAz,
			backupRetention: props.backupRetention,
			snapshotRetention: props.snapshotRetention,
			enableClusterMode: props.enableClusterMode,
			enableEncryption: props.enableEncryption,
			enableAuth: props.enableAuth,
			ecsSecurityGroup: props.ecsSecurityGroup,
			lambdaSecurityGroup: props.lambdaSecurityGroup,
			notificationTopicArn: props.notificationTopicArn,
		})

		// Output Redis endpoint
		new cdk.CfnOutput(this, 'RedisEndpoint', {
			value: this.redisCluster.getRedisEndpoint(),
			description: 'Redis cluster endpoint',
			exportName: `${props.environmentName}-redis-endpoint`,
		})

		new cdk.CfnOutput(this, 'RedisPort', {
			value: this.redisCluster.getRedisPort(),
			description: 'Redis cluster port',
			exportName: `${props.environmentName}-redis-port`,
		})
	}
}
```

#### 1.2 Data Migration from Upstash

```typescript
// Data migration from Upstash to ElastiCache
class RedisDataMigration {
	private upstashClient: Redis
	private elasticacheClient: ElastiCacheRedisClient

	constructor(
		upstashConfig: UpstashConfig,
		elasticacheConfig: ElastiCacheConfig,
	) {
		this.upstashClient = new Redis(upstashConfig)
		this.elasticacheClient = new ElastiCacheRedisClient(elasticacheConfig)
	}

	async migrateData(): Promise<void> {
		console.log('Starting Redis data migration...')

		// Get all keys from Upstash
		const keys = await this.getAllKeys()
		console.log(`Found ${keys.length} keys to migrate`)

		// Migrate keys in batches
		const batchSize = 100
		for (let i = 0; i < keys.length; i += batchSize) {
			const batch = keys.slice(i, i + batchSize)
			await this.migrateBatch(batch)
			console.log(
				`Migrated batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(keys.length / batchSize)}`,
			)
		}

		console.log('Redis data migration completed')
	}

	private async getAllKeys(): Promise<string[]> {
		// Use SCAN to get all keys (more memory efficient than KEYS *)
		const keys: string[] = []
		let cursor = '0'

		do {
			const result = await this.upstashClient.scan(cursor, {
				match: '*',
				count: 1000,
			})

			cursor = result.cursor
			keys.push(...result.keys)
		} while (cursor !== '0')

		return keys
	}

	private async migrateBatch(keys: string[]): Promise<void> {
		// Get values for all keys in batch
		const values = await this.upstashClient.mget(...keys)

		// Set values in ElastiCache
		const keyValues: Record<string, string> = {}
		keys.forEach((key, index) => {
			if (values[index] !== null) {
				keyValues[key] = values[index]!
			}
		})

		if (Object.keys(keyValues).length > 0) {
			await this.elasticacheClient.mset(keyValues)
		}

		// Migrate TTL for each key
		for (const key of keys) {
			const ttl = await this.upstashClient.ttl(key)
			if (ttl > 0) {
				const value = await this.upstashClient.get(key)
				if (value) {
					await this.elasticacheClient.set(key, value, ttl)
				}
			}
		}
	}
}
```

### Phase 2: Application Migration

#### 2.1 Connection String Updates

```typescript
// Environment-specific Redis configuration
interface RedisConfig {
	host: string
	port: number
	password?: string
	tls?: boolean
	clusterMode?: boolean
	clusterNodes?: string[]
}

// Development environment
const devConfig: RedisConfig = {
	host: process.env.DEV_REDIS_HOST || 'localhost',
	port: parseInt(process.env.DEV_REDIS_PORT || '6379'),
	password: process.env.DEV_REDIS_PASSWORD,
	tls: false,
	clusterMode: false,
}

// Production environment
const prodConfig: RedisConfig = {
	host:
		process.env.PROD_REDIS_HOST ||
		'macro-ai-redis-cluster.xyz.cache.amazonaws.com',
	port: parseInt(process.env.PROD_REDIS_PORT || '6379'),
	password: process.env.PROD_REDIS_PASSWORD || 'managed_by_secrets_manager',
	tls: true,
	clusterMode: true,
	clusterNodes: [
		'macro-ai-redis-cluster.xyz.cache.amazonaws.com:6379',
		'macro-ai-redis-cluster.xyz.cache.amazonaws.com:6380',
		'macro-ai-redis-cluster.xyz.cache.amazonaws.com:6381',
	],
}
```

#### 2.2 Gradual Traffic Migration

```typescript
// Feature flag for Redis migration
class RedisMigrationManager {
	private useElastiCache: boolean = false
	private migrationPercentage: number = 0
	private upstashClient: Redis
	private elasticacheClient: ElastiCacheRedisClient

	constructor() {
		this.useElastiCache = process.env.USE_ELASTICACHE === 'true'
		this.migrationPercentage = parseInt(
			process.env.REDIS_MIGRATION_PERCENTAGE || '0',
		)
	}

	async getRedisClient(
		userId: string,
	): Promise<Redis | ElastiCacheRedisClient> {
		// Use ElastiCache for a percentage of users
		if (this.useElastiCache && this.shouldUseElastiCache(userId)) {
			return this.elasticacheClient
		}

		// Use Upstash for remaining users
		return this.upstashClient
	}

	private shouldUseElastiCache(userId: string): boolean {
		// Use consistent hashing to determine which users go to ElastiCache
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

### Phase 3: Cutover and Validation

#### 3.1 Final Data Sync

```typescript
// Final data synchronization before cutover
class RedisDataSynchronizer {
	private upstashClient: Redis
	private elasticacheClient: ElastiCacheRedisClient
	private syncQueue: SyncOperation[] = []

	async syncData(operation: SyncOperation): Promise<void> {
		try {
			// Apply operation to both Redis instances
			await this.applyOperation(this.upstashClient, operation)
			await this.applyOperation(this.elasticacheClient, operation)

			console.log(`Successfully synced operation: ${operation.id}`)
		} catch (error) {
			console.error(`Failed to sync operation: ${operation.id}`, error)

			// Queue for retry
			this.syncQueue.push(operation)
		}
	}

	private async applyOperation(
		client: Redis | ElastiCacheRedisClient,
		operation: SyncOperation,
	): Promise<void> {
		switch (operation.type) {
			case 'SET':
				if (operation.ttl) {
					await client.setex(operation.key, operation.ttl, operation.value)
				} else {
					await client.set(operation.key, operation.value)
				}
				break
			case 'DEL':
				await client.del(operation.key)
				break
			case 'EXPIRE':
				await client.expire(operation.key, operation.ttl!)
				break
			default:
				throw new Error(`Unknown operation type: ${operation.type}`)
		}
	}
}
```

#### 3.2 Application Cutover

```typescript
// Zero-downtime cutover process
class RedisCutover {
	private upstashClient: Redis
	private elasticacheClient: ElastiCacheRedisClient
	private isCutoverComplete: boolean = false

	async performCutover(): Promise<void> {
		try {
			// 1. Stop accepting new connections to Upstash
			await this.stopUpstashConnections()

			// 2. Wait for existing connections to complete
			await this.waitForUpstashConnections()

			// 3. Apply final data sync
			await this.finalDataSync()

			// 4. Switch application to ElastiCache
			await this.switchToElastiCache()

			// 5. Verify application functionality
			await this.verifyApplication()

			// 6. Mark cutover as complete
			this.isCutoverComplete = true

			console.log('Redis cutover completed successfully')
		} catch (error) {
			console.error('Redis cutover failed:', error)
			await this.rollbackCutover()
			throw error
		}
	}

	private async switchToElastiCache(): Promise<void> {
		// Update application configuration to use ElastiCache
		await this.updateApplicationConfig('elasticache')

		// Update connection strings
		await this.updateConnectionStrings('elasticache')
	}

	private async verifyApplication(): Promise<void> {
		// Run health checks
		const healthChecks = [
			this.checkRedisConnectivity(),
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

## Performance Optimization

### 1. Connection Pooling

```typescript
// Redis connection pooling configuration
class RedisConnectionPool {
	private pools: Map<string, Redis> = new Map()
	private maxConnections: number = 100
	private minConnections: number = 10

	constructor(config: RedisConfig) {
		this.initializePools(config)
	}

	private initializePools(config: RedisConfig): void {
		for (let i = 0; i < this.maxConnections; i++) {
			const client = new Redis({
				host: config.host,
				port: config.port,
				password: config.password,
				tls: config.tls ? {} : undefined,
				retryDelayOnFailover: 100,
				maxRetriesPerRequest: 3,
				enableReadyCheck: false,
			})

			this.pools.set(`connection-${i}`, client)
		}
	}

	async getConnection(): Promise<Redis> {
		// Simple round-robin connection selection
		const connections = Array.from(this.pools.values())
		const index = Math.floor(Math.random() * connections.length)
		return connections[index]
	}

	async releaseConnection(client: Redis): Promise<void> {
		// Connection is automatically returned to pool
		// In a real implementation, you might want to track connection usage
	}
}
```

### 2. Caching Strategies

```typescript
// Multi-level caching strategy
class MultiLevelCache {
	private l1Cache: Map<string, any> = new Map() // In-memory
	private l2Cache: ElastiCacheRedisClient // ElastiCache Redis
	private l3Cache: Database // RDS PostgreSQL

	async get(key: string): Promise<any> {
		// L1 Cache (fastest)
		if (this.l1Cache.has(key)) {
			return this.l1Cache.get(key)
		}

		// L2 Cache (Redis)
		const l2Value = await this.l2Cache.get(key)
		if (l2Value) {
			const parsedValue = JSON.parse(l2Value)
			this.l1Cache.set(key, parsedValue)
			return parsedValue
		}

		// L3 Cache (Database)
		const l3Value = await this.l3Cache.get(key)
		if (l3Value) {
			const serializedValue = JSON.stringify(l3Value)
			await this.l2Cache.setex(key, 3600, serializedValue) // 1 hour TTL
			this.l1Cache.set(key, l3Value)
			return l3Value
		}

		return null
	}

	async set(key: string, value: any, ttl?: number): Promise<void> {
		const serializedValue = JSON.stringify(value)

		// Set in L1 cache
		this.l1Cache.set(key, value)

		// Set in L2 cache
		if (ttl) {
			await this.l2Cache.setex(key, ttl, serializedValue)
		} else {
			await this.l2Cache.set(key, serializedValue)
		}

		// Set in L3 cache (database)
		await this.l3Cache.set(key, value)
	}
}
```

### 3. Data Structure Optimization

```typescript
// Optimized Redis data structures
class OptimizedRedisOperations {
	private client: ElastiCacheRedisClient

	constructor(client: ElastiCacheRedisClient) {
		this.client = client
	}

	// Use Redis Lists for queues
	async enqueue(queueName: string, item: any): Promise<void> {
		await this.client.lpush(queueName, JSON.stringify(item))
	}

	async dequeue(queueName: string): Promise<any> {
		const item = await this.client.rpop(queueName)
		return item ? JSON.parse(item) : null
	}

	// Use Redis Sets for unique collections
	async addToSet(setName: string, member: string): Promise<void> {
		await this.client.sadd(setName, member)
	}

	async isInSet(setName: string, member: string): Promise<boolean> {
		return await this.client.sismember(setName, member)
	}

	// Use Redis Sorted Sets for rankings
	async addToRanking(
		rankingName: string,
		member: string,
		score: number,
	): Promise<void> {
		await this.client.zadd(rankingName, score, member)
	}

	async getTopMembers(rankingName: string, count: number): Promise<string[]> {
		return await this.client.zrevrange(rankingName, 0, count - 1)
	}

	// Use Redis Hashes for object storage
	async setHash(hashName: string, field: string, value: any): Promise<void> {
		await this.client.hset(hashName, field, JSON.stringify(value))
	}

	async getHash(hashName: string, field: string): Promise<any> {
		const value = await this.client.hget(hashName, field)
		return value ? JSON.parse(value) : null
	}

	async getAllHash(hashName: string): Promise<Record<string, any>> {
		const hash = await this.client.hgetall(hashName)
		const result: Record<string, any> = {}

		for (const [field, value] of Object.entries(hash)) {
			result[field] = JSON.parse(value)
		}

		return result
	}
}
```

## Monitoring and Alerting

### CloudWatch Metrics

```yaml
# ElastiCache CloudWatch metrics
elasticache_metrics:
  - name: 'CPUUtilization'
    description: 'CPU utilization percentage'
    threshold: 80
    comparison: 'GreaterThanThreshold'

  - name: 'MemoryUtilization'
    description: 'Memory utilization percentage'
    threshold: 80
    comparison: 'GreaterThanThreshold'

  - name: 'DatabaseConnections'
    description: 'Number of client connections'
    threshold: 180
    comparison: 'GreaterThanThreshold'

  - name: 'CacheHits'
    description: 'Number of cache hits'
    threshold: 0
    comparison: 'GreaterThanThreshold'

  - name: 'CacheMisses'
    description: 'Number of cache misses'
    threshold: 0
    comparison: 'GreaterThanThreshold'

  - name: 'Evictions'
    description: 'Number of evictions'
    threshold: 100
    comparison: 'GreaterThanThreshold'

  - name: 'CurrConnections'
    description: 'Current number of connections'
    threshold: 200
    comparison: 'GreaterThanThreshold'
```

### Custom Metrics

```typescript
// Custom Redis metrics
class RedisMetricsCollector {
	private cloudWatch: CloudWatchClient
	private namespace: string = 'MacroAI/Redis'

	async collectMetrics(): Promise<void> {
		const metrics = await this.getRedisMetrics()

		// Send custom metrics to CloudWatch
		await this.cloudWatch.putMetricData({
			Namespace: this.namespace,
			MetricData: [
				{
					MetricName: 'CacheHitRate',
					Value: metrics.hitRate,
					Unit: 'Percent',
				},
				{
					MetricName: 'AverageResponseTime',
					Value: metrics.averageResponseTime,
					Unit: 'Milliseconds',
				},
				{
					MetricName: 'KeyCount',
					Value: metrics.keyCount,
					Unit: 'Count',
				},
				{
					MetricName: 'MemoryUsage',
					Value: metrics.memoryUsage,
					Unit: 'Bytes',
				},
			],
		})
	}

	private async getRedisMetrics(): Promise<RedisMetrics> {
		// Get Redis INFO command output
		const info = await this.client.info()

		// Parse metrics from INFO output
		const metrics: RedisMetrics = {
			hitRate: this.parseHitRate(info),
			averageResponseTime: this.parseAverageResponseTime(info),
			keyCount: this.parseKeyCount(info),
			memoryUsage: this.parseMemoryUsage(info),
		}

		return metrics
	}

	private parseHitRate(info: string): number {
		const hits = this.extractValue(info, 'keyspace_hits')
		const misses = this.extractValue(info, 'keyspace_misses')
		const total = hits + misses

		return total > 0 ? (hits / total) * 100 : 0
	}

	private parseAverageResponseTime(info: string): number {
		const totalCommands = this.extractValue(info, 'total_commands_processed')
		const totalTime = this.extractValue(info, 'total_processing_time')

		return totalCommands > 0 ? totalTime / totalCommands : 0
	}

	private parseKeyCount(info: string): number {
		return this.extractValue(info, 'db0:keys')
	}

	private parseMemoryUsage(info: string): number {
		return this.extractValue(info, 'used_memory')
	}

	private extractValue(info: string, key: string): number {
		const regex = new RegExp(`${key}:(\\d+)`)
		const match = info.match(regex)
		return match ? parseInt(match[1]) : 0
	}
}
```

## Backup and Recovery

### Automated Backups

```yaml
# ElastiCache backup configuration
backup_configuration:
  backup_retention: 7
  snapshot_retention: 7
  snapshot_window: "03:00-05:00"

  # Cross-region backups
  cross_region_backup: true
  cross_region_backup_retention: 3

  # Automated snapshots
  automated_snapshots: true
  snapshot_retention: 7
```

### Disaster Recovery Procedures

```bash
#!/bin/bash
# ElastiCache disaster recovery procedures

# 1. Create recovery cluster
aws elasticache create-replication-group \
  --replication-group-id macro-ai-redis-recovery-$(date +%Y%m%d) \
  --description "Recovery Redis cluster for Macro AI" \
  --node-type cache.r6g.large \
  --num-cache-clusters 3 \
  --engine redis \
  --engine-version 7.0 \
  --cache-parameter-group-name default.redis7 \
  --cache-subnet-group-name macro-ai-cache-subnet-group \
  --security-group-ids sg-xxxxxxxxx \
  --multi-az-enabled \
  --automatic-failover-enabled \
  --at-rest-encryption-enabled \
  --transit-encryption-enabled \
  --auth-token "recovery-auth-token"

# 2. Restore from snapshot
aws elasticache create-replication-group \
  --replication-group-id macro-ai-redis-recovery-$(date +%Y%m%d) \
  --description "Recovery Redis cluster for Macro AI" \
  --node-type cache.r6g.large \
  --num-cache-clusters 3 \
  --engine redis \
  --engine-version 7.0 \
  --cache-parameter-group-name default.redis7 \
  --cache-subnet-group-name macro-ai-cache-subnet-group \
  --security-group-ids sg-xxxxxxxxx \
  --multi-az-enabled \
  --automatic-failover-enabled \
  --at-rest-encryption-enabled \
  --transit-encryption-enabled \
  --auth-token "recovery-auth-token" \
  --snapshot-name macro-ai-redis-snapshot-$(date +%Y%m%d)

# 3. Update application configuration
# Update connection strings to point to recovery cluster

# 4. Verify data integrity
redis-cli -h macro-ai-redis-recovery-$(date +%Y%m%d).xyz.cache.amazonaws.com \
  -p 6379 -a "recovery-auth-token" --tls \
  --eval "return redis.call('DBSIZE')" 0
```

## Cost Optimization

### Right-Sizing Strategy

```yaml
# ElastiCache right-sizing strategy
right_sizing_strategy:
  # Monitor for 30 days
  monitoring_period: 30_days

  # Metrics to track
  metrics:
    - cpu_utilization
    - memory_utilization
    - database_connections
    - cache_hit_rate
    - evictions
    - network_bytes_in
    - network_bytes_out

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
    cache_hit_rate:
      underutilized: < 80%
      optimal: 80-95%
      overutilized: > 95%

  # Recommended actions
  actions:
    underutilized: "Consider smaller instance type"
    overutilized: "Consider larger instance type"
    optimal: "Current instance type is appropriate"
```

### Memory Optimization

```typescript
// Memory optimization strategies
class RedisMemoryOptimizer {
	private client: ElastiCacheRedisClient

	async optimizeMemory(): Promise<void> {
		// 1. Set appropriate maxmemory policy
		await this.client.config('SET', 'maxmemory-policy', 'allkeys-lru')

		// 2. Enable memory optimization features
		await this.client.config('SET', 'lazyfree-lazy-eviction', 'yes')
		await this.client.config('SET', 'lazyfree-lazy-expire', 'yes')
		await this.client.config('SET', 'lazyfree-lazy-server-del', 'yes')
		await this.client.config('SET', 'replica-lazy-flush', 'yes')

		// 3. Optimize memory usage
		await this.optimizeDataStructures()
		await this.cleanupExpiredKeys()
		await this.optimizeStringEncoding()
	}

	private async optimizeDataStructures(): Promise<void> {
		// Use appropriate data structures for different use cases
		// Lists for queues, Sets for unique collections, etc.
	}

	private async cleanupExpiredKeys(): Promise<void> {
		// Run EXPIRE on keys that should expire
		// This helps with memory cleanup
	}

	private async optimizeStringEncoding(): Promise<void> {
		// Use appropriate string encoding
		// Redis automatically optimizes string encoding
	}
}
```

## Conclusion

This comprehensive ElastiCache Redis cluster configuration provides a clear path for migrating from Upstash to Amazon
ElastiCache while maintaining performance and reliability. The phased approach ensures a smooth transition with proper
validation and rollback procedures.

### Key Benefits

1. **Performance**: Sub-millisecond latency with ElastiCache
2. **Cost Optimization**: Significant cost savings at scale
3. **Integration**: Better AWS service integration
4. **High Availability**: Multi-AZ deployment with automatic failover
5. **Security**: Encryption at rest and in transit
6. **Monitoring**: Comprehensive CloudWatch monitoring and alerting
7. **Operational Control**: Full control over Redis configuration and maintenance

### Next Steps

1. **Complete Assessment**: Finish current state analysis and requirements gathering
2. **Infrastructure Setup**: Provision ElastiCache infrastructure and configure networking
3. **Migration Testing**: Test migration procedures in staging environment
4. **Production Migration**: Execute migration with proper monitoring and rollback procedures
5. **Post-Migration Optimization**: Tune performance and optimize costs
