#!/usr/bin/env node

/**
 * CORS Configuration Validation Script
 *
 * This script tests CORS configuration for preview environments to ensure
 * that custom domain URLs work correctly after APP_ENV schema changes.
 *
 * Tests:
 * 1. Preview environment detection (pr-* patterns)
 * 2. Custom domain origin generation
 * 3. CORS origin validation logic
 * 4. Pattern matching for preview domains
 * 5. Environment variable parsing
 *
 * Usage:
 *   node scripts/test-cors-configuration.js
 *   APP_ENV=pr-51 CUSTOM_DOMAIN_NAME=macro-ai.russoakham.dev node scripts/test-cors-configuration.js
 */

const path = require('path')

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

// Test configuration scenarios
const testScenarios = [
	{
		name: 'Preview Environment - PR-51 with Custom Domain',
		env: {
			APP_ENV: 'pr-51',
			PR_NUMBER: '51',
			CUSTOM_DOMAIN_NAME: 'macro-ai.russoakham.dev',
			CORS_ALLOWED_ORIGINS:
				'http://localhost:5173,http://localhost:3000,https://pr-51.macro-ai.russoakham.dev',
		},
		expectedOrigins: [
			'http://localhost:5173',
			'http://localhost:3000',
			'https://pr-51.macro-ai.russoakham.dev',
			'https://pr-51.macro-ai.russoakham.dev', // Frontend
			'https://pr-51-api.macro-ai.russoakham.dev', // API
		],
		testOrigins: [
			{ origin: 'https://pr-51.macro-ai.russoakham.dev', shouldAllow: true },
			{
				origin: 'https://pr-51-api.macro-ai.russoakham.dev',
				shouldAllow: true,
			},
			{ origin: 'https://pr-52.macro-ai.russoakham.dev', shouldAllow: true }, // Pattern match
			{ origin: 'https://malicious.com', shouldAllow: false },
			{ origin: 'http://localhost:3000', shouldAllow: true },
		],
	},
	{
		name: 'Preview Environment - PR-123 without Custom Domain',
		env: {
			APP_ENV: 'pr-123',
			PR_NUMBER: '123',
			CORS_ALLOWED_ORIGINS: '',
		},
		expectedOrigins: ['http://localhost:3000', 'http://localhost:3040'],
		testOrigins: [
			{ origin: 'http://localhost:3000', shouldAllow: true },
			{ origin: 'http://localhost:3040', shouldAllow: true },
			{ origin: 'https://pr-123.macro-ai.russoakham.dev', shouldAllow: false }, // No custom domain
			{ origin: 'https://malicious.com', shouldAllow: false },
		],
	},
	{
		name: 'Development Environment',
		env: {
			APP_ENV: 'development',
			CORS_ALLOWED_ORIGINS: 'http://localhost:3000,http://localhost:5173',
		},
		expectedOrigins: ['http://localhost:3000', 'http://localhost:5173'],
		testOrigins: [
			{ origin: 'http://localhost:3000', shouldAllow: true },
			{ origin: 'http://localhost:5173', shouldAllow: true },
			{ origin: 'https://pr-51.macro-ai.russoakham.dev', shouldAllow: false },
			{ origin: 'https://malicious.com', shouldAllow: false },
		],
	},
	{
		name: 'Production Environment with Custom Domain',
		env: {
			APP_ENV: 'production',
			CUSTOM_DOMAIN_NAME: 'macro-ai.russoakham.dev',
			CORS_ALLOWED_ORIGINS: 'https://macro-ai.russoakham.dev',
		},
		expectedOrigins: [
			'https://macro-ai.russoakham.dev',
			'https://macro-ai.russoakham.dev', // Production frontend
			'https://staging.macro-ai.russoakham.dev', // Staging frontend
			'https://api.macro-ai.russoakham.dev', // Production API
			'https://staging-api.macro-ai.russoakham.dev', // Staging API
		],
		testOrigins: [
			{ origin: 'https://macro-ai.russoakham.dev', shouldAllow: true },
			{ origin: 'https://api.macro-ai.russoakham.dev', shouldAllow: true },
			{ origin: 'https://staging.macro-ai.russoakham.dev', shouldAllow: true },
			{ origin: 'https://pr-51.macro-ai.russoakham.dev', shouldAllow: false },
			{ origin: 'https://malicious.com', shouldAllow: false },
		],
	},
]

