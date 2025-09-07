#!/usr/bin/env tsx

/**
 * Feature Environment Verification Script
 *
 * This script verifies that a feature environment is properly configured and working.
 * It checks database connectivity, Redis connectivity, and API health.
 */

import { config } from '../apps/express-api/src/utils/load-config.ts'
import {
	getCurrentDatabaseConfig,
	getEnvironmentType,
} from '../apps/express-api/src/utils/neon-branching.ts'
import {
	isRedisEnabled,
	getRedisUrl,
	logRedisConfig,
} from '../apps/express-api/src/utils/redis-config.ts'

// Colors for console output
const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	cyan: '\x1b[36m',
}

function log(level: 'info' | 'success' | 'warning' | 'error', message: string) {
	const color = {
		info: colors.blue,
		success: colors.green,
		warning: colors.yellow,
		error: colors.red,
	}[level]

	console.log(`${color}[${level.toUpperCase()}]${colors.reset} ${message}`)
}

async function testDatabaseConnection() {
	log('info', 'Testing database connection...')

	try {
		const dbConfig = getCurrentDatabaseConfig()
		const envType = getEnvironmentType()

		log('info', `Environment: ${envType}`)
		log('info', `Branch: ${dbConfig.branch}`)
		log('info', `Description: ${dbConfig.description}`)

		// For localhost, we can't test the actual connection without the database running
		if (dbConfig.branch === 'localhost') {
			log('warning', 'Localhost database detected - skipping connection test')
			log('info', 'Make sure your local PostgreSQL database is running')
			return true
		}

		// Test Neon branch connection
		const { Client } = await import('pg')
		const client = new Client({
			connectionString: dbConfig.url,
			connectionTimeoutMillis: 5000,
		})

		await client.connect()
		log('success', 'Database connection successful')

		// Test a simple query
		const result = await client.query('SELECT version()')
		log(
			'success',
			`Database version: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}`,
		)

		await client.end()
		return true
	} catch (error) {
		log('error', `Database connection failed: ${error}`)
		return false
	}
}

async function testRedisConnection() {
	log('info', 'Testing Redis connection...')

	logRedisConfig()

	if (!isRedisEnabled()) {
		log('warning', 'Redis is disabled for this environment')
		return true
	}

	try {
		const redisUrl = getRedisUrl()
		if (!redisUrl) {
			log('warning', 'Redis URL not configured')
			return false
		}

		const { createClient } = await import('redis')
		const client = createClient({
			url: redisUrl,
			socket: {
				connectTimeout: 5000,
			},
		})

		client.on('error', (err) => {
			log('error', `Redis connection error: ${err}`)
		})

		await client.connect()
		log('success', 'Redis connection successful')

		// Test basic operations
		await client.set('test-key', 'test-value')
		const value = await client.get('test-key')
		if (value === 'test-value') {
			log('success', 'Redis read/write test passed')
		} else {
			log('error', 'Redis read/write test failed')
			return false
		}

		await client.del('test-key')
		await client.quit()
		return true
	} catch (error) {
		log('error', `Redis connection failed: ${error}`)
		return false
	}
}

async function testApiHealth() {
	log('info', 'Testing API health endpoint...')

	try {
		const apiUrl = process.env.API_URL || 'http://localhost:3000'
		const healthUrl = `${apiUrl}/health`

		log('info', `Testing health endpoint: ${healthUrl}`)

		// For feature environments, the API might not be running locally
		if (config.APP_ENV === 'feature' && !process.env.API_URL) {
			log(
				'warning',
				'API URL not provided for feature environment - skipping health check',
			)
			log('info', 'Set API_URL environment variable to test deployed API')
			return true
		}

		const response = await fetch(healthUrl, {
			timeout: 5000,
		})

		if (response.ok) {
			log('success', 'API health check passed')
			return true
		} else {
			log('error', `API health check failed with status: ${response.status}`)
			return false
		}
	} catch (error) {
		log('error', `API health check failed: ${error}`)
		return false
	}
}

async function verifyEnvironmentConfiguration() {
	log('info', 'Verifying environment configuration...')

	const requiredEnvVars = ['APP_ENV', 'RELATIONAL_DATABASE_URL', 'NODE_ENV']

	const optionalEnvVars = ['REDIS_URL', 'PORT', 'SESSION_SECRET']

	let allRequired = true

	for (const envVar of requiredEnvVars) {
		if (!process.env[envVar]) {
			log('error', `Required environment variable missing: ${envVar}`)
			allRequired = false
		} else {
			log('success', `✓ ${envVar} is set`)
		}
	}

	for (const envVar of optionalEnvVars) {
		if (!process.env[envVar]) {
			log('warning', `Optional environment variable missing: ${envVar}`)
		} else {
			log('info', `✓ ${envVar} is set`)
		}
	}

	return allRequired
}

async function main() {
	console.log(
		`${colors.cyan}${colors.bright}🚀 Feature Environment Verification${colors.reset}`,
	)
	console.log('================================\n')

	const results = {
		environment: false,
		database: false,
		redis: false,
		api: false,
	}

	// Test environment configuration
	results.environment = await verifyEnvironmentConfiguration()

	// Test database connection
	results.database = await testDatabaseConnection()

	// Test Redis connection
	results.redis = await testRedisConnection()

	// Test API health
	results.api = await testApiHealth()

	// Summary
	console.log('\n================================')
	console.log(
		`${colors.cyan}${colors.bright}📊 Verification Summary${colors.reset}`,
	)

	const passed = Object.values(results).filter(Boolean).length
	const total = Object.keys(results).length

	for (const [test, passed] of Object.entries(results)) {
		const status = passed
			? `${colors.green}✓ PASS${colors.reset}`
			: `${colors.red}✗ FAIL${colors.reset}`
		console.log(`${status} ${test.charAt(0).toUpperCase() + test.slice(1)}`)
	}

	console.log(
		`\n${colors.bright}Results: ${passed}/${total} tests passed${colors.reset}`,
	)

	if (passed === total) {
		console.log(
			`${colors.green}${colors.bright}🎉 All verification tests passed!${colors.reset}`,
		)
		console.log('\nYour feature environment is ready for development.')
		process.exit(0)
	} else {
		console.log(
			`${colors.red}${colors.bright}❌ Some verification tests failed.${colors.reset}`,
		)
		console.log('\nPlease fix the failed tests before proceeding.')
		process.exit(1)
	}
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
	log('error', `Unhandled Rejection at: ${promise}, reason: ${reason}`)
	process.exit(1)
})

// Run the verification
main().catch((error) => {
	log('error', `Verification failed with error: ${error}`)
	process.exit(1)
})
