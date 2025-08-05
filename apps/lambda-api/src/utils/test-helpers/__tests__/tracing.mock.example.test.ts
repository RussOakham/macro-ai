/**
 * Example tests demonstrating usage of tracing test utilities
 * These tests serve as both documentation and validation of the tracing mock utilities
 */

import { describe, expect, it, vi } from 'vitest'

import { mockTracingUtils } from '../tracing.mock.js'

describe('Tracing Test Utilities Examples', () => {
	describe('Basic Tracing Mock Setup', () => {
		it('should provide all required tracer utilities', () => {
			// Create mock utilities
			const tracingMocks = mockTracingUtils.setup()

			// Verify all utilities are available
			expect(tracingMocks.addCommonAnnotations).toBeDefined()
			expect(tracingMocks.addCommonMetadata).toBeDefined()
			expect(tracingMocks.captureError).toBeDefined()
			expect(tracingMocks.tracer).toBeDefined()
			expect(tracingMocks.withSubsegment).toBeDefined()
			expect(tracingMocks.withSubsegmentSync).toBeDefined()

			// Verify tracer object has all methods
			expect(tracingMocks.tracer.putAnnotation).toBeDefined()
			expect(tracingMocks.tracer.putMetadata).toBeDefined()
			expect(tracingMocks.tracer.addErrorAsMetadata).toBeDefined()
			expect(tracingMocks.tracer.getSegment).toBeDefined()
		})

		it('should provide consistent subsegment names', () => {
			const subsegmentNames = mockTracingUtils.createSubsegmentNames()

			expect(subsegmentNames.EXPRESS_INIT).toBe('express-app-initialization')
			expect(subsegmentNames.EXPRESS_MIDDLEWARE).toBe(
				'express-middleware-setup',
			)
			expect(subsegmentNames.EXPRESS_ROUTES).toBe('express-routes-registration')
			expect(subsegmentNames.PARAMETER_STORE_GET).toBe('parameter-store-get')
			expect(subsegmentNames.PARAMETER_STORE_GET_MULTIPLE).toBe(
				'parameter-store-get-multiple',
			)
			expect(subsegmentNames.PARAMETER_STORE_INIT).toBe(
				'parameter-store-initialization',
			)
			expect(subsegmentNames.PARAMETER_STORE_HEALTH).toBe(
				'parameter-store-health-check',
			)
		})

		it('should provide consistent trace error types', () => {
			const traceErrorTypes = mockTracingUtils.createTraceErrorTypes()

			expect(traceErrorTypes.DEPENDENCY_ERROR).toBe('DependencyError')
			expect(traceErrorTypes.PARAMETER_STORE_ERROR).toBe('ParameterStoreError')
		})
	})

	describe('Mock Creation and Setup', () => {
		it('should create tracer module mock with all utilities', () => {
			// Act
			const moduleMock = mockTracingUtils.createModule()

			// Assert
			expect(moduleMock.addCommonAnnotations).toBeDefined()
			expect(moduleMock.addCommonMetadata).toBeDefined()
			expect(moduleMock.captureError).toBeDefined()
			expect(moduleMock.subsegmentNames).toBeDefined()
			expect(moduleMock.traceErrorTypes).toBeDefined()
			expect(moduleMock.tracer).toBeDefined()
			expect(moduleMock.withSubsegment).toBeDefined()
			expect(moduleMock.withSubsegmentSync).toBeDefined()
		})

		it('should create utils mock with proper function types', () => {
			// Act
			const utilsMock = mockTracingUtils.createUtilsMock()

			// Assert
			expect(vi.isMockFunction(utilsMock.addCommonAnnotations)).toBe(true)
			expect(vi.isMockFunction(utilsMock.addCommonMetadata)).toBe(true)
			expect(vi.isMockFunction(utilsMock.captureError)).toBe(true)
			expect(vi.isMockFunction(utilsMock.withSubsegment)).toBe(true)
			expect(vi.isMockFunction(utilsMock.withSubsegmentSync)).toBe(true)
		})

		it('should setup mocks and clear them properly', () => {
			// Act
			const setupMocks = mockTracingUtils.setup()

			// Assert
			expect(vi.isMockFunction(setupMocks.addCommonAnnotations)).toBe(true)
			expect(setupMocks.addCommonAnnotations).toHaveBeenCalledTimes(0)
		})
	})

	describe('Expectation Helpers', () => {
		it('should create subsegment expectation with name only', () => {
			// Act
			const expectation = mockTracingUtils.expectSubsegment('test-subsegment')

			// Assert
			expect(expectation.name).toBe('test-subsegment')
			expect(expectation.operation).toBe('any-function')
		})

		it('should create subsegment expectation with annotations and metadata', () => {
			// Arrange
			const annotations = { operation: 'test' }
			const metadata = { userId: '123' }

			// Act
			const expectation = mockTracingUtils.expectSubsegment(
				'test-subsegment',
				annotations,
				metadata,
			)

			// Assert
			expect(expectation.name).toBe('test-subsegment')
			expect(expectation.operation).toBe('any-function')
			expect(expectation.annotations).toEqual(annotations)
			expect(expectation.metadata).toEqual(metadata)
		})

		it('should create error capture expectation', () => {
			// Arrange
			const testError = new Error('Test error')
			const errorType = 'DependencyError'
			const context = { operation: 'test' }

			// Act
			const expectation = mockTracingUtils.expectErrorCapture(
				testError,
				errorType,
				context,
			)

			// Assert
			expect(expectation).toEqual([
				testError,
				errorType,
				expect.objectContaining(context),
			])
		})

		it('should create error capture expectation without context', () => {
			// Arrange
			const testError = new Error('Test error')
			const errorType = 'DependencyError'

			// Act
			const expectation = mockTracingUtils.expectErrorCapture(
				testError,
				errorType,
			)

			// Assert
			expect(expectation).toEqual([testError, errorType])
		})
	})
})
