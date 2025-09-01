import { describe, expect, it } from 'vitest'

/**
 * Example tests demonstrating Vitest's built-in parameterized testing
 * using describe.each() and it.each() for data-driven tests
 */

describe('Parameterized Testing Examples', () => {
	// Example 1: Testing validation with multiple inputs
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

	// Example 2: Testing user creation with different roles
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

	// Example 3: Testing authentication scenarios
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

	// Example 4: Testing API response status codes
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

	// Example 5: Testing password strength validation
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

	// Example 6: Testing with objects (more complex scenarios)
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

	// Example 7: Testing with arrays
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

	// Example 8: Testing error handling scenarios
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

// Example 9: Using it.each() for individual test cases
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
