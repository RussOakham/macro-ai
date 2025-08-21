/**
 * Bootstrap Script Integration Tests
 *
 * Tests the bootstrap-ec2-config.sh script functionality including:
 * - Parameter fetching from AWS Parameter Store
 * - Environment file creation and formatting
 * - Error handling for missing parameters or credentials
 * - Environment-specific parameter mapping
 */

import { execSync, spawn } from 'child_process'
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

// Test configuration
const TEST_CONFIG = {
	// AWS Configuration
	region: process.env.AWS_REGION ?? 'us-east-1',

	// Test environments
	environments: ['development', 'staging', 'production', 'pr-123'],

	// Bootstrap script path (test version without sudo requirements)
	scriptPath: join(process.cwd(), 'bootstrap-ec2-config-test.sh'),

	// Test directories
	testDir: join(tmpdir(), 'macro-ai-bootstrap-tests'),

	// Mock environment file path (avoid sudo requirements)
	mockEnvFile: join(tmpdir(), 'macro-ai-bootstrap-tests', 'mock-macro-ai.env'),

	// Required parameters for testing
	requiredParams: [
		'API_KEY',
		'AWS_COGNITO_REGION',
		'AWS_COGNITO_USER_POOL_ID',
		'AWS_COGNITO_USER_POOL_CLIENT_ID',
		'AWS_COGNITO_USER_POOL_SECRET_KEY',
		'AWS_COGNITO_ACCESS_KEY',
		'AWS_COGNITO_SECRET_KEY',
		'AWS_COGNITO_REFRESH_TOKEN_EXPIRY',
		'OPENAI_API_KEY',
		'RELATIONAL_DATABASE_URL',
		'NON_RELATIONAL_DATABASE_URL',
		'COOKIE_ENCRYPTION_KEY',
		'COOKIE_DOMAIN',
	],
}

