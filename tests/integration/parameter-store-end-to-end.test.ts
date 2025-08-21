/**
 * End-to-End Parameter Store Integration Tests
 *
 * Tests the complete flow from AWS Parameter Store to application configuration:
 * - Setting up real AWS Parameter Store parameters in test environment
 * - Running the bootstrap script against these parameters
 * - Loading the resulting configuration in the Node.js application
 * - Verifying all expected configuration values are present and correctly typed
 */

import { execSync, spawn } from 'child_process'
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Test configuration
const TEST_CONFIG = {
	// AWS Configuration
	region: process.env.AWS_REGION ?? 'us-east-1',

	// Test environment prefix
	testEnvironment: 'integration-test',
	parameterPrefix: '/macro-ai/integration-test/',

	// Bootstrap script path
	scriptPath: join(
		process.cwd(),
		'../../infrastructure/scripts/bootstrap-ec2-config.sh',
	),

	// Test directories
	testDir: join(tmpdir(), 'macro-ai-e2e-tests'),

	// Complete test parameters matching production requirements
	testParameters: {
		API_KEY: 'integration-test-api-key-12345678901234567890',
		AWS_COGNITO_REGION: 'us-east-1',
		AWS_COGNITO_USER_POOL_ID: 'us-east-1_TestPool123',
		AWS_COGNITO_USER_POOL_CLIENT_ID: 'test-client-id-123456789',
		AWS_COGNITO_USER_POOL_SECRET_KEY:
			'test-pool-secret-key-32-characters-long-string',
		AWS_COGNITO_ACCESS_KEY: 'AKIATEST123456789012',
		AWS_COGNITO_SECRET_KEY: 'test-secret-key-40-characters-long-string-here',
		AWS_COGNITO_REFRESH_TOKEN_EXPIRY: '30',
		OPENAI_API_KEY: 'sk-test-openai-key-48-characters-long-string-here-123456',
		RELATIONAL_DATABASE_URL:
			'postgresql://testuser:testpass@test-db.amazonaws.com:5432/testdb',
		NON_RELATIONAL_DATABASE_URL: 'redis://test-redis.amazonaws.com:6379',
		COOKIE_ENCRYPTION_KEY: 'test-cookie-encryption-key-32-chars-long-string',
		COOKIE_DOMAIN: 'test.macro-ai.com',
		CORS_ALLOWED_ORIGINS:
			'https://test.macro-ai.com,https://staging.macro-ai.com',
		RATE_LIMIT_WINDOW_MS: '900000',
		RATE_LIMIT_MAX_REQUESTS: '100',
		AUTH_RATE_LIMIT_WINDOW_MS: '900000',
		AUTH_RATE_LIMIT_MAX_REQUESTS: '5',
		API_RATE_LIMIT_WINDOW_MS: '60000',
		API_RATE_LIMIT_MAX_REQUESTS: '1000',
		REDIS_URL: 'redis://test-redis.amazonaws.com:6379/1',
	},
}

