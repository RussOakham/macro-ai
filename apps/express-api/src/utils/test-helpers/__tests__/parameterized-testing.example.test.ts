import { describe, expect, it } from 'vitest'

/**
 * ⚠️ ANTI-PATTERN EXAMPLES - DO NOT USE IN PRODUCTION
 *
 * This file demonstrates TESTING ANTI-PATTERNS that violate CLAUDE.md guidelines.
 * These examples show what NOT to do in real test suites.
 *
 * CLAUDE.md Rule Violations:
 * - Exhaustive permutations (testing every possible combination)
 * - Contrived edge cases not relevant to business logic
 * - Over-specification of trivial functionality
 *
 * Use these examples to LEARN what to AVOID, not what to emulate.
 *
 * For production tests, focus on:
 * ✅ Core logic correctness
 * ✅ Critical failure paths
 * ✅ Integration with external systems (mocked where possible)
 * ✅ Realistic and valuable test cases only
 */

describe('Parameterized Testing Examples', () => {
	// Example 1: ANTI-PATTERN - Exhaustive Email Validation Testing
	// ❌ VIOLATION: Testing every possible email combination is exhaustive
	// ✅ PRODUCTION: Test only critical email validation scenarios relevant to your business
	describe.each([
		['valid-email@example.com', true],
		['invalid-email', false],
		['another@valid.com', true],
		['@invalid.com', false],
		['test@', false],
	])('Email validation: %s', (email, expected) => {
		it(`should ${expected ? 'accept' : 'reject'} ${email}`, () => {
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
			expect(emailRegex.test(email)).toBe(expected)
		})
	})

	// Example 2: ANTI-PATTERN - Exhaustive User Role Testing
	// ❌ VIOLATION: Testing every possible user role combination exhaustively
	// ✅ PRODUCTION: Test only roles that have different business logic/behavior
	describe.each([
		['admin', 'admin@example.com', 'Admin User'],
		['user', 'user@example.com', 'Regular User'],
		['guest', 'guest@example.com', 'Guest User'],
	])('User creation with role: %s', (role, email, expectedName) => {
		it(`should create ${role} user with correct properties`, () => {
			const user = {
				id: '1',
				role,
				email,
				name: expectedName,
				createdAt: new Date(),
			}

			expect(user.role).toBe(role)
			expect(user.email).toBe(email)
			expect(user.name).toBe(expectedName)
		})
	})

	// Example 3: ANTI-PATTERN - Exhaustive Authentication Scenario Testing
	// ❌ VIOLATION: Testing every possible authentication edge case exhaustively
	// ✅ PRODUCTION: Test only critical authentication flows and failure modes relevant to your app
	describe.each([
		['valid-token', true, 'User authenticated successfully'],
		['invalid-token', false, 'Invalid token provided'],
		['expired-token', false, 'Token has expired'],
		['', false, 'No token provided'],
	])(
		'Authentication with token: %s',
		(token, expectedSuccess, expectedMessage) => {
			it(`should ${expectedSuccess ? 'authenticate' : 'reject'} user`, () => {
				const authResult = {
					token,
					isAuthenticated: expectedSuccess,
					message: expectedMessage,
				}

				expect(authResult.isAuthenticated).toBe(expectedSuccess)
				expect(authResult.message).toBe(expectedMessage)
			})
		},
	)

	// Example 4: ANTI-PATTERN - Exhaustive HTTP Status Code Testing
	// ❌ VIOLATION: Testing every possible HTTP status code exhaustively
	// ✅ PRODUCTION: Test only status codes that your application actually handles or returns
	describe.each([
		[200, 'success', 'Request successful'],
		[400, 'error', 'Bad request'],
		[401, 'error', 'Unauthorized'],
		[404, 'error', 'Not found'],
		[500, 'error', 'Internal server error'],
	])('API response status: %d', (statusCode, type, description) => {
		it(`should handle ${String(statusCode)} status correctly`, () => {
			const response = {
				status: statusCode,
				type,
				message: description,
			}

			expect(response.status).toBe(statusCode)
			expect(response.type).toBe(type)
			expect(response.message).toBe(description)
		})
	})

	// Example 5: ANTI-PATTERN - Exhaustive Password Strength Testing
	// ❌ VIOLATION: Testing every possible password strength combination exhaustively
	// ✅ PRODUCTION: Test only critical password validation rules that affect your security requirements
	describe.each([
		['Password123!', true, 'strong'],
		['password', false, 'weak'],
		['12345678', false, 'weak'],
		['Password', false, 'medium'],
		['P@ssw0rd', true, 'strong'],
	])('Password strength: %s', (password, isStrong, strength) => {
		it(`should identify password as ${strength}`, () => {
			const hasUpperCase = /[A-Z]/.test(password)
			const hasLowerCase = /[a-z]/.test(password)
			const hasNumbers = /\d/.test(password)
			const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password)
			const isLongEnough = password.length >= 8

			const actualStrength =
				hasUpperCase &&
				hasLowerCase &&
				hasNumbers &&
				hasSpecialChar &&
				isLongEnough

			expect(actualStrength).toBe(isStrong)
		})
	})

	// Example 6: ANTI-PATTERN - Exhaustive Object Comparison Testing
	// ❌ VIOLATION: Testing every possible object comparison scenario exhaustively
	// ✅ PRODUCTION: Test only object comparisons that are critical to your business logic
	describe.each([
		[
			{ id: '1', name: 'John', age: 25 },
			{ id: '1', name: 'John', age: 25 },
			true,
		],
		[
			{ id: '2', name: 'Jane', age: 30 },
			{ id: '2', name: 'Jane', age: 30 },
			true,
		],
		[
			{ id: '3', name: 'Bob', age: 35 },
			{ id: '4', name: 'Bob', age: 35 },
			false,
		],
	])('Object comparison: %o vs %o', (obj1, obj2, shouldEqual) => {
		it(`should ${shouldEqual ? 'equal' : 'not equal'}`, () => {
			const areEqual = JSON.stringify(obj1) === JSON.stringify(obj2)
			expect(areEqual).toBe(shouldEqual)
		})
	})

	// Example 7: ANTI-PATTERN - Exhaustive Array Operation Testing
	// ❌ VIOLATION: Testing every possible array scenario exhaustively
	// ✅ PRODUCTION: Test only array operations that are critical to your business logic
	describe.each([
		[[1, 2, 3], 6],
		[[4, 5, 6], 15],
		[[10, 20, 30], 60],
		[[], 0],
		[[5], 5],
	])('Array sum: %o', (numbers, expectedSum) => {
		it(`should sum to ${String(expectedSum)}`, () => {
			const sum = numbers.reduce((acc, num) => acc + num, 0)
			expect(sum).toBe(expectedSum)
		})
	})

	// Example 8: ANTI-PATTERN - Exhaustive Error Type Testing
	// ❌ VIOLATION: Testing every possible JavaScript error type exhaustively
	// ✅ PRODUCTION: Test only error types that your application actually throws or handles
	describe.each([
		['TypeError', 'Invalid type provided'],
		['ReferenceError', 'Variable not defined'],
		['SyntaxError', 'Invalid syntax'],
		['RangeError', 'Value out of range'],
	])('Error handling: %s', (errorType, expectedMessage) => {
		it(`should handle ${errorType} correctly`, () => {
			const error = new Error(expectedMessage)
			error.name = errorType

			expect(error.name).toBe(errorType)
			expect(error.message).toBe(expectedMessage)
			expect(error).toBeInstanceOf(Error)
		})
	})
})

// Example 9: ANTI-PATTERN - Exhaustive Individual Parameterized Tests
// ❌ VIOLATION: Testing trivial operations with exhaustive permutations
// ✅ PRODUCTION: Don't test built-in JavaScript methods or trivial operations
describe('Individual Parameterized Tests', () => {
	it.each([
		[1, 1, 2],
		[2, 3, 5],
		[10, 20, 30],
		[0, 0, 0],
		[-1, 1, 0],
	])('should add %d + %d = %d', (a, b, expected) => {
		expect(a + b).toBe(expected)
	})

	it.each([
		['hello', 'HELLO'],
		['world', 'WORLD'],
		['test', 'TEST'],
		['', ''],
	])('should convert %s to uppercase %s', (input, expected) => {
		expect(input.toUpperCase()).toBe(expected)
	})
})
