/**
 * Database Integration Testing Utilities
 *
 * Provides real database testing capabilities using Docker containers
 * for comprehensive integration testing of database operations.
 *
 * Features:
 * - Real PostgreSQL database via Testcontainers
 * - Automatic schema migration and seeding
 * - Transaction-based test isolation
 * - Performance testing capabilities
 * - Database state management
 */

import { faker } from '@faker-js/faker'
import {
	PostgreSqlContainer,
	type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool, type PoolClient } from 'pg'

import * as schema from '../../data-access/schema.ts'

export interface DatabaseIntegrationTestConfig {
	/** Whether to enable SQL query logging */
	enableLogging?: boolean
	/** Custom database name (defaults to test-specific name) */
	databaseName?: string
	/** Whether to run migrations automatically */
	runMigrations?: boolean
	/** Whether to seed test data automatically */
	seedTestData?: boolean
	/** Connection pool configuration */
	poolConfig?: {
		max?: number
		idleTimeoutMillis?: number
		connectionTimeoutMillis?: number
	}
}

export interface DatabaseTestContext {
	/** Drizzle database instance */
	db: ReturnType<typeof drizzle>
	/** Raw PostgreSQL connection pool */
	pool: Pool
	/** Container instance for direct management */
	container: StartedPostgreSqlContainer
	/** Database connection URL */
	connectionUrl: string
	/** Clean up resources */
	cleanup: () => Promise<void>
	/** Start a database transaction for test isolation */
	startTransaction: () => Promise<DatabaseTransaction>
	/** Reset database to clean state */
	resetDatabase: () => Promise<void>
	/** Seed database with test data */
	seedTestData: () => Promise<TestDataSeeds>
}

export interface DatabaseTransaction {
	/** Database instance within transaction */
	db: ReturnType<typeof drizzle>
	/** Raw client for advanced operations */
	client: PoolClient
	/** Commit the transaction */
	commit: () => Promise<void>
	/** Rollback the transaction */
	rollback: () => Promise<void>
}

export interface TestDataSeeds {
	users: (typeof schema.usersTable.$inferSelect)[]
	chats: (typeof schema.chatsTable.$inferSelect)[]
	messages: (typeof schema.chatMessagesTable.$inferSelect)[]
}

/**
 * Global container instance for reuse across tests
 * Helps improve test performance by avoiding container recreation
 */
let globalContainer: StartedPostgreSqlContainer | null = null
let globalContainerRefCount = 0

/**
 * Setup database integration testing environment
 * Creates a real PostgreSQL container and configures the database
 *
 * @param config - Configuration options for the test database
 * @returns Database test context with all necessary utilities
 */
