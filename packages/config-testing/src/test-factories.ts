import { faker } from '@faker-js/faker'

/**
 * Test data factories using @faker-js/faker
 * These factories generate realistic test data for consistent testing
 */

type ApiResponse<T = unknown> = {
	data?: T
	error?: {
		code: string
		details?: unknown
		message: string
	}
	success: boolean
}

type Chat = {
	createdAt: string
	id: string
	messages: ChatMessage[]
	title: string
	updatedAt: string
	userId: string
}

type ChatMessage = {
	chatId: string
	content: string
	id: string
	role: 'assistant' | 'system' | 'user'
	timestamp: string
}

type DatabaseConfig = {
	database: string
	host: string
	password: string
	port: number
	ssl: boolean
	username: string
}

// Additional type definitions
type LoginCredentials = {
	email: string
	password: string
}

type Overrides<T extends object> = Partial<T>

type PaginatedResponse<T = unknown> = {
	data: T[]
	pagination: {
		limit: number
		page: number
		total: number
		totalPages: number
	}
	success: boolean
}

type RegistrationData = {
	confirmPassword: string
	email: string
	firstName: string
	lastName: string
	password: string
}

type TokenData = {
	accessToken: string
	expiresIn: number
	refreshToken: string
	tokenType: string
}

// Type definitions for test data
type User = {
	createdAt: string
	email: string
	firstName: string
	id: string
	lastName: string
	role?: string
	updatedAt: string
	username: string
}

// User-related test data factories
export const userFactory = {
	/**
	 * Generate a realistic user object for testing
	 */
	create: <T extends object = User>(
		overrides: Overrides<T> = {} as Overrides<T>,
	) =>
		({
			createdAt: faker.date.past().toISOString(),
			email: faker.internet.email(),
			firstName: faker.person.firstName(),
			id: faker.string.uuid(),
			lastName: faker.person.lastName(),
			updatedAt: faker.date.recent().toISOString(),
			username: faker.internet.username(),
			...(overrides as object),
		}) as T & User,

	/**
	 * Generate multiple users
	 */
	createMany: (count: number, overrides: Overrides<User> = {}) =>
		Array.from({ length: count }, () => userFactory.create(overrides)),

	/**
	 * Generate a user with specific role
	 */
	createWithRole: (role: string, overrides: Overrides<User> = {}) =>
		userFactory.create({ role, ...overrides }),
}

// Authentication-related test data factories
export const authFactory = {
	/**
	 * Generate login credentials
	 */
	createLoginCredentials: (overrides: Overrides<LoginCredentials> = {}) => ({
		email: faker.internet.email(),
		password: faker.internet.password({ length: 12 }),
		...overrides,
	}),

	/**
	 * Generate registration data
	 */
	createRegistrationData: (overrides: Overrides<RegistrationData> = {}) => ({
		confirmPassword: faker.internet.password({ length: 12 }),
		email: faker.internet.email(),
		firstName: faker.person.firstName(),
		lastName: faker.person.lastName(),
		password: faker.internet.password({ length: 12 }),
		...overrides,
	}),

	/**
	 * Generate JWT token data
	 */
	createTokenData: (overrides: Overrides<TokenData> = {}) => ({
		accessToken: faker.string.alphanumeric(100),
		expiresIn: 3600,
		refreshToken: faker.string.alphanumeric(100),
		tokenType: 'Bearer',
		...overrides,
	}),
}

// Chat-related test data factories
export const chatFactory = {
	/**
	 * Generate a chat object
	 */
	create: (overrides: Overrides<Chat> = {}) => ({
		createdAt: faker.date.past().toISOString(),
		id: faker.string.uuid(),
		title: faker.lorem.words(3),
		updatedAt: faker.date.recent().toISOString(),
		userId: faker.string.uuid(),
		...overrides,
	}),

	/**
	 * Generate multiple chats
	 */
	createMany: (count: number, overrides: Overrides<Chat> = {}) =>
		Array.from({ length: count }, () => chatFactory.create(overrides)),

	/**
	 * Generate a chat message
	 */
	createMessage: (overrides: Overrides<ChatMessage> = {}) => ({
		chatId: faker.string.uuid(),
		content: faker.lorem.paragraph(),
		id: faker.string.uuid(),
		role: faker.helpers.arrayElement(['user', 'assistant']),
		timestamp: faker.date.recent().toISOString(),
		...overrides,
	}),

	/**
	 * Generate multiple messages
	 */
	createMessages: (count: number, overrides: Overrides<ChatMessage> = {}) =>
		Array.from({ length: count }, () => chatFactory.createMessage(overrides)),
}

// API response factories
export const apiResponseFactory = {
	/**
	 * Generate an error API response
	 */
	createError: (overrides: Overrides<ApiResponse<never>> = {}) => ({
		error: {
			code: faker.helpers.arrayElement([
				'VALIDATION_ERROR',
				'AUTH_ERROR',
				'NOT_FOUND',
				'SERVER_ERROR',
			]),
			details: faker.lorem.paragraph(),
			message: faker.lorem.sentence(),
		},
		success: false,
		timestamp: new Date().toISOString(),
		...overrides,
	}),

	/**
	 * Generate a paginated response
	 */
	createPaginated: <T>(
		data: T[],
		overrides: Overrides<PaginatedResponse<T>> = {},
	) => ({
		data,
		pagination: {
			limit: faker.number.int({ max: 100, min: 10 }),
			page: faker.number.int({ max: 10, min: 1 }),
			total: data.length,
			totalPages: Math.ceil(data.length / 10),
		},
		success: true,
		timestamp: new Date().toISOString(),
		...overrides,
	}),

	/**
	 * Generate a successful API response
	 */
	createSuccess: <T>(data: T, overrides: Overrides<ApiResponse<T>> = {}) => ({
		data,
		message: faker.lorem.sentence(),
		success: true,
		timestamp: new Date().toISOString(),
		...overrides,
	}),
}

// Database-related test data factories
export const dbFactory = {
	/**
	 * Generate database connection config
	 */
	createConnectionConfig: (overrides: Overrides<DatabaseConfig> = {}) => ({
		database: faker.database.mongodbObjectId(),
		host: faker.internet.ip(),
		password: faker.internet.password(),
		port: faker.number.int({ max: 9999, min: 1000 }),
		username: faker.internet.username(),
		...overrides,
	}),
}

// Utility functions for test data generation
export const testUtils = {
	/**
	 * Generate a random array element
	 */
	randomArrayElement: <T>(array: T[]) => faker.helpers.arrayElement(array),

	/**
	 * Generate a random subset of an array
	 */
	randomArraySubset: <T>(array: T[], count?: number) => {
		const subsetCount = count ?? faker.number.int({ max: array.length, min: 1 })
		return faker.helpers.arrayElements(array, subsetCount)
	},

	/**
	 * Generate a random boolean
	 */
	randomBoolean: () => faker.datatype.boolean(),

	/**
	 * Generate a random email
	 */
	randomEmail: () => faker.internet.email(),

	/**
	 * Generate a random date in the future
	 */
	randomFutureDate: () => faker.date.future(),

	/**
	 * Generate a random ID
	 */
	randomId: () => faker.string.uuid(),

	/**
	 * Generate a random number within a range
	 */
	randomNumber: (min = 0, max = 100) => faker.number.int({ max, min }),

	/**
	 * Generate a random password
	 */
	randomPassword: (length = 12) => faker.internet.password({ length }),

	/**
	 * Generate a random date in the past
	 */
	randomPastDate: () => faker.date.past(),
}
