/**
 * Advanced Mocking & Stubbing Utilities
 *
 * Provides comprehensive mocking capabilities for complex testing scenarios including:
 * - Time-based testing with controllable timers
 * - Database transaction testing with rollback capabilities
 * - Advanced error simulation and injection
 * - Contract testing with request/response validation
 * - Mock data factories with realistic patterns
 * - Performance testing with controlled delays
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-inferrable-types */
/* eslint-disable @typescript-eslint/no-extraneous-class */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */
/* eslint-disable @typescript-eslint/array-type */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { faker } from '@faker-js/faker'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type { Pool, PoolClient } from 'pg'
import { vi } from 'vitest'

// ============================================================================
// Time-Based Testing Utilities
// ============================================================================

export interface TimeControlOptions {
	/** Whether to use fake timers (default: true) */
	useFakeTimers?: boolean
	/** Initial time to set (default: current time) */
	initialTime?: Date | number
	/** Whether to advance time automatically (default: false) */
	autoAdvance?: boolean
	/** Time advancement interval in ms (default: 1000) */
	advanceInterval?: number
}

export class TimeController {
	private originalTimers: {
		setTimeout: typeof setTimeout
		setInterval: typeof setInterval
		clearTimeout: typeof clearTimeout
		clearInterval: typeof clearInterval
		Date: typeof Date
		performance: typeof performance
	} | null = null
	private isActive = false
	private autoAdvanceTimer: NodeJS.Timeout | null = null

	constructor(private options: TimeControlOptions = {}) {
		this.options = {
			useFakeTimers: true,
			initialTime: Date.now(),
			autoAdvance: false,
			advanceInterval: 1000,
			...options,
		}
	}

	/**
	 * Start time control with fake timers
	 */
	start(): void {
		if (this.isActive) return

		if (this.options.useFakeTimers) {
			// Store original timers
			this.originalTimers = {
				setTimeout: global.setTimeout,
				setInterval: global.setInterval,
				clearTimeout: global.clearTimeout,
				clearInterval: global.clearInterval,
				Date: global.Date,
				performance: global.performance,
			}

			// Install fake timers
			vi.useFakeTimers({
				now: this.options.initialTime,
			})

			// Start auto-advance if enabled
			if (this.options.autoAdvance) {
				this.startAutoAdvance()
			}
		}

		this.isActive = true
	}

	/**
	 * Stop time control and restore original timers
	 */
	stop(): void {
		if (!this.isActive) return

		if (this.originalTimers) {
			vi.useRealTimers()
			this.originalTimers = null
		}

		this.stopAutoAdvance()
		this.isActive = false
	}

	/**
	 * Advance time by specified milliseconds
	 */
	advance(ms: number): void {
		if (this.isActive && this.options.useFakeTimers) {
			vi.advanceTimersByTime(ms)
		}
	}

	/**
	 * Set time to specific timestamp
	 */
	setTime(time: Date | number): void {
		if (this.isActive && this.options.useFakeTimers) {
			vi.setSystemTime(time)
		}
	}

	/**
	 * Get current fake time
	 */
	getTime(): Date {
		if (this.isActive && this.options.useFakeTimers) {
			return new Date()
		}
		return new Date()
	}

	/**
	 * Wait for all pending timers to complete
	 */
	async waitForTimers(): Promise<void> {
		if (this.isActive && this.options.useFakeTimers) {
			await vi.runAllTimersAsync()
		}
	}

	/**
	 * Wait for specific timer to complete
	 */
	async waitForTimer(ms: number): Promise<void> {
		if (this.isActive && this.options.useFakeTimers) {
			await vi.advanceTimersByTimeAsync(ms)
		}
	}

	private startAutoAdvance(): void {
		if (this.autoAdvanceTimer) return

		this.autoAdvanceTimer = setInterval(() => {
			this.advance(this.options.advanceInterval!)
		}, this.options.advanceInterval)
	}

