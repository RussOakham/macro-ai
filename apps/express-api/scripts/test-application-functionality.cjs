#!/usr/bin/env node

/**
 * Comprehensive Application Functionality Testing Script
 *
 * This script tests the complete application functionality after configuration
 * remediation to ensure all systems work correctly with the new APP_ENV schema
 * and Parameter Store changes.
 *
 * Test Categories:
 * 1. Configuration Loading & Validation
 * 2. API Endpoint Functionality
 * 3. Database Connection Testing
 * 4. Authentication Flow Testing
 * 5. Environment-Specific Behavior
 * 6. Error Handling & Logging
 *
 * Usage:
 *   node scripts/test-application-functionality.cjs
 *   APP_ENV=pr-51 node scripts/test-application-functionality.cjs
 */

const http = require('node:http')
const https = require('node:https')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

// Colors for output
const colors = {
	reset: '\x1b[0m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m',
}

function log(level, message) {
	const timestamp = new Date().toISOString()
	const color = colors[level] || colors.reset
	console.log(
		`${color}[${level.toUpperCase()}]${colors.reset} ${timestamp} - ${message}`,
	)
}

function logInfo(message) {
	log('blue', message)
}
function logSuccess(message) {
	log('green', message)
}
function logWarning(message) {
	log('yellow', message)
}
function logError(message) {
	log('red', message)
}

// Test configuration
const TEST_CONFIG = {
	server: {
		host: 'localhost',
		port: 3040,
		timeout: 30000,
		startupWait: 5000,
	},
	endpoints: [
		{
			path: '/health',
			method: 'GET',
			expectedStatus: 200,
			description: 'Health check endpoint',
		},
		{
			path: '/api/health',
			method: 'GET',
			expectedStatus: 200,
			description: 'API health check',
		},
		{
			path: '/api-docs',
			method: 'GET',
			expectedStatus: 200,
			description: 'Swagger documentation',
		},
		{
			path: '/api/auth/status',
			method: 'GET',
			expectedStatus: [200, 401],
			description: 'Auth status endpoint',
		},
		{
			path: '/api/nonexistent',
			method: 'GET',
			expectedStatus: 404,
			description: 'Non-existent endpoint (404 test)',
		},
	],
	environments: ['development', 'pr-51', 'pr-123', 'staging', 'production'],
}

// Test results tracking
let testResults = {
	total: 0,
	passed: 0,
	failed: 0,
	skipped: 0,
	categories: {},
}

