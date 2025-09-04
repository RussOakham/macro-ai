/**
 * Pact Contract Testing Examples
 *
 * Demonstrates key contract testing patterns using Pact for API contract validation.
 * Shows how to test API contracts between consumers and providers to ensure compatibility.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import {
	type ContractInteraction,
	ContractTester,
	MockPact,
} from '../pact-contract-testing.js'

// ============================================================================
// Test Suite
// ============================================================================

describe('Pact Contract Testing Examples', () => {
	let mockPact: MockPact
	let contractTester: ContractTester

	beforeEach(() => {
		mockPact = new MockPact('test-consumer', 'test-provider')
		contractTester = new ContractTester()
	})

	// ============================================================================
	// Basic Contract Testing
	// ============================================================================

	describe('Basic Contract Testing', () => {
		it('should create and verify a simple contract', async () => {
			// Start mock server
			await mockPact.start()

			// Create a contract interaction
			const interaction: ContractInteraction = {
				description: 'a request for user details',
				providerState: 'user exists',
				request: {
					method: 'GET',
					path: '/api/users/123',
					headers: { Accept: 'application/json' },
					body: undefined,
				},
				response: {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
					body: {
						id: '123',
						email: 'user@example.com',
						firstName: 'John',
						lastName: 'Doe',
					},
				},
			}

			// Add interaction to mock server
			mockPact.addInteraction(interaction)

			// Verify the contract
			const isValid = await mockPact.verify()
			expect(isValid).toBe(true)

			// Clean up
			await mockPact.stop()
		})
	})

	// ============================================================================
	// Contract Validation
	// ============================================================================

	describe('Contract Validation', () => {
		it('should validate request and response contracts', async () => {
			// Create a simple contract for testing
			const contract = {
				metadata: {
					name: 'userCreation',
					version: '1.0.0',
					consumer: 'test-consumer',
					provider: 'test-provider',
				},
				interactions: [
					{
						description: 'Create user',
						request: {
							method: 'POST' as const,
							path: '/api/users',
							body: {
								email: 'test@example.com',
								firstName: 'John',
								lastName: 'Doe',
							},
						},
						response: {
							status: 201,
							body: {
								id: '123',
								email: 'test@example.com',
							},
						},
					},
				],
			}

			contractTester.registerContract('userCreation', contract)

			// Test consumer against contract
			const isValid = await contractTester.testConsumer(
				'userCreation',
				(mockServerUrl) => {
					// Simulate making a request to the mock server
					console.log(`Testing against mock server: ${mockServerUrl}`)
					return Promise.resolve()
				},
			)

			expect(isValid).toBe(true)
		})
	})
})
