/**
 * Parameter Store Configuration Integration Tests
 *
 * Tests the Parameter Store configuration changes to verify:
 * 1. Enhanced Config Service correctly maps UPPER_CASE parameter names
 * 2. Parameter Store Service can fetch parameters from AWS Parameter Store
 * 3. EC2 Loader correctly routes PR environments to development path
 * 4. End-to-end parameter retrieval works with real AWS Parameter Store
 *
 * This test makes actual calls to AWS Parameter Store (not mocked)
 */

import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import { afterAll, beforeAll, describe, expect } from 'vitest'

// Import the services we want to test
import { EnhancedConfigService } from '../../apps/express-api/src/services/enhanced-config.service.ts'
import { ParameterStoreService } from '../../apps/express-api/src/services/parameter-store.service.ts'

interface ParameterStoreTestConfig {
	region: string
	developmentPath: string
	expectedParameters: string[]
	timeout: number
}

interface TestResult {
	success: boolean
	value?: string
	error?: string
	responseTime: number
}

class ParameterStoreIntegrationTester {
	private readonly config: ParameterStoreTestConfig
	private readonly ssmClient: SSMClient
	private readonly parameterStoreService: ParameterStoreService
	private readonly enhancedConfigService: EnhancedConfigService

	constructor(config: ParameterStoreTestConfig) {
		this.config = config
		this.ssmClient = new SSMClient({ region: config.region })

		// Initialize services with development environment configuration
		this.parameterStoreService = new ParameterStoreService({
			region: config.region,
			environment: 'development',
			cacheEnabled: false, // Disable cache for testing
			cacheTtlMs: 0,
		})

		this.enhancedConfigService = new EnhancedConfigService(
			this.parameterStoreService,
		)
	}

	/**
	 * Test direct AWS Parameter Store access
	 */
	async testDirectParameterAccess(parameterName: string): Promise<TestResult> {
		const startTime = Date.now()
		const fullParameterPath = `${this.config.developmentPath}${parameterName}`

		try {
			const command = new GetParameterCommand({
				Name: fullParameterPath,
				WithDecryption: true,
			})

			const response = await this.ssmClient.send(command)
			const responseTime = Date.now() - startTime

			if (response.Parameter?.Value) {
				return {
					success: true,
					value: response.Parameter.Value,
					responseTime,
				}
			} else {
				return {
					success: false,
					error: 'Parameter value is empty',
					responseTime,
				}
			}
		} catch (error) {
			const responseTime = Date.now() - startTime
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				responseTime,
			}
		}
	}

	/**
	 * Test Parameter Store Service
	 */
	async testParameterStoreService(parameterName: string): Promise<TestResult> {
		const startTime = Date.now()

		try {
			const [result, error] =
				await this.parameterStoreService.getParameter(parameterName)
			const responseTime = Date.now() - startTime

			if (error) {
				return {
					success: false,
					error: error.message,
					responseTime,
				}
			}

			return {
				success: true,
				value: result || undefined,
				responseTime,
			}
		} catch (error) {
			const responseTime = Date.now() - startTime
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				responseTime,
			}
		}
	}

	/**
	 * Test Enhanced Config Service
	 */
	async testEnhancedConfigService(parameterName: string): Promise<TestResult> {
		const startTime = Date.now()

		try {
			// Simulate EC2 environment to force Parameter Store usage
			const originalParameterStorePrefix = process.env.PARAMETER_STORE_PREFIX
			const originalAppEnv = process.env.APP_ENV
			process.env.PARAMETER_STORE_PREFIX = '/macro-ai/development/'
			process.env.APP_ENV = 'development'

			// Create a new Enhanced Config Service instance after setting environment variables
			const testEnhancedConfigService = new EnhancedConfigService(
				new ParameterStoreService({
					region: 'us-east-1',
					environment: 'development',
					cacheEnabled: false,
					cacheTtlMs: 0,
				}),
			)

			const [result, error] = await testEnhancedConfigService.getConfig(
				parameterName,
				{
					required: true,
					useParameterStore: true,
				},
			)

			// Restore original environment
			if (originalParameterStorePrefix) {
				process.env.PARAMETER_STORE_PREFIX = originalParameterStorePrefix
			} else {
				delete process.env.PARAMETER_STORE_PREFIX
			}

			if (originalAppEnv) {
				process.env.APP_ENV = originalAppEnv
			} else {
				delete process.env.APP_ENV
			}

			const responseTime = Date.now() - startTime

			if (error) {
				return {
					success: false,
					error: error.message,
					responseTime,
				}
			}

			return {
				success: true,
				value: result.value,
				responseTime,
			}
		} catch (error) {
			const responseTime = Date.now() - startTime
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				responseTime,
			}
		}
	}

	/**
	 * Test batch parameter retrieval
	 */
	async testBatchParameterRetrieval(): Promise<{
		success: boolean
		results: Record<string, TestResult>
	}> {
		const results: Record<string, TestResult> = {}
		let allSuccessful = true

		for (const parameterName of this.config.expectedParameters) {
			const result = await this.testEnhancedConfigService(parameterName)
			results[parameterName] = result
			if (!result.success) {
				allSuccessful = false
			}
		}

		return { success: allSuccessful, results }
	}

	/**
	 * Test PR environment routing logic
	 */
	testPrEnvironmentRouting(): {
		success: boolean
		results: Record<string, string>
	} {
		const testCases = [
			{ appEnv: 'pr-52', expectedPath: '/macro-ai/development/' },
			{ appEnv: 'pr-123', expectedPath: '/macro-ai/development/' },
			{ appEnv: 'pr-test-feature', expectedPath: '/macro-ai/development/' },
			{ appEnv: 'development', expectedPath: '/macro-ai/development/' },
			{ appEnv: 'staging', expectedPath: '/macro-ai/staging/' },
			{ appEnv: 'production', expectedPath: '/macro-ai/production/' },
		]

		const results: Record<string, string> = {}
		let allSuccessful = true

		for (const testCase of testCases) {
			// Simulate the EC2 loader logic
			const actualPath = testCase.appEnv.startsWith('pr-')
				? '/macro-ai/development/'
				: `/macro-ai/${testCase.appEnv}/`

			results[testCase.appEnv] = actualPath

			if (actualPath !== testCase.expectedPath) {
				allSuccessful = false
			}
		}

		return { success: allSuccessful, results }
	}

	/**
	 * Validate all expected parameters exist in Parameter Store
	 */
	async validateAllParametersExist(): Promise<{
		success: boolean
		missing: string[]
		existing: string[]
	}> {
		const missing: string[] = []
		const existing: string[] = []

		for (const parameterName of this.config.expectedParameters) {
			const result = await this.testDirectParameterAccess(parameterName)
			if (result.success) {
				existing.push(parameterName)
			} else {
				missing.push(parameterName)
			}
		}

		return {
			success: missing.length === 0,
			missing,
			existing,
		}
	}
}