	private stopAutoAdvance(): void {
		if (this.autoAdvanceTimer) {
			clearInterval(this.autoAdvanceTimer)
			this.autoAdvanceTimer = null
		}
	}
}

// ============================================================================
// Database Transaction Testing Utilities
// ============================================================================

export interface TransactionTestOptions {
	/** Whether to automatically rollback transactions (default: true) */
	autoRollback?: boolean
	/** Whether to isolate transactions (default: true) */
	isolate?: boolean
	/** Custom transaction timeout in ms (default: 30000) */
	timeout?: number
}

export class TransactionTester {
	constructor(
		private db: DrizzleD1Database,
		private pool: Pool,
		private options: TransactionTestOptions = {},
	) {
		this.options = {
			autoRollback: true,
			isolate: true,
			timeout: 30000,
			...options,
		}
	}

	/**
	 * Execute test within a transaction that will be rolled back
	 */
	async withTransaction<T>(
		testFn: (client: PoolClient) => Promise<T>,
	): Promise<T> {
		const client = await this.pool.connect()

		try {
			await client.query('BEGIN')

			// Set transaction isolation level if requested
			if (this.options.isolate) {
				await client.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED')
			}

			// Set transaction timeout
			if (this.options.timeout) {
				await client.query(`SET statement_timeout = ${this.options.timeout}`)
			}

			const result = await testFn(client)

			// Rollback if auto-rollback is enabled
			if (this.options.autoRollback) {
				await client.query('ROLLBACK')
			} else {
				await client.query('COMMIT')
			}

			return result
		} catch (error) {
			await client.query('ROLLBACK')
			throw error
		} finally {
			client.release()
		}
	}

	/**
	 * Test concurrent transactions
	 */
	async testConcurrentTransactions<T>(
		transactions: ((client: PoolClient) => Promise<T>)[],
	): Promise<T[]> {
		const promises = transactions.map(async (txnFn) => {
			return this.withTransaction(txnFn)
		})

		return Promise.all(promises)
	}

	/**
	 * Test transaction deadlock scenarios
	 */
	async testDeadlockScenario(
		scenario: (client1: PoolClient, client2: PoolClient) => Promise<void>,
	): Promise<void> {
		const client1 = await this.pool.connect()
		const client2 = await this.pool.connect()

		try {
			await client1.query('BEGIN')
			await client2.query('BEGIN')

			// Set different isolation levels to increase deadlock probability
			await client1.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE')
			await client2.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE')

			await scenario(client1, client2)

			await client1.query('COMMIT')
			await client2.query('COMMIT')
		} catch (error) {
			await client1.query('ROLLBACK')
			await client2.query('ROLLBACK')
			throw error
		} finally {
			client1.release()
			client2.release()
		}
	}
}

// ============================================================================
// Advanced Error Simulation
// ============================================================================

export interface ErrorSimulationOptions {
	/** Probability of error (0-1, default: 0.1) */
	probability?: number
	/** Error types to simulate */
	errorTypes?: ('network' | 'database' | 'validation' | 'timeout' | 'permission')[]
	/** Custom error messages */
	customMessages?: Record<string, string>
	/** Whether to log simulated errors (default: false) */
	logErrors?: boolean
}

export class ErrorSimulator {
	private originalMethods = new Map<string, any>()
	private isActive = false

	constructor(private options: ErrorSimulationOptions = {}) {
		this.options = {
			probability: 0.1,
			errorTypes: [
				'network',
				'database',
				'validation',
				'timeout',
				'permission',
			],
			customMessages: {},
			logErrors: false,
			...options,
		}
	}

	/**
	 * Start error simulation
	 */
	start(): void {
		if (this.isActive) return

		this.isActive = true
		this.setupErrorInjection()
	}

	/**
	 * Stop error simulation
	 */
	stop(): void {
		if (!this.isActive) return

		this.restoreOriginalMethods()
		this.isActive = false
	}