// Mock the CORS logic from server.ts
function simulateCorsLogic(env) {
	const rawEnv = env.CORS_ALLOWED_ORIGINS ?? ''
	const appEnv = env.APP_ENV ?? ''
	const isPreview = appEnv.startsWith('pr-')

	const parsedCorsOrigins = rawEnv
		.split(',')
		.map((o) => o.trim())
		.filter((o) => o.length > 0)
		.map((o) => (o.endsWith('/') ? o.replace(/\/+$/, '') : o))

	// Get custom domain from environment variables
	const customDomainName = env.CUSTOM_DOMAIN_NAME

	// Pattern-based CORS matching for preview environments with custom domains
	const isCustomDomainPreview = isPreview && customDomainName
	const previewDomainPattern = isCustomDomainPreview
		? new RegExp(`^https://pr-\\d+\\.${customDomainName.replace('.', '\\.')}$`)
		: null

	// Add custom domain origins for preview environments
	const customDomainOrigins =
		isPreview && env.PR_NUMBER && customDomainName
			? [
					`https://pr-${env.PR_NUMBER}.${customDomainName}`, // Frontend
					`https://pr-${env.PR_NUMBER}-api.${customDomainName}`, // API
				]
			: []

	// Add production and staging origins (only if custom domain is configured)
	const productionOrigins = customDomainName
		? [
				`https://${customDomainName}`, // Production frontend
				`https://staging.${customDomainName}`, // Staging frontend
				`https://api.${customDomainName}`, // Production API
				`https://staging-api.${customDomainName}`, // Staging API
			]
		: []

	const effectiveOrigins =
		parsedCorsOrigins.length > 0
			? [...parsedCorsOrigins, ...customDomainOrigins, ...productionOrigins]
			: [
					'http://localhost:3000',
					'http://localhost:3040',
					...customDomainOrigins,
					...productionOrigins,
				]

	// CORS origin validation function
	const validateOrigin = (origin) => {
		if (!origin) {
			return { allowed: true, reason: 'null origin (REST tools/same-origin)' }
		}

		// Normalize by stripping trailing slashes
		const normalized = origin.replace(/\/+$/, '')

		// Check explicit allowed origins first
		const allowedSet = new Set(
			effectiveOrigins.map((o) => o.replace(/\/+$/, '')),
		)

		if (allowedSet.has(normalized)) {
			return { allowed: true, reason: 'explicit allowed origin' }
		}

		// For preview environments with custom domains, use pattern matching
		if (previewDomainPattern?.test(normalized)) {
			return { allowed: true, reason: 'preview domain pattern match' }
		}

		return {
			allowed: false,
			reason: 'not in allowed list and no pattern match',
		}
	}

	return {
		appEnv,
		isPreview,
		isCustomDomainPreview,
		previewDomainPattern,
		parsedCorsOrigins,
		customDomainOrigins,
		productionOrigins,
		effectiveOrigins,
		validateOrigin,
	}
}

// Run tests
function runTests() {
	logInfo('🧪 Starting CORS Configuration Validation Tests')
	logInfo('='.repeat(60))

	let totalTests = 0
	let passedTests = 0
	let failedTests = 0

	for (const scenario of testScenarios) {
		logInfo(`\n📋 Testing Scenario: ${scenario.name}`)
		logInfo('-'.repeat(40))

		// Set environment variables
		const originalEnv = { ...process.env }
		Object.assign(process.env, scenario.env)

		try {
			// Simulate CORS logic
			const corsConfig = simulateCorsLogic(scenario.env)

			// Log configuration details
			logInfo(
				`Environment: ${corsConfig.appEnv} (isPreview: ${corsConfig.isPreview})`,
			)
			logInfo(`Custom Domain Preview: ${corsConfig.isCustomDomainPreview}`)
			logInfo(
				`Pattern: ${corsConfig.previewDomainPattern?.toString() || 'null'}`,
			)
			logInfo(`Effective Origins: [${corsConfig.effectiveOrigins.join(', ')}]`)

			// Test each origin
			for (const testCase of scenario.testOrigins) {
				totalTests++
				const result = corsConfig.validateOrigin(testCase.origin)
				const passed = result.allowed === testCase.shouldAllow

				if (passed) {
					passedTests++
					logSuccess(
						`✅ ${testCase.origin} - ${result.allowed ? 'ALLOWED' : 'DENIED'} (${result.reason})`,
					)
				} else {
					failedTests++
					logError(
						`❌ ${testCase.origin} - Expected ${testCase.shouldAllow ? 'ALLOWED' : 'DENIED'}, got ${result.allowed ? 'ALLOWED' : 'DENIED'} (${result.reason})`,
					)
				}
			}
		} catch (error) {
			logError(`Test scenario failed: ${error.message}`)
			failedTests += scenario.testOrigins.length
			totalTests += scenario.testOrigins.length
		} finally {
			// Restore original environment
			process.env = originalEnv
		}
	}

	// Summary
	logInfo('\n' + '='.repeat(60))
	logInfo('📊 Test Results Summary')
	logInfo('='.repeat(60))
	logInfo(`Total Tests: ${totalTests}`)
	logSuccess(`Passed: ${passedTests}`)
	if (failedTests > 0) {
		logError(`Failed: ${failedTests}`)
	} else {
		logError(`Failed: ${failedTests}`)
	}

	const successRate =
		totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0
	logInfo(`Success Rate: ${successRate}%`)

	if (failedTests === 0) {
		logSuccess('\n🎉 All CORS configuration tests passed!')
		logSuccess('✅ Preview domains will work correctly with APP_ENV changes')
		return true
	} else {
		logError('\n❌ Some CORS configuration tests failed')
		logError('⚠️  Preview domains may not work correctly')
		return false
	}
}