// Test utilities
const BootstrapTestUtils = {
	createTestParameterStore: (
		environment: string,
		params: Record<string, string>,
	) => {
		const prefix = environment.startsWith('pr-')
			? '/macro-ai/development/'
			: `/macro-ai/${environment}/`

		const commands: string[] = []

		for (const [key, value] of Object.entries(params)) {
			const paramName = `${prefix}${key}`
			commands.push(
				`aws ssm put-parameter --name "${paramName}" --value "${value}" --type "String" --overwrite --region ${TEST_CONFIG.region}`,
			)
		}

		return commands
	},

	cleanupTestParameters: (environment: string) => {
		const prefix = environment.startsWith('pr-')
			? '/macro-ai/development/'
			: `/macro-ai/${environment}/`

		try {
			execSync(
				`aws ssm get-parameters-by-path --path "${prefix}" --region ${TEST_CONFIG.region} --query "Parameters[].Name" --output text | xargs -r aws ssm delete-parameters --names --region ${TEST_CONFIG.region}`,
				{ stdio: 'pipe', timeout: 15000 },
			)
		} catch (error: unknown) {
			// Ignore errors - parameters might not exist
			console.log(
				`No parameters to clean up or cleanup failed (this is expected for first run - ${(error as Error).message})`,
			)
		}
	},

	runBootstrapScript: (options: {
		appEnv: string
		envFile?: string
		dryRun?: boolean
		verbose?: boolean
	}): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
		return new Promise((resolve, reject) => {
			const args = ['--app-env', options.appEnv, '--region', TEST_CONFIG.region]

			// Always use a test environment file to avoid sudo requirements
			const envFile = options.envFile ?? TEST_CONFIG.mockEnvFile
			args.push('--env-file', envFile)

			if (options.dryRun) {
				args.push('--dry-run')
			}

			if (options.verbose) {
				args.push('--verbose')
			}

			const child = spawn('bash', [TEST_CONFIG.scriptPath, ...args], {
				stdio: 'pipe',
			})

			let stdout = ''
			let stderr = ''

			// Set a timeout to prevent hanging
			const timeout = setTimeout(() => {
				child.kill('SIGTERM')
				reject(new Error('Bootstrap script timed out after 25 seconds'))
			}, 25000)

			child.stdout.on('data', (data: Buffer) => {
				stdout += data.toString()
			})

			child.stderr.on('data', (data: Buffer) => {
				stderr += data.toString()
			})

			child.on('close', (code) => {
				clearTimeout(timeout)
				resolve({
					stdout,
					stderr,
					exitCode: code ?? 0,
				})
			})

			child.on('error', (error) => {
				clearTimeout(timeout)
				reject(error)
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
}

describe.skip('Bootstrap Script Integration Tests', () => {
	beforeAll(() => {
		// Create test directory
		if (!existsSync(TEST_CONFIG.testDir)) {
			mkdirSync(TEST_CONFIG.testDir, { recursive: true })
		}

		// Verify bootstrap script exists
		if (!existsSync(TEST_CONFIG.scriptPath)) {
			throw new Error(
				`Bootstrap script not found at: ${TEST_CONFIG.scriptPath}`,
			)
		}

		// Verify AWS CLI is available
		try {
			execSync('aws --version', { stdio: 'pipe', timeout: 5000 })
		} catch (error: unknown) {
			throw new Error(
				`AWS CLI is not available. Please install and configure AWS CLI. Error: ${
					(error as Error).message
				}`,
			)
		}

		// Verify AWS credentials
		try {
			execSync('aws sts get-caller-identity', { stdio: 'pipe', timeout: 10000 })
		} catch (error: unknown) {
			throw new Error(
				`AWS credentials not configured. Please configure AWS credentials. Error: ${
					(error as Error).message
				}`,
			)
		}
	})

	afterAll(() => {
		// Cleanup test parameters for all environments
		for (const env of TEST_CONFIG.environments) {
			BootstrapTestUtils.cleanupTestParameters(env)
		}
	})

	describe('Parameter Store Integration', () => {
		const testEnv = 'development'
		const testParams = {
			API_KEY: 'test-api-key-12345678901234567890',
			AWS_COGNITO_REGION: 'us-east-1',
			AWS_COGNITO_USER_POOL_ID: 'test-pool-id',
			AWS_COGNITO_USER_POOL_CLIENT_ID: 'test-client-id',
			AWS_COGNITO_USER_POOL_SECRET_KEY: 'test-pool-secret',
			AWS_COGNITO_ACCESS_KEY: 'test-access-key',
			AWS_COGNITO_SECRET_KEY: 'test-secret-key',
			AWS_COGNITO_REFRESH_TOKEN_EXPIRY: '30',
			OPENAI_API_KEY: 'test-openai-key',
			RELATIONAL_DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
			NON_RELATIONAL_DATABASE_URL: 'redis://localhost:6379',
			COOKIE_ENCRYPTION_KEY: 'test-cookie-key-32-characters-long',
			COOKIE_DOMAIN: 'localhost',
		}

		beforeEach(() => {
			// Clean up any existing test parameters
			BootstrapTestUtils.cleanupTestParameters(testEnv)
		})

		it('should successfully fetch parameters from Parameter Store', async () => {
			// Setup test parameters
			const setupCommands = BootstrapTestUtils.createTestParameterStore(
				testEnv,
				testParams,
			)
			for (const command of setupCommands) {
				execSync(command, { stdio: 'pipe' })
			}

			// Run bootstrap script in dry-run mode
			const result = await BootstrapTestUtils.runBootstrapScript({
				appEnv: testEnv,
				dryRun: true,
				verbose: true,
			})

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain(
				'Parameter Store Prefix: /macro-ai/development/',
			)
			expect(result.stdout).toContain('APP_ENV=development')

			// Verify all required parameters are mentioned in output
			for (const param of TEST_CONFIG.requiredParams) {
				expect(result.stdout).toContain(param)
			}
		}, 30000) // 30 second timeout

		it('should create properly formatted environment file', async () => {
			// Setup test parameters
			const setupCommands = BootstrapTestUtils.createTestParameterStore(
				testEnv,
				testParams,
			)
			for (const command of setupCommands) {
				execSync(command, { stdio: 'pipe', timeout: 10000 })
			}

			const envFile = join(TEST_CONFIG.testDir, 'test.env')

			// Ensure the directory exists to avoid sudo requirements
			if (!existsSync(TEST_CONFIG.testDir)) {
				mkdirSync(TEST_CONFIG.testDir, { recursive: true })
			}

			// Run bootstrap script to create environment file
			const result = await BootstrapTestUtils.runBootstrapScript({
				appEnv: testEnv,
				envFile,
			})

			expect(result.exitCode).toBe(0)
			expect(existsSync(envFile)).toBe(true)

			// Parse and validate environment file
			const envVars = BootstrapTestUtils.parseEnvFile(envFile)

			// Verify all required parameters are present
			for (const param of TEST_CONFIG.requiredParams) {
				expect(envVars).toHaveProperty(param)
				expect(envVars[param]).toBe(
					testParams[param as keyof typeof testParams],
				)
			}

			// Verify additional environment variables
			expect(envVars.NODE_ENV).toBe('production')
			expect(envVars.APP_ENV).toBe(testEnv)

			// Cleanup
			unlinkSync(envFile)
		}, 30000) // 30 second timeout

		it('should handle missing parameters gracefully', async () => {
			// Setup incomplete parameters (missing some required ones)
			const incompleteParams = {
				API_KEY: 'test-api-key',
				AWS_COGNITO_REGION: 'us-east-1',
				// Missing other required parameters
			}

			const setupCommands = BootstrapTestUtils.createTestParameterStore(
				testEnv,
				incompleteParams,
			)
			for (const command of setupCommands) {
				execSync(command, { stdio: 'pipe' })
			}

			// Run bootstrap script - should succeed but with fewer parameters
			const result = await BootstrapTestUtils.runBootstrapScript({
				appEnv: testEnv,
				dryRun: true,
				verbose: true,
			})

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain(
				'Parameter Store Prefix: /macro-ai/development/',
			)

			// Should only retrieve the parameters that exist
			const outputLines = result.stdout
				.split('\n')
				.filter((line) => line.includes('='))
			const paramCount = outputLines.length - 2 // Subtract NODE_ENV and APP_ENV
			expect(paramCount).toBe(Object.keys(incompleteParams).length)
		})

		it('should fail gracefully with invalid AWS credentials', async () => {
			// Temporarily break AWS credentials
			const originalAccessKey = process.env.AWS_ACCESS_KEY_ID
			const originalSecretKey = process.env.AWS_SECRET_ACCESS_KEY

			process.env.AWS_ACCESS_KEY_ID = 'invalid-key'
			process.env.AWS_SECRET_ACCESS_KEY = 'invalid-secret'

			try {
				const result = await BootstrapTestUtils.runBootstrapScript({
					appEnv: testEnv,
					dryRun: true,
					verbose: true,
				})

				expect(result.exitCode).not.toBe(0)
				expect(result.stderr).toContain('AWS credentials not configured')
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
			}
		})
	})

	describe('Environment-Specific Parameter Mapping', () => {
		const testParams = {
			API_KEY: 'test-api-key-12345678901234567890',
			AWS_COGNITO_REGION: 'us-east-1',
			OPENAI_API_KEY: 'test-openai-key',
		}

		it('should map PR environments to development parameters', async () => {
			// Setup development parameters
			const setupCommands = BootstrapTestUtils.createTestParameterStore(
				'development',
				testParams,
			)
			for (const command of setupCommands) {
				execSync(command, { stdio: 'pipe' })
			}

			// Test PR environment should use development parameters
			const result = await BootstrapTestUtils.runBootstrapScript({
				appEnv: 'pr-123',
				dryRun: true,
				verbose: true,
			})

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain(
				'Parameter Store Prefix: /macro-ai/development/',
			)
			expect(result.stdout).toContain('APP_ENV=pr-123')
		})

		it('should use environment-specific parameters for staging and production', async () => {
			const environments = ['staging', 'production']

			for (const env of environments) {
				// Setup environment-specific parameters
				const setupCommands = BootstrapTestUtils.createTestParameterStore(
					env,
					testParams,
				)
				for (const command of setupCommands) {
					execSync(command, { stdio: 'pipe', timeout: 10000 })
				}

				const result = await BootstrapTestUtils.runBootstrapScript({
					appEnv: env,
					dryRun: true,
					verbose: true,
				})

				expect(result.exitCode).toBe(0)
				expect(result.stdout).toContain(
					`Parameter Store Prefix: /macro-ai/${env}/`,
				)
				expect(result.stdout).toContain(`APP_ENV=${env}`)

				// Cleanup
				BootstrapTestUtils.cleanupTestParameters(env)
			}
		})
	})

	describe('Error Handling and Edge Cases', () => {
		it('should validate command line arguments', async () => {
			// Test missing required arguments
			const result = await BootstrapTestUtils.runBootstrapScript({
				appEnv: '', // Empty app environment
			})

			expect(result.exitCode).not.toBe(0)
		})

		it('should show help message', async () => {
			const child = spawn('bash', [TEST_CONFIG.scriptPath, '--help'], {
				stdio: 'pipe',
			})

			let stdout = ''
			child.stdout.on('data', (data: Buffer) => {
				stdout += data.toString()
			})

			await new Promise((resolve) => {
				child.on('close', resolve)
			})

			expect(stdout).toContain('EC2 Configuration Bootstrap Script')
			expect(stdout).toContain('USAGE:')
			expect(stdout).toContain('OPTIONS:')
			expect(stdout).toContain('EXAMPLES:')
		})

		it('should handle non-existent Parameter Store paths', async () => {
			const result = await BootstrapTestUtils.runBootstrapScript({
				appEnv: 'non-existent-environment',
				dryRun: true,
				verbose: true,
			})

			expect(result.exitCode).toBe(0) // Should not fail, just return empty
			expect(result.stdout).toContain('APP_ENV=non-existent-environment')
			// Should only have NODE_ENV and APP_ENV (no parameters from Parameter Store)
			const outputLines = result.stdout
				.split('\n')
				.filter((line) => line.includes('='))
			expect(outputLines.length).toBe(2) // Only NODE_ENV and APP_ENV
		})
	})
})