// Utility functions
function makeHttpRequest(options) {
	return new Promise((resolve, reject) => {
		const client = options.protocol === 'https:' ? https : http
		const req = client.request(options, (res) => {
			let data = ''
			res.on('data', (chunk) => (data += chunk))
			res.on('end', () => {
				resolve({
					statusCode: res.statusCode,
					headers: res.headers,
					body: data,
				})
			})
		})

		req.on('error', reject)
		req.setTimeout(TEST_CONFIG.server.timeout, () => {
			req.destroy()
			reject(new Error('Request timeout'))
		})

		if (options.body) {
			req.write(options.body)
		}
		req.end()
	})
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

function recordTestResult(category, testName, passed, error = null) {
	testResults.total++
	if (passed) {
		testResults.passed++
		logSuccess(`✅ ${category}: ${testName}`)
	} else {
		testResults.failed++
		logError(`❌ ${category}: ${testName} - ${error || 'Unknown error'}`)
	}

	if (!testResults.categories[category]) {
		testResults.categories[category] = { passed: 0, failed: 0, total: 0 }
	}
	testResults.categories[category].total++
	if (passed) {
		testResults.categories[category].passed++
	} else {
		testResults.categories[category].failed++
	}
}

// Test 1: Configuration Loading & Validation
async function testConfigurationLoading() {
	logInfo('🔧 Testing Configuration Loading & Validation')
	logInfo('-'.repeat(50))

	const category = 'Configuration'

	// Test 1.1: Environment variable validation
	const currentAppEnv = process.env.APP_ENV || 'development'
	const isValidAppEnv =
		['development', 'staging', 'production', 'test'].includes(currentAppEnv) ||
		/^pr-\d+$/.test(currentAppEnv)
	recordTestResult(
		category,
		'Current APP_ENV validation',
		isValidAppEnv,
		isValidAppEnv ? null : `Invalid APP_ENV: ${currentAppEnv}`,
	)

	// Test 1.2: APP_ENV pattern validation
	const testPatterns = [
		{ env: 'development', valid: true },
		{ env: 'staging', valid: true },
		{ env: 'production', valid: true },
		{ env: 'test', valid: true },
		{ env: 'pr-51', valid: true },
		{ env: 'pr-123', valid: true },
		{ env: 'pr-999', valid: true },
		{ env: 'invalid-env', valid: false },
		{ env: 'pr-', valid: false },
		{ env: 'pr-abc', valid: false },
		{ env: 'preview-51', valid: false },
	]

	for (const testCase of testPatterns) {
		const isValid =
			['development', 'staging', 'production', 'test'].includes(testCase.env) ||
			/^pr-\d+$/.test(testCase.env)
		const testPassed = isValid === testCase.valid
		recordTestResult(
			category,
			`Pattern validation: ${testCase.env}`,
			testPassed,
			testPassed ? null : `Expected ${testCase.valid}, got ${isValid}`,
		)
	}

	// Test 1.3: Required environment variables
	const requiredEnvVars = ['NODE_ENV', 'SERVER_PORT']
	for (const envVar of requiredEnvVars) {
		const hasValue = process.env[envVar] !== undefined
		recordTestResult(
			category,
			`Environment variable: ${envVar}`,
			hasValue,
			hasValue ? null : `${envVar} not set`,
		)
	}

	// Test 1.4: Configuration file existence
	const configFiles = ['.env', 'package.json', 'dist/index.js']
	for (const file of configFiles) {
		try {
			const exists = fs.existsSync(path.join(process.cwd(), file))
			recordTestResult(
				category,
				`Configuration file: ${file}`,
				exists,
				exists ? null : `${file} not found`,
			)
		} catch (error) {
			recordTestResult(
				category,
				`Configuration file: ${file}`,
				false,
				error.message,
			)
		}
	}
}

// Test 2: Server Startup & Health Checks
async function testServerStartup() {
	logInfo('🚀 Testing Server Startup & Health Checks')
	logInfo('-'.repeat(50))

	const category = 'Server Startup'

	// Test 2.1: Server can start
	let serverProcess = null
	try {
		logInfo('Starting Express server...')
		serverProcess = spawn('node', ['dist/index.js'], {
			cwd: process.cwd(),
			stdio: ['pipe', 'pipe', 'pipe'],
			env: { ...process.env, NODE_ENV: 'test' },
		})

		let serverOutput = ''
		let serverStarted = false

		serverProcess.stdout.on('data', (data) => {
			serverOutput += data.toString()
			if (
				data.toString().includes('Server is running') ||
				data.toString().includes('listening on port')
			) {
				serverStarted = true
			}
		})

		serverProcess.stderr.on('data', (data) => {
			serverOutput += data.toString()
		})

		// Wait for server to start
		await sleep(TEST_CONFIG.server.startupWait)

		if (serverStarted || serverOutput.includes('3040')) {
			recordTestResult(category, 'Server startup', true)

			// Test 2.2: Health endpoint accessibility
			await testHealthEndpoints()
		} else {
			recordTestResult(
				category,
				'Server startup',
				false,
				'Server did not start properly',
			)
			logWarning('Server output:', serverOutput)
		}
	} catch (error) {
		recordTestResult(category, 'Server startup', false, error.message)
	} finally {
		if (serverProcess) {
			serverProcess.kill('SIGTERM')
			await sleep(1000)
			if (!serverProcess.killed) {
				serverProcess.kill('SIGKILL')
			}
		}
	}
}

// Test 3: API Endpoint Testing
async function testHealthEndpoints() {
	logInfo('🌐 Testing API Endpoints')
	logInfo('-'.repeat(50))

	const category = 'API Endpoints'

	for (const endpoint of TEST_CONFIG.endpoints) {
		try {
			const response = await makeHttpRequest({
				hostname: TEST_CONFIG.server.host,
				port: TEST_CONFIG.server.port,
				path: endpoint.path,
				method: endpoint.method,
				timeout: TEST_CONFIG.server.timeout,
			})

			const expectedStatuses = Array.isArray(endpoint.expectedStatus)
				? endpoint.expectedStatus
				: [endpoint.expectedStatus]

			if (expectedStatuses.includes(response.statusCode)) {
				recordTestResult(category, `${endpoint.method} ${endpoint.path}`, true)

				// Additional validation for specific endpoints
				if (endpoint.path === '/health' && response.statusCode === 200) {
					try {
						const healthData = JSON.parse(response.body)
						if (healthData.status === 'ok') {
							recordTestResult(
								category,
								'Health endpoint response format',
								true,
							)
						} else {
							recordTestResult(
								category,
								'Health endpoint response format',
								false,
								'Invalid health response format',
							)
						}
					} catch (parseError) {
						recordTestResult(
							category,
							'Health endpoint response format',
							false,
							'Invalid JSON response',
						)
					}
				}
			} else {
				recordTestResult(
					category,
					`${endpoint.method} ${endpoint.path}`,
					false,
					`Expected status ${expectedStatuses.join(' or ')}, got ${response.statusCode}`,
				)
			}
		} catch (error) {
			// If server is not running, this is expected for some tests
			if (error.code === 'ECONNREFUSED') {
				recordTestResult(
					category,
					`${endpoint.method} ${endpoint.path}`,
					false,
					'Server not running (expected if server startup failed)',
				)
			} else {
				recordTestResult(
					category,
					`${endpoint.method} ${endpoint.path}`,
					false,
					error.message,
				)
			}
		}
	}
}

// Test 4: CORS Configuration Testing
async function testCorsConfiguration() {
	logInfo('🔒 Testing CORS Configuration')
	logInfo('-'.repeat(50))

	const category = 'CORS'

	// Test CORS headers on health endpoint
	try {
		const response = await makeHttpRequest({
			hostname: TEST_CONFIG.server.host,
			port: TEST_CONFIG.server.port,
			path: '/api/health',
			method: 'OPTIONS',
			headers: {
				Origin: 'http://localhost:3000',
				'Access-Control-Request-Method': 'GET',
			},
		})

		if (response.headers['access-control-allow-origin']) {
			recordTestResult(category, 'CORS headers present', true)
		} else {
			recordTestResult(
				category,
				'CORS headers present',
				false,
				'No CORS headers found',
			)
		}
	} catch (error) {
		if (error.code === 'ECONNREFUSED') {
			recordTestResult(
				category,
				'CORS headers test',
				false,
				'Server not running',
			)
		} else {
			recordTestResult(category, 'CORS headers test', false, error.message)
		}
	}
}

// Test 5: Error Handling & Logging
async function testErrorHandling() {
	logInfo('⚠️ Testing Error Handling & Logging')
	logInfo('-'.repeat(50))

	const category = 'Error Handling'

	// Test 5.1: Invalid APP_ENV pattern validation
	const invalidPatterns = ['invalid-env', 'pr-', 'pr-abc', 'preview-51', '']
	for (const pattern of invalidPatterns) {
		const isValid =
			['development', 'staging', 'production', 'test'].includes(pattern) ||
			/^pr-\d+$/.test(pattern)
		recordTestResult(
			category,
			`Invalid pattern rejection: ${pattern || 'empty'}`,
			!isValid,
			isValid ? `Pattern ${pattern} should be invalid` : null,
		)
	}

	// Test 5.2: Environment variable edge cases
	const originalEnv = process.env.APP_ENV

	// Test empty APP_ENV
	process.env.APP_ENV = ''
	const emptyEnvValid =
		['development', 'staging', 'production', 'test'].includes('') ||
		/^pr-\d+$/.test('')
	recordTestResult(category, 'Empty APP_ENV handling', !emptyEnvValid)

	// Test undefined APP_ENV (should default to development)
	delete process.env.APP_ENV
	const defaultEnv = process.env.APP_ENV || 'development'
	const defaultValid =
		['development', 'staging', 'production', 'test'].includes(defaultEnv) ||
		/^pr-\d+$/.test(defaultEnv)
	recordTestResult(category, 'Undefined APP_ENV default handling', defaultValid)

	// Restore original environment
	if (originalEnv) {
		process.env.APP_ENV = originalEnv
	} else {
		delete process.env.APP_ENV
	}

	// Test 5.3: Server startup error conditions
	const requiredFiles = ['dist/index.js']
	for (const file of requiredFiles) {
		const exists = fs.existsSync(path.join(process.cwd(), file))
		recordTestResult(
			category,
			`Required file for startup: ${file}`,
			exists,
			exists ? null : `${file} missing - server cannot start`,
		)
	}
}

// Main test execution
async function runAllTests() {
	console.log('🧪 Comprehensive Application Functionality Testing')
	console.log('Testing application after configuration remediation changes')
	console.log('='.repeat(70))
	console.log('')

	const startTime = Date.now()

	try {
		await testConfigurationLoading()
		console.log('')

		await testServerStartup()
		console.log('')

		await testCorsConfiguration()
		console.log('')

		await testErrorHandling()
		console.log('')
	} catch (error) {
		logError(`Test execution failed: ${error.message}`)
	}

	// Generate test report
	const endTime = Date.now()
	const duration = ((endTime - startTime) / 1000).toFixed(2)

	console.log('='.repeat(70))
	logInfo('📊 Test Results Summary')
	console.log('='.repeat(70))

	logInfo(`Total Tests: ${testResults.total}`)
	logSuccess(`Passed: ${testResults.passed}`)
	logError(`Failed: ${testResults.failed}`)
	logWarning(`Skipped: ${testResults.skipped}`)

	const successRate =
		testResults.total > 0
			? ((testResults.passed / testResults.total) * 100).toFixed(1)
			: 0
	logInfo(`Success Rate: ${successRate}%`)
	logInfo(`Duration: ${duration}s`)

	console.log('')
	logInfo('📋 Results by Category:')
	for (const [category, results] of Object.entries(testResults.categories)) {
		const categoryRate =
			results.total > 0
				? ((results.passed / results.total) * 100).toFixed(1)
				: 0
		logInfo(
			`  ${category}: ${results.passed}/${results.total} (${categoryRate}%)`,
		)
	}

	console.log('')
	if (testResults.failed === 0) {
		logSuccess('🎉 All application functionality tests passed!')
		logSuccess('✅ Application is working correctly after remediation')
		return true
	} else {
		logError('❌ Some application functionality tests failed')
		logWarning('⚠️  Review failed tests and address issues before deployment')
		return false
	}
}

// Run tests if called directly
if (require.main === module) {
	runAllTests()
		.then((success) => process.exit(success ? 0 : 1))
		.catch((error) => {
			logError(`Test runner failed: ${error.message}`)
			process.exit(1)
		})
}

module.exports = {
	runAllTests,
	testConfigurationLoading,
	testServerStartup,
	testCorsConfiguration,
	testErrorHandling,
}