	/**
	 * Simulate specific error type
	 */
	simulateError(type: string, message?: string): void {
		if (this.options.logErrors) {
			console.log(`🔴 Simulating ${type} error: ${message || 'Default error'}`)
		}

		const error = this.createError(type, message)
		throw error
	}

	/**
	 * Check if error should be simulated based on probability
	 */
	shouldSimulateError(): boolean {
		return Math.random() < this.options.probability!
	}

	/**
	 * Wrap function with error simulation
	 */
	wrapWithErrorSimulation<T extends (...args: any[]) => any>(
		fn: T,
		errorType = 'generic',
	): T {
		return ((...args: Parameters<T>) => {
			if (this.shouldSimulateError()) {
				this.simulateError(errorType)
			}
			return fn(...args)
		}) as T
	}

	private setupErrorInjection(): void {
		// Mock database operations
		this.mockDatabaseOperations()

		// Mock network operations
		this.mockNetworkOperations()

		// Mock file system operations
		this.mockFileSystemOperations()
	}

	private mockDatabaseOperations(): void {
		// Mock common database errors
		const dbErrorTypes = ['connection', 'query', 'transaction', 'constraint']

		dbErrorTypes.forEach((errorType) => {
			const originalMethod = this.getOriginalMethod(`db.${errorType}`)
			if (originalMethod) {
				this.originalMethods.set(`db.${errorType}`, originalMethod)
			}
		})
	}

	private mockNetworkOperations(): void {
		// Mock fetch and HTTP operations
		const networkErrorTypes = ['timeout', 'connection', 'server', 'client']

		networkErrorTypes.forEach((errorType) => {
			const originalMethod = this.getOriginalMethod(`network.${errorType}`)
			if (originalMethod) {
				this.originalMethods.set(`network.${errorType}`, originalMethod)
			}
		})
	}

	private mockFileSystemOperations(): void {
		// Mock file system operations
		const fsErrorTypes = ['read', 'write', 'permission', 'notfound']

		fsErrorTypes.forEach((errorType) => {
			const originalMethod = this.getOriginalMethod(`fs.${errorType}`)
			if (originalMethod) {
				this.originalMethods.set(`fs.${errorType}`, originalMethod)
			}
		})
	}

	private getOriginalMethod(methodPath: string): any {
		// Implementation would depend on specific methods being mocked
		// This is a placeholder for the actual method retrieval logic
		return null
	}

	private restoreOriginalMethods(): void {
		this.originalMethods.forEach((originalMethod, methodPath) => {
			// Restore original methods
			// Implementation would depend on specific methods being mocked
		})
		this.originalMethods.clear()
	}

	private createError(type: string, message?: string): Error {
		const defaultMessages = {
			network: 'Network connection failed',
			database: 'Database operation failed',
			validation: 'Validation error occurred',
			timeout: 'Operation timed out',
			permission: 'Permission denied',
			generic: 'Simulated error occurred',
		}

		const errorMessage =
			message ||
			this.options.customMessages?.[type] ||
			defaultMessages[type as keyof typeof defaultMessages] ||
			'Unknown error'

		const error = new Error(errorMessage)
		error.name = `${type}Error`

		// Add additional properties based on error type
		switch (type) {
			case 'network':
				;(error as any).code = 'NETWORK_ERROR'
				;(error as any).status = 503
				break
			case 'database':
				;(error as any).code = 'DB_ERROR'
				;(error as any).status = 500
				break
			case 'validation':
				;(error as any).code = 'VALIDATION_ERROR'
				;(error as any).status = 400
				break
			case 'timeout':
				;(error as any).code = 'TIMEOUT_ERROR'
				;(error as any).status = 408
				break
			case 'permission':
				;(error as any).code = 'PERMISSION_ERROR'
				;(error as any).status = 403
				break
		}

		return error
	}
}

