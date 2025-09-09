/* eslint-disable @typescript-eslint/no-explicit-any */
import { faker } from '@faker-js/faker'

/**
 * Test data factories using @faker-js/faker
 * These factories generate realistic test data for consistent testing
 */

// User-related test data factories
export const userFactory = {
	/**
	 * Generate a realistic user object for testing
	 */
	create: (overrides: Partial<any> = {}) => ({
		id: faker.string.uuid(),
		email: faker.internet.email(),
		username: faker.internet.username(),
		firstName: faker.person.firstName(),
		lastName: faker.person.lastName(),
		createdAt: faker.date.past().toISOString(),
		updatedAt: faker.date.recent().toISOString(),
		...overrides,
	}),

	/**
	 * Generate multiple users
	 */
	createMany: (count: number, overrides: Partial<any> = {}) =>
		Array.from({ length: count }, () => userFactory.create(overrides)),

	/**
	 * Generate a user with specific role
	 */
	createWithRole: (role: string, overrides: Partial<any> = {}) =>
		userFactory.create({ role, ...overrides }),
}

// Authentication-related test data factories
export const authFactory = {
	/**
	 * Generate login credentials
	 */
	createLoginCredentials: (overrides: Partial<any> = {}) => ({
		email: faker.internet.email(),
		password: faker.internet.password({ length: 12 }),
		...overrides,
	}),

	/**
	 * Generate registration data
	 */
	createRegistrationData: (overrides: Partial<any> = {}) => ({
		email: faker.internet.email(),
		password: faker.internet.password({ length: 12 }),
		confirmPassword: faker.internet.password({ length: 12 }),
		firstName: faker.person.firstName(),
		lastName: faker.person.lastName(),
		...overrides,
	}),

	/**
	 * Generate JWT token data
	 */
	createTokenData: (overrides: Partial<any> = {}) => ({
		accessToken: faker.string.alphanumeric(100),
		refreshToken: faker.string.alphanumeric(100),
		expiresIn: 3600,
		tokenType: 'Bearer',
		...overrides,
	}),
}

// Chat-related test data factories
export const chatFactory = {
	/**
	 * Generate a chat object
	 */
	create: (overrides: Partial<any> = {}) => ({
		id: faker.string.uuid(),
		title: faker.lorem.words(3),
		userId: faker.string.uuid(),
		createdAt: faker.date.past().toISOString(),
		updatedAt: faker.date.recent().toISOString(),
		...overrides,
	}),

	/**
	 * Generate multiple chats
	 */
	createMany: (count: number, overrides: Partial<any> = {}) =>
		Array.from({ length: count }, () => chatFactory.create(overrides)),

	/**
	 * Generate a chat message
	 */
	createMessage: (overrides: Partial<any> = {}) => ({
		id: faker.string.uuid(),
		chatId: faker.string.uuid(),
		content: faker.lorem.paragraph(),
		role: faker.helpers.arrayElement(['user', 'assistant']),
		timestamp: faker.date.recent().toISOString(),
		...overrides,
	}),

	/**
	 * Generate multiple messages
	 */
	createMessages: (count: number, overrides: Partial<any> = {}) =>
		Array.from({ length: count }, () => chatFactory.createMessage(overrides)),
}

// API response factories
export const apiResponseFactory = {
	/**
	 * Generate a successful API response
	 */
	createSuccess: <T>(data: T, overrides: Partial<any> = {}) => ({
		success: true,
		data,
		message: faker.lorem.sentence(),
		timestamp: new Date().toISOString(),
		...overrides,
	}),

	/**
	 * Generate an error API response
	 */
	createError: (overrides: Partial<any> = {}) => ({
		success: false,
		error: {
			code: faker.helpers.arrayElement([
				'VALIDATION_ERROR',
				'AUTH_ERROR',
				'NOT_FOUND',
				'SERVER_ERROR',
			]),
			message: faker.lorem.sentence(),
			details: faker.lorem.paragraph(),
		},
		timestamp: new Date().toISOString(),
		...overrides,
	}),

	/**
	 * Generate a paginated response
	 */
	createPaginated: <T>(data: T[], overrides: Partial<any> = {}) => ({
		success: true,
		data,
		pagination: {
			page: faker.number.int({ min: 1, max: 10 }),
			limit: faker.number.int({ min: 10, max: 100 }),
			total: data.length,
			totalPages: Math.ceil(data.length / 10),
		},
		timestamp: new Date().toISOString(),
		...overrides,
	}),
}

// Database-related test data factories
export const dbFactory = {
	/**
	 * Generate database connection config
	 */
	createConnectionConfig: (overrides: Partial<any> = {}) => ({
		host: faker.internet.ip(),
		port: faker.number.int({ min: 1000, max: 9999 }),
		database: faker.database.mongodbObjectId(),
		username: faker.internet.username(),
		password: faker.internet.password(),
		...overrides,
	}),
}

// Utility functions for test data generation
export const testUtils = {
	/**
	 * Generate a random ID
	 */
	randomId: () => faker.string.uuid(),

	/**
	 * Generate a random email
	 */
	randomEmail: () => faker.internet.email(),

	/**
	 * Generate a random password
	 */
	randomPassword: (length = 12) => faker.internet.password({ length }),

	/**
	 * Generate a random date in the past
	 */
	randomPastDate: () => faker.date.past(),

	/**
	 * Generate a random date in the future
	 */
	randomFutureDate: () => faker.date.future(),

	/**
	 * Generate a random number within a range
	 */
	randomNumber: (min = 0, max = 100) => faker.number.int({ min, max }),

	/**
	 * Generate a random boolean
	 */
	randomBoolean: () => faker.datatype.boolean(),

	/**
	 * Generate a random array element
	 */
	randomArrayElement: <T>(array: T[]) => faker.helpers.arrayElement(array),

	/**
	 * Generate a random subset of an array
	 */
	randomArraySubset: <T>(array: T[], count?: number) => {
		const subsetCount = count ?? faker.number.int({ min: 1, max: array.length })
		return faker.helpers.arrayElements(array, subsetCount)
	},
}