// Test utilities
const E2ETestUtils = {
	setupParameterStore: (): void => {
		console.log('Setting up Parameter Store parameters for integration test...')

		for (const [key, value] of Object.entries(TEST_CONFIG.testParameters)) {
			const parameterName = `${TEST_CONFIG.parameterPrefix}${key}`

			try {
				execSync(
					`aws ssm put-parameter --name "${parameterName}" --value "${value}" --type "String" --overwrite --region ${TEST_CONFIG.region}`,
					{ stdio: 'pipe' },
				)
			} catch (error) {
				console.error(`Failed to create parameter ${parameterName}:`, error)
				throw error
			}
		}

		console.log(
			`Created ${Object.keys(TEST_CONFIG.testParameters).length.toString()} parameters in Parameter Store`,
		)
	},

	cleanupParameterStore: (): void => {
		console.log('Cleaning up Parameter Store parameters...')

		try {
			// Get all parameters under the test prefix
			const listResult = execSync(
				`aws ssm get-parameters-by-path --path "${TEST_CONFIG.parameterPrefix}" --region ${TEST_CONFIG.region} --query "Parameters[].Name" --output text`,
				{ stdio: 'pipe', encoding: 'utf-8' },
			)

			const parameterNames = listResult
				.trim()
				.split(/\s+/)
				.filter((name) => name.length > 0)

			if (parameterNames.length > 0) {
				// Delete parameters in batches (AWS limit is 10 per call)
				const batchSize = 10
				for (let i = 0; i < parameterNames.length; i += batchSize) {
					const batch = parameterNames.slice(i, i + batchSize)
					const namesArg = batch.join(' ')

					execSync(
						`aws ssm delete-parameters --names ${namesArg} --region ${TEST_CONFIG.region}`,
						{ stdio: 'pipe' },
					)
				}

				console.log(
					`Deleted ${parameterNames.length.toString()} parameters from Parameter Store`,
				)
			}
		} catch (error: unknown) {
			// Ignore errors - parameters might not exist
			console.log(
				`No parameters to clean up or cleanup failed (this is expected for first run) - ${error instanceof Error ? error.message : 'Unknown error'}`,
			)
		}
	},

	runBootstrapScript: async (
		envFile: string,
	): Promise<{ success: boolean; output: string; error: string }> => {
		return new Promise((resolve) => {
			const child = spawn(
				'bash',
				[
					TEST_CONFIG.scriptPath,
					'--app-env',
					TEST_CONFIG.testEnvironment,
					'--region',
					TEST_CONFIG.region,
					'--env-file',
					envFile,
					'--verbose',
				],
				{
					stdio: 'pipe',
				},
			)

			let stdout = ''
			let stderr = ''

			child.stdout.on('data', (data: Buffer) => {
				stdout += data.toString()
			})

			child.stderr.on('data', (data: Buffer) => {
				stderr += data.toString()
			})

			child.on('close', (code) => {
				resolve({
					success: code === 0,
					output: stdout,
					error: stderr,
				})
			})
		})
	},

	parseEnvFile: (filePath: string): Record<string, string> => {
		const content = readFileSync(filePath, 'utf-8')
		const env: Record<string, string> = {}

		for (const line of content.split('\n')) {
			const trimmed = line.trim()
			if (trimmed && !trimmed.startsWith('#')) {
				const [key, ...valueParts] = trimmed.split('=')
				if (key && valueParts.length > 0) {
					env[key] = valueParts.join('=')
				}
			}
		}

		return env
	},

	testApplicationConfiguration: async (
		envFile: string,
	): Promise<{ success: boolean; config?: any; error?: string }> => {
		// Set environment variables from the generated file
		const envVars = E2ETestUtils.parseEnvFile(envFile)
		const originalEnv = { ...process.env }

		try {
			// Apply environment variables
			for (const [key, value] of Object.entries(envVars)) {
				process.env[key] = value
			}

			// Clear module cache to ensure fresh import
			const modulePath = '../../apps/express-api/src/config/simple-config.js'
			const resolvedPath = require.resolve(modulePath)
			if (resolvedPath in require.cache) {
				require.cache[resolvedPath] = undefined
			}

			// Import and test configuration
			const configModule = await import(modulePath)
			const config = configModule.assertConfig()

			return { success: true, config }
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}
		} finally {
			// Restore original environment
			for (const key of Object.keys(envVars)) {
				if (originalEnv[key] === undefined) {
					process.env[key] = undefined
				} else {
					process.env[key] = originalEnv[key]
				}
			}
		}
	},
}