// Additional validation tests
function runAdditionalValidations() {
	logInfo('\n🔍 Running Additional Validations')
	logInfo('='.repeat(60))

	const validations = [
		{
			name: 'APP_ENV Schema Compatibility',
			test: () => {
				// Test that pr-* patterns are valid
				const prPatterns = ['pr-1', 'pr-51', 'pr-123', 'pr-999']
				const regex = /^pr-\d+$/

				for (const pattern of prPatterns) {
					if (!regex.test(pattern)) {
						throw new Error(`Pattern ${pattern} should match pr-* regex`)
					}
				}

				// Test invalid patterns
				const invalidPatterns = ['pr-', 'pr-abc', 'preview-51', 'pr51']
				for (const pattern of invalidPatterns) {
					if (regex.test(pattern)) {
						throw new Error(`Pattern ${pattern} should NOT match pr-* regex`)
					}
				}

				return true
			},
		},
		{
			name: 'Custom Domain Pattern Generation',
			test: () => {
				const domain = 'macro-ai.russoakham.dev'
				const expectedPattern =
					'^https://pr-\\d+\\.macro-ai\\.russoakham\\.dev$'
				const actualPattern = `^https://pr-\\d+\\.${domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`

				if (actualPattern !== expectedPattern) {
					throw new Error(
						`Pattern mismatch: expected ${expectedPattern}, got ${actualPattern}`,
					)
				}

				// Test the pattern works
				const regex = new RegExp(actualPattern)
				const testUrls = [
					{ url: 'https://pr-51.macro-ai.russoakham.dev', shouldMatch: true },
					{ url: 'https://pr-123.macro-ai.russoakham.dev', shouldMatch: true },
					{ url: 'https://pr-51.malicious.com', shouldMatch: false },
					{
						url: 'https://malicious-pr-51.macro-ai.russoakham.dev',
						shouldMatch: false,
					},
				]

				for (const testUrl of testUrls) {
					const matches = regex.test(testUrl.url)
					if (matches !== testUrl.shouldMatch) {
						throw new Error(
							`URL ${testUrl.url} should ${testUrl.shouldMatch ? 'match' : 'not match'} pattern`,
						)
					}
				}

				return true
			},
		},
		{
			name: 'Environment Variable Parsing',
			test: () => {
				// Test CORS_ALLOWED_ORIGINS parsing
				const testCases = [
					{
						input: 'http://localhost:3000,https://example.com',
						expected: ['http://localhost:3000', 'https://example.com'],
					},
					{
						input: ' http://localhost:3000 , https://example.com/ ',
						expected: ['http://localhost:3000', 'https://example.com'],
					},
					{
						input: '',
						expected: [],
					},
					{
						input: 'http://localhost:3000,,https://example.com',
						expected: ['http://localhost:3000', 'https://example.com'],
					},
				]

				for (const testCase of testCases) {
					const parsed = testCase.input
						.split(',')
						.map((o) => o.trim())
						.filter((o) => o.length > 0)
						.map((o) => (o.endsWith('/') ? o.replace(/\/+$/, '') : o))

					if (JSON.stringify(parsed) !== JSON.stringify(testCase.expected)) {
						throw new Error(
							`Parsing failed for "${testCase.input}": expected ${JSON.stringify(testCase.expected)}, got ${JSON.stringify(parsed)}`,
						)
					}
				}

				return true
			},
		},
	]

	let validationsPassed = 0
	let validationsFailed = 0

	for (const validation of validations) {
		try {
			validation.test()
			logSuccess(`✅ ${validation.name}`)
			validationsPassed++
		} catch (error) {
			logError(`❌ ${validation.name}: ${error.message}`)
			validationsFailed++
		}
	}

	logInfo(
		`\nAdditional Validations: ${validationsPassed} passed, ${validationsFailed} failed`,
	)
	return validationsFailed === 0
}

// Main execution
function main() {
	console.log('🚀 CORS Configuration Validation Script')
	console.log(
		'Testing CORS configuration for preview environments after APP_ENV schema changes\n',
	)

	const testsPass = runTests()
	const validationsPass = runAdditionalValidations()

	if (testsPass && validationsPass) {
		logSuccess('\n🎉 All tests and validations passed!')
		logSuccess('✅ CORS configuration is working correctly for preview domains')
		process.exit(0)
	} else {
		logError('\n❌ Some tests or validations failed')
		logError('⚠️  CORS configuration may need attention')
		process.exit(1)
	}
}

// Run the script
if (require.main === module) {
	main()
}

module.exports = {
	simulateCorsLogic,
	runTests,
	runAdditionalValidations,
}