// ============================================================================
// Contract Testing Utilities
// ============================================================================

export interface ContractDefinition {
	/** Contract name/identifier */
	name: string
	/** Request schema validation */
	requestSchema?: any
	/** Response schema validation */
	responseSchema?: any
	/** Expected status codes */
	expectedStatusCodes?: number[]
	/** Required headers */
	requiredHeaders?: string[]
	/** Custom validation function */
	customValidation?: (request: any, response: any) => boolean
}

export class ContractTester {
	private contracts = new Map<string, ContractDefinition>()

	/**
	 * Register a contract definition
	 */
	registerContract(contract: ContractDefinition): void {
		this.contracts.set(contract.name, contract)
	}

	/**
	 * Validate request against contract
	 */
	validateRequest(contractName: string, request: any): boolean {
		const contract = this.contracts.get(contractName)
		if (!contract) {
			throw new Error(`Contract '${contractName}' not found`)
		}

		// Validate request schema if provided
		if (contract.requestSchema) {
			return this.validateSchema(request, contract.requestSchema)
		}

		return true
	}

	/**
	 * Validate response against contract
	 */
	validateResponse(contractName: string, response: any): boolean {
		const contract = this.contracts.get(contractName)
		if (!contract) {
			throw new Error(`Contract '${contractName}' not found`)
		}

		// Validate response schema if provided
		if (contract.responseSchema) {
			return this.validateSchema(response, contract.responseSchema)
		}

		// Validate status code if provided
		if (contract.expectedStatusCodes && response.status) {
			return contract.expectedStatusCodes.includes(response.status)
		}

		return true
	}

	/**
	 * Run contract test
	 */
	async testContract(
		contractName: string,
		request: any,
		response: any,
	): Promise<boolean> {
		const contract = this.contracts.get(contractName)
		if (!contract) {
			throw new Error(`Contract '${contractName}' not found`)
		}

		// Validate request
		if (!this.validateRequest(contractName, request)) {
			return false
		}

		// Validate response
		if (!this.validateResponse(contractName, response)) {
			return false
		}

		// Run custom validation if provided
		if (contract.customValidation) {
			return contract.customValidation(request, response)
		}

		return true
	}

	private validateSchema(data: any, schema: any): boolean {
		// Simple schema validation - in a real implementation, you'd use a proper schema validator
		// like Joi, Yup, or Zod
		try {
			// Basic validation logic for testing
			if (schema.type === 'object') {
				if (typeof data !== 'object' || data === null) return false

				// Check required properties
				if (schema.required) {
					for (const prop of schema.required) {
						if (!(prop in data)) return false
					}
				}

				// Check properties
				if (schema.properties) {
					for (const [prop, propSchema] of Object.entries(schema.properties)) {
						if (prop in data) {
							const propType = (propSchema as any).type
							if (propType === 'string' && typeof data[prop] !== 'string')
								return false
							if (propType === 'number' && typeof data[prop] !== 'number')
								return false
							if (propType === 'boolean' && typeof data[prop] !== 'boolean')
								return false
							if (propType === 'array' && !Array.isArray(data[prop]))
								return false
						}
					}
				}
			}

			return true
		} catch {
			return false
		}
	}
}

// ============================================================================
// Mock Data Factories
// ============================================================================

export class MockDataFactory {
	/**
	 * Create realistic user data
	 */
	static createUser(overrides: Partial<any> = {}): any {
		return {
			id: faker.string.uuid(),
			email: faker.internet.email(),
			firstName: faker.person.firstName(),
			lastName: faker.person.lastName(),
			createdAt: faker.date.past(),
			updatedAt: faker.date.recent(),
			...overrides,
		}
	}

	/**
	 * Create realistic chat data
	 */
	static createChat(overrides: Partial<any> = {}): any {
		return {
			id: faker.string.uuid(),
			title: faker.lorem.sentence(),
			userId: faker.string.uuid(),
			createdAt: faker.date.past(),
			updatedAt: faker.date.recent(),
			...overrides,
		}
	}