describe('End-to-End Parameter Store Integration Tests', () => {
	beforeAll(() => {
		// Create test directory
		if (!existsSync(TEST_CONFIG.testDir)) {
			mkdirSync(TEST_CONFIG.testDir, { recursive: true })
		}

		// Verify prerequisites
		if (!existsSync(TEST_CONFIG.scriptPath)) {
			throw new Error(
				`Bootstrap script not found at: ${TEST_CONFIG.scriptPath}`,
			)
		}

		try {
			execSync('aws --version', { stdio: 'pipe' })
		} catch (error: unknown) {
			throw new Error(
				`AWS CLI is not available. Please install and configure AWS CLI. Error: ${error instanceof Error ? error.message : String(error)}`,
			)
		}

		try {
			execSync('aws sts get-caller-identity', { stdio: 'pipe' })
		} catch (error: unknown) {
			throw new Error(
				`AWS credentials not configured. Please configure AWS credentials. Error: ${error instanceof Error ? error.message : String(error)}`,
			)
		}

		// Setup Parameter Store for testing
		E2ETestUtils.setupParameterStore()
	})

	afterAll(() => {
		// Cleanup Parameter Store
		E2ETestUtils.cleanupParameterStore()
	})

	describe('Complete Parameter Store to Application Flow', () => {
		it('should successfully complete the full parameter store to application configuration flow', async () => {
			const envFile = join(TEST_CONFIG.testDir, 'integration-test.env')

			try {
				// Step 1: Run bootstrap script to fetch parameters and create environment file
				const bootstrapResult = await E2ETestUtils.runBootstrapScript(envFile)

				expect(bootstrapResult.success).toBe(true)
				expect(bootstrapResult.output).toContain(
					'Configuration bootstrap completed successfully',
				)
				expect(existsSync(envFile)).toBe(true)

				// Step 2: Verify environment file contains all expected parameters
				const envVars = E2ETestUtils.parseEnvFile(envFile)

				for (const [key, expectedValue] of Object.entries(
					TEST_CONFIG.testParameters,
				)) {
					expect(envVars).toHaveProperty(key)
					expect(envVars[key]).toBe(expectedValue)
				}

				// Verify additional environment variables
				expect(envVars.NODE_ENV).toBe('production')
				expect(envVars.APP_ENV).toBe(TEST_CONFIG.testEnvironment)

				// Step 3: Test application configuration loading
				const configResult =
					await E2ETestUtils.testApplicationConfiguration(envFile)

				expect(configResult.success).toBe(true)
				expect(configResult.config).toBeDefined()

				if (configResult.config) {
					// Verify camelCase conversion and type conversion
					expect(configResult.config.apiKey).toBe(
						TEST_CONFIG.testParameters.API_KEY,
					)
					expect(configResult.config.nodeEnv).toBe('production')
					expect(configResult.config.appEnv).toBe(TEST_CONFIG.testEnvironment)
					expect(configResult.config.awsCognitoRegion).toBe(
						TEST_CONFIG.testParameters.AWS_COGNITO_REGION,
					)
					expect(configResult.config.awsCognitoRefreshTokenExpiry).toBe(30) // Should be converted to number
					expect(configResult.config.relationalDatabaseUrl).toBe(
						TEST_CONFIG.testParameters.RELATIONAL_DATABASE_URL,
					)
					expect(configResult.config.corsAllowedOrigins).toBe(
						TEST_CONFIG.testParameters.CORS_ALLOWED_ORIGINS,
					)
				}
			} finally {
				// Cleanup
				if (existsSync(envFile)) {
					unlinkSync(envFile)
				}
			}
		}, 60000) // 60 second timeout for AWS operations

		it('should handle partial parameter availability gracefully', async () => {
			// Remove some parameters to test partial availability
			const partialParams = ['API_KEY', 'AWS_COGNITO_REGION', 'OPENAI_API_KEY']

			// Delete some parameters
			for (const param of partialParams) {
				const parameterName = `${TEST_CONFIG.parameterPrefix}${param}`
				try {
					execSync(
						`aws ssm delete-parameter --name "${parameterName}" --region ${TEST_CONFIG.region}`,
						{ stdio: 'pipe' },
					)
				} catch (error: unknown) {
					// Ignore if parameter doesn't exist
					if (
						error instanceof Error &&
						error.message.includes('ParameterNotFound')
					) {
						continue
					}
					throw error
				}
			}

			const envFile = join(TEST_CONFIG.testDir, 'partial-test.env')

			try {
				// Run bootstrap script - should succeed but with fewer parameters
				const bootstrapResult = await E2ETestUtils.runBootstrapScript(envFile)

				expect(bootstrapResult.success).toBe(true)
				expect(existsSync(envFile)).toBe(true)

				// Verify environment file contains remaining parameters
				const envVars = E2ETestUtils.parseEnvFile(envFile)

				// Should have parameters that weren't deleted
				const remainingParams = Object.keys(TEST_CONFIG.testParameters).filter(
					(key) => !partialParams.includes(key),
				)

				for (const key of remainingParams) {
					expect(envVars).toHaveProperty(key)
				}

				// Should not have deleted parameters
				for (const key of partialParams) {
					expect(envVars).not.toHaveProperty(key)
				}
			} finally {
				// Cleanup
				if (existsSync(envFile)) {
					unlinkSync(envFile)
				}

				// Restore deleted parameters for other tests
				for (const param of partialParams) {
					const parameterName = `${TEST_CONFIG.parameterPrefix}${param}`
					const value =
						TEST_CONFIG.testParameters[
							param as keyof typeof TEST_CONFIG.testParameters
						]

					execSync(
						`aws ssm put-parameter --name "${parameterName}" --value "${value}" --type "String" --overwrite --region ${TEST_CONFIG.region}`,
						{ stdio: 'pipe' },
					)
				}
			}
		}, 60000)

		it('should validate environment file format and permissions', async () => {
			const envFile = join(TEST_CONFIG.testDir, 'format-test.env')

			try {
				const bootstrapResult = await E2ETestUtils.runBootstrapScript(envFile)

				expect(bootstrapResult.success).toBe(true)
				expect(existsSync(envFile)).toBe(true)

				// Read and validate file format
				const content = readFileSync(envFile, 'utf-8')
				const lines = content.split('\n')

				// Should have header comments
				expect(lines[0]).toContain(
					'# Auto-generated environment file for macro-ai',
				)
				expect(content).toContain('# Generated at:')
				expect(content).toContain(
					`# App Environment: ${TEST_CONFIG.testEnvironment}`,
				)
				expect(content).toContain('# Parameter Store Prefix:')

				// Should have proper key=value format
				const envVars = E2ETestUtils.parseEnvFile(envFile)
				expect(Object.keys(envVars).length).toBeGreaterThan(0)

				// All values should be strings (no quotes, proper escaping)
				for (const [key, value] of Object.entries(envVars)) {
					expect(typeof value).toBe('string')
					expect(value.length).toBeGreaterThan(0)
					expect(key).toMatch(/^[A-Z_]+$/) // Should be uppercase with underscores
				}
			} finally {
				if (existsSync(envFile)) {
					unlinkSync(envFile)
				}
			}
		}, 60000)
	})

	describe('Error Scenarios', () => {
		it('should handle Parameter Store access errors gracefully', async () => {
			// Temporarily break AWS credentials
			const originalAccessKey = process.env.AWS_ACCESS_KEY_ID
			const originalSecretKey = process.env.AWS_SECRET_ACCESS_KEY

			process.env.AWS_ACCESS_KEY_ID = 'invalid-key'
			process.env.AWS_SECRET_ACCESS_KEY = 'invalid-secret'

			const envFile = join(TEST_CONFIG.testDir, 'error-test.env')

			try {
				const bootstrapResult = await E2ETestUtils.runBootstrapScript(envFile)

				expect(bootstrapResult.success).toBe(false)
				expect(bootstrapResult.error).toContain(
					'AWS credentials not configured',
				)
				expect(existsSync(envFile)).toBe(false)
			} finally {
				// Restore original credentials
				if (originalAccessKey) {
					process.env.AWS_ACCESS_KEY_ID = originalAccessKey
				} else {
					delete process.env.AWS_ACCESS_KEY_ID
				}

				if (originalSecretKey) {
					process.env.AWS_SECRET_ACCESS_KEY = originalSecretKey
				} else {
					delete process.env.AWS_SECRET_ACCESS_KEY
				}

				if (existsSync(envFile)) {
					unlinkSync(envFile)
				}
			}
		}, 30000)

		it('should handle non-existent parameter paths', async () => {
			const envFile = join(TEST_CONFIG.testDir, 'nonexistent-test.env')

			try {
				// Run bootstrap script with non-existent environment
				const child = spawn(
					'bash',
					[
						TEST_CONFIG.scriptPath,
						'--app-env',
						'non-existent-environment',
						'--region',
						TEST_CONFIG.region,
						'--env-file',
						envFile,
						'--verbose',
					],
					{
						stdio: 'pipe',
					},
				)

				let stdout = ''

				child.stdout.on('data', (data: Buffer) => {
					stdout += data.toString()
				})

				child.stderr.on('data', () => {
					// Ignore stderr for this test
				})

				const exitCode = await new Promise<number>((resolve) => {
					child.on('close', (code) => {
						resolve(code ?? 0)
					})
				})

				// Should succeed but create empty or minimal environment file
				expect(exitCode).toBe(0)
				expect(stdout).toContain('Retrieved 0 environment variables')

				if (existsSync(envFile)) {
					const envVars = E2ETestUtils.parseEnvFile(envFile)
					// Should only have the basic environment variables
					expect(envVars.NODE_ENV).toBe('production')
					expect(envVars.APP_ENV).toBe('non-existent-environment')
				}
			} finally {
				if (existsSync(envFile)) {
					unlinkSync(envFile)
				}
			}
		}, 30000)
	})
})