export const setupDatabaseIntegration = async (
	config: DatabaseIntegrationTestConfig = {},
): Promise<DatabaseTestContext> => {
	const {
		enableLogging = false,
		databaseName = `test_db_${String(Date.now())}_${Math.random().toString(36).slice(2)}`,
		runMigrations = true,
		seedTestData = false,
		poolConfig = {},
	} = config

	// Reuse global container if available, otherwise create new one
	let container: StartedPostgreSqlContainer
	if (globalContainer) {
		container = globalContainer
		globalContainerRefCount++
	} else {
		container = await new PostgreSqlContainer('pgvector/pgvector:pg16')
			.withDatabase(databaseName)
			.withUsername('testuser')
			.withPassword('testpass')
			.withExposedPorts(5432)
			.start()

		globalContainer = container
		globalContainerRefCount = 1
	}

	// Create connection pool
	const connectionUrl = container.getConnectionUri()
	const pool = new Pool({
		connectionString: connectionUrl,
		max: poolConfig.max ?? 10,
		idleTimeoutMillis: poolConfig.idleTimeoutMillis ?? 30000,
		connectionTimeoutMillis: poolConfig.connectionTimeoutMillis ?? 2000,
	})

	// Create Drizzle instance
	const db = drizzle(pool, {
		schema,
		logger: enableLogging,
	})

	// Install required extensions first
	try {
		await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)
		await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "vector"`)
	} catch (error) {
		console.error('❌ Extension installation failed:', error)
		throw error // Re-throw to fail the test setup
	}

	// Run migrations if requested
	if (runMigrations) {
		try {
			// Use relative path since we're already in the express-api directory
			const migrationsPath = './src/data-access/migrations'
			await migrate(db, { migrationsFolder: migrationsPath })
		} catch (error) {
			console.error('❌ Migration failed:', error)
			throw error // Re-throw to fail the test setup
		}
	}

	// Seed test data if requested (only after migrations are complete)
	let testSeeds: TestDataSeeds | undefined
	if (seedTestData && runMigrations) {
		testSeeds = await seedDatabaseWithTestData(db)
	}

	const context: DatabaseTestContext = {
		db,
		pool,
		container,
		connectionUrl,

		async cleanup() {
			try {
				await pool.end()
				globalContainerRefCount--

				if (globalContainerRefCount <= 0 && globalContainer) {
					await globalContainer.stop()
					globalContainer = null
					globalContainerRefCount = 0
				}
			} catch (error) {
				console.error('❌ Error during database cleanup:', error)
			}
		},

		async startTransaction() {
			const client = await pool.connect()
			await client.query('BEGIN')

			const transactionDb = drizzle(client, { schema, logger: enableLogging })
			let isReleased = false

			return {
				db: transactionDb,
				client,
				async commit() {
					if (!isReleased) {
						await client.query('COMMIT')
						client.release()
						isReleased = true
					}
				},
				async rollback() {
					if (!isReleased) {
						await client.query('ROLLBACK')
						client.release()
						isReleased = true
					}
				},
			}
		},

		async resetDatabase() {
			// Truncate all tables in reverse dependency order
			await db.execute(sql`TRUNCATE TABLE ${schema.chatMessagesTable} CASCADE`)
			await db.execute(sql`TRUNCATE TABLE ${schema.chatVectorsTable} CASCADE`)
			await db.execute(sql`TRUNCATE TABLE ${schema.chatsTable} CASCADE`)
			await db.execute(sql`TRUNCATE TABLE ${schema.usersTable} CASCADE`)
		},

		async seedTestData() {
			if (testSeeds) {
				return testSeeds
			}
			testSeeds = await seedDatabaseWithTestData(db)
			return testSeeds
		},
	}

	return context
}

/**
 * Seed database with realistic test data
 * Creates a set of interconnected test data for comprehensive testing
 *
 * @param db - Drizzle database instance
 * @returns Created test data for use in assertions
 */
export const seedDatabaseWithTestData = async (
	db: ReturnType<typeof drizzle>,
): Promise<TestDataSeeds> => {
	try {
		// Create test users
		const users = await db
			.insert(schema.usersTable)
			.values([
				{
					id: faker.string.uuid(),
					email: 'john.doe@example.com',
					emailVerified: true,
					firstName: 'John',
					lastName: 'Doe',
				},
				{
					id: faker.string.uuid(),
					email: 'jane.smith@example.com',
					emailVerified: true,
					firstName: 'Jane',
					lastName: 'Smith',
				},
				{
					id: faker.string.uuid(),
					email: 'bob.wilson@example.com',
					emailVerified: false,
					firstName: 'Bob',
					lastName: 'Wilson',
				},
			])
			.returning()

		// Create test chats
		const chats = await db
			.insert(schema.chatsTable)
			.values([
				{
					id: faker.string.uuid(),
					userId: users[0]?.id ?? '',
					title: 'Project Planning Discussion',
				},
				{
					id: faker.string.uuid(),
					userId: users[1]?.id ?? '',
					title: 'Technical Architecture Review',
				},
				{
					id: faker.string.uuid(),
					userId: users[0]?.id ?? '',
					title: 'Bug Investigation Chat',
				},
			])
			.returning()

		// Create test messages
		const messages = await db
			.insert(schema.chatMessagesTable)
			.values([
				{
					id: faker.string.uuid(),
					chatId: chats[0]?.id ?? '',
					role: 'user' as const,
					content: "Let's plan our next sprint",
				},
				{
					id: faker.string.uuid(),
					chatId: chats[0]?.id ?? '',
					role: 'assistant' as const,
					content:
						"I'd be happy to help you plan your sprint. What are your main objectives?",
				},
				{
					id: faker.string.uuid(),
					chatId: chats[1]?.id ?? '',
					role: 'user' as const,
					content: 'Can you review our microservices architecture?',
				},
				{
					id: faker.string.uuid(),
					chatId: chats[2]?.id ?? '',
					role: 'user' as const,
					content: "I'm seeing a strange error in production",
				},
			])
			.returning()

		return {
			users,
			chats,
			messages,
		}
	} catch (error) {
		console.error('❌ Error seeding test data:', error)
		throw error
	}
}

/**
 * Performance testing utilities for database operations
 */
export class DatabasePerformanceTester {
	private db: ReturnType<typeof drizzle>
	private results: {
		operation: string
		duration: number
		timestamp: Date
	}[] = []

	constructor(db: ReturnType<typeof drizzle>) {
		this.db = db
	}

	/**
	 * Time a database operation and record the result
	 * @param operationName - Name of the operation for reporting
	 * @param operation - Async operation to time
	 * @returns Result of the operation
	 */
	async timeOperation<T>(
		operationName: string,
		operation: () => Promise<T>,
	): Promise<T> {
		const start = performance.now()
		try {
			const result = await operation()
			const duration = performance.now() - start
			this.results.push({
				operation: operationName,
				duration,
				timestamp: new Date(),
			})
			return result
		} catch (error) {
			const duration = performance.now() - start
			this.results.push({
				operation: `${operationName} (ERROR)`,
				duration,
				timestamp: new Date(),
			})
			throw error
		}
	}

	/**
	 * Run a performance test suite with multiple iterations
	 * @param testName - Name of the test suite
	 * @param operation - Operation to repeat
	 * @param iterations - Number of iterations to run
	 * @returns Performance statistics
	 */
	async runPerformanceTest(
		testName: string,
		operation: () => Promise<void>,
		iterations = 100,
	): Promise<{
		testName: string
		iterations: number
		totalTime: number
		averageTime: number
		minTime: number
		maxTime: number
		results: { duration: number; timestamp: Date }[]
	}> {
		const testResults: { duration: number; timestamp: Date }[] = []

		for (let i = 0; i < iterations; i++) {
			const start = performance.now()
			await operation()
			const duration = performance.now() - start
			testResults.push({ duration, timestamp: new Date() })

			// Progress indicator for long tests
			if (iterations > 50 && (i + 1) % Math.ceil(iterations / 10) === 0) {
				console.log(
					`  Progress: ${String(i + 1)}/${String(iterations)} (${String(Math.round(((i + 1) / iterations) * 100))}%)`,
				)
			}
		}

		const durations = testResults.map((r) => r.duration)
		const stats = {
			testName,
			iterations,
			totalTime: durations.reduce((sum, d) => sum + d, 0),
			averageTime: durations.reduce((sum, d) => sum + d, 0) / durations.length,
			minTime: Math.min(...durations),
			maxTime: Math.max(...durations),
			results: testResults,
		}

		return stats
	}

	/**
	 * Get all recorded performance results
	 * @returns Array of all performance measurements
	 */
	getResults() {
		return [...this.results]
	}

	/**
	 * Clear all recorded results
	 */
	clearResults() {
		this.results = []
	}
}

/**
 * Utility function to create a database performance tester
 * @param db - Drizzle database instance
 * @returns Configured performance tester
 */
export const createPerformanceTester = (
	db: ReturnType<typeof drizzle>,
): DatabasePerformanceTester => {
	return new DatabasePerformanceTester(db)
}

/**
 * Clean up all global resources
 * Should be called in global test teardown
 */
export const cleanupGlobalResources = async (): Promise<void> => {
	if (globalContainer) {
		await globalContainer.stop()
		globalContainer = null
		globalContainerRefCount = 0
	}
}
