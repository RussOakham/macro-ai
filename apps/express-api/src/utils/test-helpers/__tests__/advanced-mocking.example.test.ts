/**
 * Advanced Mocking & Stubbing Test Examples
 *
 * Demonstrates key usage patterns of advanced mocking utilities:
 * - Error simulation and injection
 * - Contract testing with request/response validation
 * - Mock data factories with realistic patterns
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
	ContractTester,
	ErrorSimulator,
	MockDataFactory,
} from '../advanced-mocking.js'

// ============================================================================
// Test Suite
// ============================================================================

describe('Advanced Mocking Integration Examples', () => {
	let errorSimulator: ErrorSimulator
	let contractTester: ContractTester

	beforeEach(() => {
		errorSimulator = new ErrorSimulator()
		contractTester = new ContractTester()
	})

	afterEach(() => {
		errorSimulator.stop()
	})

	// ============================================================================
	// Error Simulation Examples
	// ============================================================================

	describe('Error Simulation', () => {
		it('should simulate errors for testing error handling', () => {
			errorSimulator.start()
			errorSimulator.options.probability = 1.0 // 100% error rate

			expect(errorSimulator.shouldSimulateError()).toBe(true)

			errorSimulator.options.probability = 0.0 // 0% error rate
			expect(errorSimulator.shouldSimulateError()).toBe(false)
		})
	})

	// ============================================================================
	// Contract Testing Examples
	// ============================================================================

	describe('Contract Testing', () => {
		it('should validate request and response contracts', () => {
			// Register a contract
			contractTester.registerContract({
				name: 'userRegistration',
				requestSchema: { type: 'object', required: ['email'] },
				responseSchema: { type: 'object', required: ['id', 'email'] },
				expectedStatusCodes: [201],
			})

			// Test contract compliance
			const isValid = contractTester.testContract(
				'userRegistration',
				{
					method: 'POST' as const,
					path: '/api/users',
					body: { email: 'test@example.com' },
				},
				{
					status: 201,
					headers: { 'Content-Type': 'application/json' },
					body: { id: '123', email: 'test@example.com' },
				},
			)

			expect(isValid).toBe(true)
		})
	})

	// ============================================================================
	// Mock Data Examples
	// ============================================================================

	describe('Mock Data Generation', () => {
		it('should generate realistic test data', () => {
			const user = MockDataFactory.createUser()

			expect(user.id).toBeDefined()
			expect(user.email).toMatch(
				/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
			)
			expect(user.firstName).toBeDefined()
			expect(user.lastName).toBeDefined()
		})
	})
})