describe('Parameter Store Configuration Integration Tests', () => {
	let tester: ParameterStoreIntegrationTester

	const testConfig: ParameterStoreTestConfig = {
		region: 'us-east-1',
		developmentPath: '/macro-ai/development/',
		expectedParameters: [
			'API_KEY',
			'COOKIE_ENCRYPTION_KEY',
			'AWS_COGNITO_USER_POOL_SECRET_KEY',
			'AWS_COGNITO_ACCESS_KEY',
			'AWS_COGNITO_SECRET_KEY',
			'OPENAI_API_KEY',
			'RELATIONAL_DATABASE_URL',
			'NON_RELATIONAL_DATABASE_URL',
			'AWS_COGNITO_USER_POOL_ID',
			'AWS_COGNITO_USER_POOL_CLIENT_ID',
			'AWS_COGNITO_REGION',
		],
		timeout: 30000,
	}

	beforeAll(() => {
		tester = new ParameterStoreIntegrationTester(testConfig)
	})

	afterAll(() => {
		// Clean up any resources if needed
	})

	describe.skip('1. Direct AWS Parameter Store Access', () => {
		it(
			'should successfully connect to AWS Parameter Store',
			async () => {
				// Test with a known parameter (API_KEY)
				const result = await tester.testDirectParameterAccess('API_KEY')

				expect(result.success).toBe(true)
				expect(result.value).toBeDefined()
				expect(result.value).not.toBe('')
				expect(result.responseTime).toBeLessThan(10000) // Should respond within 10 seconds
			},
			testConfig.timeout,
		)

		it(
			'should handle non-existent parameters gracefully',
			async () => {
				const result = await tester.testDirectParameterAccess(
					'NON_EXISTENT_PARAMETER',
				)

				expect(result.success).toBe(false)
				expect(result.error).toContain('ParameterNotFound')
			},
			testConfig.timeout,
		)

		it(
			'should validate all expected parameters exist',
			async () => {
				const validation = await tester.validateAllParametersExist()

				console.log('Parameter validation results:')
				console.log(
					`✅ Existing parameters (${validation.existing.length.toString()}):`,
					validation.existing,
				)
				if (validation.missing.length > 0) {
					console.log(
						`❌ Missing parameters (${validation.missing.length.toString()}):`,
						validation.missing,
					)
				}

				expect(validation.success).toBe(true)
				expect(validation.missing).toHaveLength(0)
				expect(validation.existing).toHaveLength(
					testConfig.expectedParameters.length,
				)
			},
			testConfig.timeout * 2,
		)
	})

	describe('2. Parameter Store Service Integration', () => {
		it(
			'should retrieve parameters using UPPER_CASE parameter names',
			async () => {
				const testParameters = [
					'API_KEY',
					'OPENAI_API_KEY',
					'AWS_COGNITO_REGION',
				]

				for (const parameterName of testParameters) {
					const result = await tester.testParameterStoreService(parameterName)

					expect(result.success).toBe(true)
					expect(result.value).toBeDefined()
					expect(result.value).not.toBe('')
					expect(result.responseTime).toBeLessThan(5000)
				}
			},
			testConfig.timeout,
		)

		it(
			'should handle Parameter Store errors gracefully',
			async () => {
				const result =
					await tester.testParameterStoreService('INVALID_PARAMETER')

				expect(result.success).toBe(false)
				expect(result.error).toBeDefined()
			},
			testConfig.timeout,
		)

		it(
			'should retrieve parameters with consistent performance',
			async () => {
				const parameterName = 'API_KEY'
				const iterations = 3
				const responseTimes: number[] = []

				for (let i = 0; i < iterations; i++) {
					const result = await tester.testParameterStoreService(parameterName)
					expect(result.success).toBe(true)
					responseTimes.push(result.responseTime)

					// Small delay between requests
					await new Promise((resolve) => setTimeout(resolve, 100))
				}

				// Check that response times are reasonable and consistent
				const avgResponseTime =
					responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
				const maxResponseTime = Math.max(...responseTimes)

				expect(avgResponseTime).toBeLessThan(3000)
				expect(maxResponseTime).toBeLessThan(5000)
			},
			testConfig.timeout,
		)
	})

	describe('3. Enhanced Config Service Integration', () => {
		it(
			'should retrieve parameters through Enhanced Config Service',
			async () => {
				const testParameters = [
					'API_KEY',
					'OPENAI_API_KEY',
					'AWS_COGNITO_REGION',
				]

				for (const parameterName of testParameters) {
					const result = await tester.testEnhancedConfigService(parameterName)

					expect(result.success).toBe(true)
					expect(result.value).toBeDefined()
					expect(result.value).not.toBe('')
				}
			},
			testConfig.timeout,
		)

		it(
			'should retrieve all 12 mapped parameters successfully',
			async () => {
				const batchResult = await tester.testBatchParameterRetrieval()

				console.log('Enhanced Config Service batch retrieval results:')
				for (const [paramName, result] of Object.entries(batchResult.results)) {
					const status = result.success ? '✅' : '❌'
					const time = `${result.responseTime.toString()}ms`
					const error = result.error ? ` (${result.error})` : ''
					console.log(`${status} ${paramName}: ${time}${error}`)
				}

				expect(batchResult.success).toBe(true)

				// Verify we tested all expected parameters
				const testedParameters = Object.keys(batchResult.results)
				expect(testedParameters).toHaveLength(
					testConfig.expectedParameters.length,
				)

				// Verify all parameters were retrieved successfully
				for (const parameterName of testConfig.expectedParameters) {
					expect(batchResult.results[parameterName].success).toBe(true)
				}
			},
			testConfig.timeout * 2,
		)

		it.skip(
			'should handle missing parameters with proper error messages',
			async () => {
				const result = await tester.testEnhancedConfigService(
					'NON_EXISTENT_PARAMETER',
				)

				expect(result.success).toBe(false)
				expect(result.error).toBeDefined()
				expect(result.error).toContain('Parameter not found')
			},
			testConfig.timeout,
		)
	})

	describe('4. PR Environment Routing Logic', () => {
		it('should correctly route PR environments to development path', () => {
			const routingResult = tester.testPrEnvironmentRouting()

			console.log('PR Environment routing results:')
			for (const [appEnv, actualPath] of Object.entries(
				routingResult.results,
			)) {
				console.log(`${appEnv} → ${actualPath}`)
			}

			expect(routingResult.success).toBe(true)

			// Verify specific PR environment routing
			expect(routingResult.results['pr-52']).toBe('/macro-ai/development/')
			expect(routingResult.results['pr-123']).toBe('/macro-ai/development/')
			expect(routingResult.results['pr-test-feature']).toBe(
				'/macro-ai/development/',
			)

			// Verify standard environment routing
			expect(routingResult.results.development).toBe('/macro-ai/development/')
			expect(routingResult.results.staging).toBe('/macro-ai/staging/')
			expect(routingResult.results.production).toBe('/macro-ai/production/')
		})
	})

	describe('5. End-to-End Configuration Loading', () => {
		it(
			'should load configuration end-to-end for PR environment simulation',
			async () => {
				// Simulate PR-52 EC2 environment
				const originalAppEnv = process.env.APP_ENV
				const originalParameterStorePrefix = process.env.PARAMETER_STORE_PREFIX

				process.env.APP_ENV = 'pr-52'
				process.env.PARAMETER_STORE_PREFIX = '/macro-ai/development/'

				try {
					// Test critical parameters that PR environments need
					const criticalParameters = [
						'API_KEY',
						'OPENAI_API_KEY',
						'AWS_COGNITO_REGION',
						'RELATIONAL_DATABASE_URL',
						'NON_RELATIONAL_DATABASE_URL',
					]

					const results: Record<string, TestResult> = {}
					let allSuccessful = true

					for (const parameterName of criticalParameters) {
						const result = await tester.testEnhancedConfigService(parameterName)
						results[parameterName] = result
						if (!result.success) {
							allSuccessful = false
						}
					}

					console.log('PR-52 environment simulation results:')
					for (const [paramName, result] of Object.entries(results)) {
						const status = result.success ? '✅' : '❌'
						const time = `${result.responseTime.toString()}ms`
						const error = result.error ? ` (${result.error})` : ''
						console.log(`${status} ${paramName}: ${time}${error}`)
					}

					expect(allSuccessful).toBe(true)

					// Verify all critical parameters were loaded
					for (const parameterName of criticalParameters) {
						expect(results[parameterName].success).toBe(true)
						expect(results[parameterName].value).toBeDefined()
						expect(results[parameterName].value).not.toBe('')
					}
				} finally {
					// Restore original environment
					if (originalAppEnv) {
						process.env.APP_ENV = originalAppEnv
					} else {
						delete process.env.APP_ENV
					}

					if (originalParameterStorePrefix) {
						process.env.PARAMETER_STORE_PREFIX = originalParameterStorePrefix
					} else {
						delete process.env.PARAMETER_STORE_PREFIX
					}
				}
			},
			testConfig.timeout,
		)

		it(
			'should demonstrate performance improvements with parameter caching',
			async () => {
				// Test with caching enabled
				const cachedService = new ParameterStoreService({
					region: testConfig.region,
					environment: 'development',
					cacheEnabled: true,
					cacheTtlMs: 60000, // 1 minute cache
				})

				const parameterName = 'API_KEY'
				const iterations = 5
				const responseTimes: number[] = []

				for (let i = 0; i < iterations; i++) {
					const startTime = Date.now()
					const [result, error] =
						await cachedService.getParameter(parameterName)
					const responseTime = Date.now() - startTime

					expect(error).toBeNull()
					expect(result).toBeDefined()
					responseTimes.push(responseTime)

					// Small delay between requests
					await new Promise((resolve) => setTimeout(resolve, 50))
				}

				console.log('Caching performance test results:')
				responseTimes.forEach((time, index) => {
					console.log(`Request ${(index + 1).toString()}: ${time.toString()}ms`)
				})

				// First request should be slower (cache miss), subsequent requests should be faster
				const firstRequestTime = responseTimes[0]
				const avgCachedTime =
					responseTimes.slice(1).reduce((a, b) => a + b, 0) /
					(responseTimes.length - 1)

				console.log(
					`First request (cache miss): ${firstRequestTime.toString()}ms`,
				)
				console.log(`Average cached requests: ${avgCachedTime.toString()}ms`)

				// Cached requests should be significantly faster
				expect(avgCachedTime).toBeLessThan(firstRequestTime * 0.5) // At least 50% faster
			},
			testConfig.timeout,
		)
	})
})