	/**
	 * Create realistic message data
	 */
	static createMessage(overrides: Partial<any> = {}): any {
		return {
			id: faker.string.uuid(),
			content: faker.lorem.paragraph(),
			role: faker.helpers.arrayElement(['user', 'assistant', 'system']),
			chatId: faker.string.uuid(),
			createdAt: faker.date.past(),
			...overrides,
		}
	}

	/**
	 * Create array of mock data
	 */
	static createArray<T>(
		factory: () => T,
		count: number,
		overrides: Partial<T> = {},
	): T[] {
		return Array.from({ length: count }, () => ({
			...factory(),
			...overrides,
		}))
	}

	/**
	 * Create mock API response
	 */
	static createApiResponse<T>(data: T, overrides: Partial<any> = {}): any {
		return {
			success: true,
			data,
			timestamp: new Date().toISOString(),
			...overrides,
		}
	}

	/**
	 * Create mock error response
	 */
	static createErrorResponse(
		message: string,
		code = 'ERROR',
		status = 500,
	): any {
		return {
			success: false,
			error: {
				message,
				code,
				status,
			},
			timestamp: new Date().toISOString(),
		}
	}
}

// ============================================================================
// Performance Testing Utilities
// ============================================================================

export interface PerformanceTestOptions {
	/** Number of iterations to run */
	iterations: number
	/** Warmup iterations (default: 10) */
	warmup?: number
	/** Whether to measure memory usage (default: false) */
	measureMemory?: boolean
	/** Custom performance metrics to track */
	customMetrics?: string[]
}

export class PerformanceTester {
	private results: {
		operation: string
		duration: number
		memory?: number
		timestamp: Date
		metadata?: Record<string, any>
	}[] = []

	/**
	 * Run performance test
	 */
	async runPerformanceTest<T>(
		operation: string,
		testFn: () => Promise<T> | T,
		options: PerformanceTestOptions,
	): Promise<{
		results: typeof this.results
		summary: {
			avgDuration: number
			minDuration: number
			maxDuration: number
			avgMemory?: number
			throughput: number
		}
	}> {
		const { iterations, warmup = 10, measureMemory = false } = options

		// Warmup runs
		for (let i = 0; i < warmup; i++) {
			await testFn()
		}

		// Performance runs
		for (let i = 0; i < iterations; i++) {
			const startTime = performance.now()
			const startMemory = measureMemory ? process.memoryUsage() : undefined

			await testFn()

			const endTime = performance.now()
			const endMemory = measureMemory ? process.memoryUsage() : undefined

			const duration = endTime - startTime
			const memory = measureMemory
				? (endMemory!.heapUsed - startMemory!.heapUsed) / 1024 / 1024 // MB
				: undefined

			this.results.push({
				operation,
				duration,
				memory,
				timestamp: new Date(),
			})
		}

		// Calculate summary
		const durations = this.results.map((r) => r.duration)
		const memories = this.results
			.filter((r) => r.memory !== undefined)
			.map((r) => r.memory!)

		const summary = {
			avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
			minDuration: Math.min(...durations),
			maxDuration: Math.max(...durations),
			avgMemory:
				memories.length > 0
					? memories.reduce((a, b) => a + b, 0) / memories.length
					: undefined,
			throughput:
				1000 / (durations.reduce((a, b) => a + b, 0) / durations.length), // ops/sec
		}

		return {
			results: this.results,
			summary,
		}
	}

	/**
	 * Clear results
	 */
	clearResults(): void {
		this.results = []
	}

	/**
	 * Get results for specific operation
	 */
	getResultsForOperation(operation: string): typeof this.results {
		return this.results.filter((r) => r.operation === operation)
	}
}

// ============================================================================
// Export all utilities
// ============================================================================

// All classes are already exported above, no need for duplicate exports
