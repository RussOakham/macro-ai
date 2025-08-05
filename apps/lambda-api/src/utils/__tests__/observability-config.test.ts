/**
 * Tests for Observability Configuration
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	createObservabilityConfig,
	type Environment,
	getConfigSummary,
	type LogLevel,
	ObservabilityConfig,
	observabilityConfig,
	observabilityPresets,
	updateObservabilityConfig,
	validateObservabilityConfig,
} from '../observability-config.js'

describe('Observability Configuration', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Reset environment variables
		delete process.env.NODE_ENV
		delete process.env.LOG_LEVEL
		delete process.env.AWS_LAMBDA_FUNCTION_NAME
		delete process.env.AWS_REGION
		delete process.env._X_AMZN_TRACE_ID
		delete process.env.POWERTOOLS_TRACE_DISABLED
		// Ensure tracing is disabled by default in tests
		process.env.POWERTOOLS_TRACE_DISABLED = 'true'
	})

	afterEach(() => {
		vi.resetAllMocks()
	})

	describe('createObservabilityConfig', () => {
		it('should create default configuration', () => {
			const config = createObservabilityConfig()

			expect(config.service.name).toBe('macro-ai-lambda-api')
			expect(config.service.version).toBe('lambda-api-v1.0.0')
			expect(config.service.environment).toBe('production')
			expect(config.logger.enabled).toBe(true)
			expect(config.metrics.enabled).toBe(true)
			expect(config.tracer.enabled).toBe(false) // No X-Ray trace ID
		})

		it('should create configuration with environment overrides', () => {
			const config = createObservabilityConfig({
				NODE_ENV: 'development',
				LOG_LEVEL: 'debug',
				AWS_LAMBDA_FUNCTION_NAME: 'test-function',
				AWS_REGION: 'eu-west-1',
			})

			expect(config.service.environment).toBe('development')
			expect(config.logger.logLevel).toBe('DEBUG')
			expect(config.service.functionName).toBe('test-function')
			expect(config.service.region).toBe('eu-west-1')
		})

		it('should enable tracing when X-Ray trace ID is present', () => {
			process.env._X_AMZN_TRACE_ID = 'Root=1-5e1b4151-5ac6c58f5b5dbd6a5b5dbd6a'
			delete process.env.POWERTOOLS_TRACE_DISABLED

			const config = createObservabilityConfig()

			expect(config.tracer.enabled).toBe(true)
			expect(config.coordination.enableTraceIdPropagation).toBe(true)
		})

		it('should disable tracing when POWERTOOLS_TRACE_DISABLED is true', () => {
			process.env._X_AMZN_TRACE_ID = 'Root=1-5e1b4151-5ac6c58f5b5dbd6a5b5dbd6a'
			process.env.POWERTOOLS_TRACE_DISABLED = 'true'

			const config = createObservabilityConfig()

			expect(config.tracer.enabled).toBe(false)
		})

		it('should configure production optimizations', () => {
			const config = createObservabilityConfig({ NODE_ENV: 'production' })

			expect(config.logger.sampleRate).toBe(0.1)
			expect(config.metrics.sampleRate).toBe(0.1)
			expect(config.tracer.captureResponse).toBe(false)
			expect(config.middleware.maxBodySize).toBe(512)
			expect(config.features.enableProductionOptimizations).toBe(true)
		})

		it('should configure development settings', () => {
			const config = createObservabilityConfig({ NODE_ENV: 'development' })

			expect(config.logger.sampleRate).toBe(1.0)
			expect(config.metrics.sampleRate).toBe(1.0)
			expect(config.tracer.captureResponse).toBe(true)
			expect(config.middleware.maxBodySize).toBe(1024)
			expect(config.features.enableDebugMode).toBe(true)
			expect(config.coordination.enableDebugLogging).toBe(true)
		})

		it('should configure test settings', () => {
			const config = createObservabilityConfig({ NODE_ENV: 'test' })

			expect(config.tracer.enabled).toBe(false)
			expect(config.metrics.enableCustomMetrics).toBe(false)
			expect(config.features.enableDebugMode).toBe(false)
		})

		it('should include sensitive data redaction in production', () => {
			const config = createObservabilityConfig({ NODE_ENV: 'production' })

			expect(config.logger.enableSensitiveDataRedaction).toBe(true)
			expect(config.logger.redactFields).toContain('password')
			expect(config.logger.redactFields).toContain('token')
			expect(config.middleware.redactSensitiveHeaders).toBe(true)
		})

		it('should configure proper service metadata', () => {
			const config = createObservabilityConfig({
				AWS_LAMBDA_FUNCTION_NAME: 'my-function',
				AWS_REGION: 'us-west-2',
			})

			expect(config.service.functionName).toBe('my-function')
			expect(config.service.region).toBe('us-west-2')
			expect(config.service.runtime).toBe('nodejs22.x')
			expect(config.logger.persistentAttributes.functionName).toBe(
				'my-function',
			)
			expect(config.metrics.defaultDimensions.FunctionName).toBe('my-function')
		})
	})

	describe('observabilityPresets', () => {
		it('should provide development preset', () => {
			const config = observabilityPresets.development

			expect(config.service.environment).toBe('development')
			expect(config.logger.logLevel).toBe('DEBUG')
			expect(config.features.enableDebugMode).toBe(true)
		})

		it('should provide production preset', () => {
			const config = observabilityPresets.production

			expect(config.service.environment).toBe('production')
			expect(config.logger.logLevel).toBe('INFO')
			expect(config.features.enableProductionOptimizations).toBe(true)
		})

		it('should provide test preset', () => {
			const config = observabilityPresets.test

			expect(config.service.environment).toBe('test')
			expect(config.logger.logLevel).toBe('WARN')
			expect(config.tracer.enabled).toBe(false)
		})
	})

	describe('validateObservabilityConfig', () => {
		it('should validate valid configuration', () => {
			const config = createObservabilityConfig()
			const isValid = validateObservabilityConfig(config)

			expect(isValid).toBe(true)
		})

		it('should reject configuration with missing service name', () => {
			const config = createObservabilityConfig()
			config.service.name = ''

			const isValid = validateObservabilityConfig(config)

			expect(isValid).toBe(false)
		})

		it('should reject configuration with invalid log level', () => {
			const config = createObservabilityConfig()
			config.logger.logLevel = 'INVALID' as LogLevel

			const isValid = validateObservabilityConfig(config)

			expect(isValid).toBe(false)
		})

		it('should reject configuration with invalid environment', () => {
			const config = createObservabilityConfig()
			config.service.environment = 'invalid' as Environment

			const isValid = validateObservabilityConfig(config)

			expect(isValid).toBe(false)
		})
	})

	describe('getConfigSummary', () => {
		it('should return configuration summary', () => {
			const config = createObservabilityConfig({
				NODE_ENV: 'development',
				LOG_LEVEL: 'debug',
			})

			const summary = getConfigSummary(config)

			expect(summary).toEqual({
				service: 'macro-ai-lambda-api',
				version: 'lambda-api-v1.0.0',
				environment: 'development',
				logLevel: 'DEBUG',
				tracingEnabled: false, // Should be false due to POWERTOOLS_TRACE_DISABLED
				metricsEnabled: true,
				coordinationEnabled: true,
				features: {
					debugMode: true,
					productionOptimizations: false,
					advancedTracing: false, // Should be false due to disabled tracing
				},
			})
		})

		it('should show tracing enabled when X-Ray is available', () => {
			process.env._X_AMZN_TRACE_ID = 'Root=1-5e1b4151-5ac6c58f5b5dbd6a5b5dbd6a'
			delete process.env.POWERTOOLS_TRACE_DISABLED

			const config = createObservabilityConfig({ NODE_ENV: 'development' })
			const summary = getConfigSummary(config)

			expect(summary.tracingEnabled).toBe(true)
			expect(summary.features.advancedTracing).toBe(true)
		})
	})

	describe('updateObservabilityConfig', () => {
		it('should update configuration with partial updates', () => {
			const originalConfig = createObservabilityConfig()
			const updates: Partial<ObservabilityConfig> = {
				logger: {
					...originalConfig.logger,
					logLevel: 'DEBUG' as LogLevel,
					sampleRate: 0.5,
				},
				features: {
					...originalConfig.features,
					enableDebugMode: true,
				},
			}

			const updatedConfig = updateObservabilityConfig(updates)

			expect(updatedConfig.logger.logLevel).toBe('DEBUG')
			expect(updatedConfig.logger.sampleRate).toBe(0.5)
			expect(updatedConfig.features.enableDebugMode).toBe(true)
			// Other properties should remain unchanged
			expect(updatedConfig.service.name).toBe(originalConfig.service.name)
			expect(updatedConfig.metrics.enabled).toBe(originalConfig.metrics.enabled)
		})

		it('should deep merge nested configuration objects', () => {
			const originalConfig = createObservabilityConfig()
			const updates: Partial<ObservabilityConfig> = {
				service: {
					...originalConfig.service,
					environment: 'test' as Environment,
				},
				logger: {
					...originalConfig.logger,
					logLevel: 'WARN' as LogLevel,
				},
			}

			const updatedConfig = updateObservabilityConfig(updates)

			expect(updatedConfig.service.environment).toBe('test')
			expect(updatedConfig.service.name).toBe('macro-ai-lambda-api') // Should preserve
			expect(updatedConfig.logger.logLevel).toBe('WARN')
			expect(updatedConfig.logger.enabled).toBe(true) // Should preserve
		})
	})

	describe('default observabilityConfig', () => {
		it('should export a default configuration instance', () => {
			expect(observabilityConfig).toBeDefined()
			expect(observabilityConfig.service.name).toBe('macro-ai-lambda-api')
			expect(validateObservabilityConfig(observabilityConfig)).toBe(true)
		})
	})

	describe('environment variable handling', () => {
		it('should handle missing environment variables gracefully', () => {
			// Clear all environment variables
			const originalEnv = process.env
			process.env = {}

			const config = createObservabilityConfig()

			expect(config.service.environment).toBe('production')
			expect(config.logger.logLevel).toBe('INFO')
			expect(config.service.functionName).toBe('macro-ai-lambda')
			expect(config.service.region).toBe('us-east-1')

			// Restore environment
			process.env = originalEnv
		})

		it('should use process.env when no explicit env provided', () => {
			process.env.NODE_ENV = 'development'
			process.env.LOG_LEVEL = 'debug'
			process.env.AWS_LAMBDA_FUNCTION_NAME = 'env-function'

			const config = createObservabilityConfig()

			expect(config.service.environment).toBe('development')
			expect(config.logger.logLevel).toBe('DEBUG')
			expect(config.service.functionName).toBe('env-function')
		})
	})
})
