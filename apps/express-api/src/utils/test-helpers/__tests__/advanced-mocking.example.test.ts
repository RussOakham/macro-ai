/**
 * ⚠️ ANTI-PATTERN EXAMPLES - DO NOT USE IN PRODUCTION
 *
 * This file demonstrates TESTING ANTI-PATTERNS that violate CLAUDE.md guidelines.
 * These examples show what NOT to do in real test suites.
 *
 * CLAUDE.md Rule Violations:
 * - Over-specification of third-party library behavior
 * - Contrived error simulation scenarios
 * - Testing implementation details rather than business logic
 *
 * Use these examples to LEARN what to AVOID, not what to emulate.
 *
 * For production tests, focus on:
 * ✅ Core logic correctness
 * ✅ Critical failure paths
 * ✅ Integration with external systems (mocked where possible)
 * ✅ Realistic and valuable test cases only
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
	// ANTI-PATTERN - Error Simulation Examples
	// ============================================================================

	describe('Error Simulation', () => {
		it('ANTI-PATTERN: should simulate contrived errors for testing error handling', () => {
			// ❌ VIOLATION: Using contrived error simulation instead of testing real error scenarios
			// ✅ PRODUCTION: Test actual error conditions that occur in your application
			errorSimulator.start()
			errorSimulator.options.probability = 1.0 // 100% error rate

			expect(errorSimulator.shouldSimulateError()).toBe(true)

			errorSimulator.options.probability = 0.0 // 0% error rate
			expect(errorSimulator.shouldSimulateError()).toBe(false)
		})
	})

	// ============================================================================
	// ANTI-PATTERN - Contract Testing Examples
	// ============================================================================

	describe('Contract Testing', () => {
		it('ANTI-PATTERN: should validate request and response contracts exhaustively', () => {
			// ❌ VIOLATION: Over-specifying contract details that aren't critical to business logic
			// ✅ PRODUCTION: Test only contracts that are essential to your API integration points
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
	// ANTI-PATTERN - Mock Data Examples
	// ============================================================================

	describe('Mock Data Generation', () => {
		it('ANTI-PATTERN: should generate exhaustive realistic test data', () => {
			// ❌ VIOLATION: Testing implementation details of mock data generation
			// ✅ PRODUCTION: Use mock data factories, but don't test their internal behavior
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
