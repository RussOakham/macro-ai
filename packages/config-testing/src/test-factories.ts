import { faker } from '@faker-js/faker'

/**
 * Test data factories using @faker-js/faker
 * These factories generate realistic test data for consistent testing
 */

// Type definitions for test data
type User = {
	id: string
	email: string
	username: string
	firstName: string
	lastName: string
	createdAt: string
	updatedAt: string
	role?: string
}

type Overrides<T extends object> = Partial<T>

// Additional type definitions
type LoginCredentials = {
	email: string
	password: string
}

type RegistrationData = {
	email: string
	password: string
	confirmPassword: string
	firstName: string
	lastName: string
}

type ChatMessage = {
	id: string
	content: string
	role: 'user' | 'assistant' | 'system'
	timestamp: string
	chatId: string
}

type Chat = {
	id: string
	title: string
	createdAt: string
	updatedAt: string
	userId: string
	messages: ChatMessage[]
}

type TokenData = {
	accessToken: string
	refreshToken: string
	expiresIn: number
	tokenType: string
}

type ApiResponse<T = unknown> = {
	success: boolean
	data?: T
	error?: {
		message: string
		code: string
		details?: unknown
	}
}

type PaginatedResponse<T = unknown> = {
	success: boolean
	data: T[]
	pagination: {
		page: number
		limit: number
		total: number
		totalPages: number
	}
}

type DatabaseConfig = {
	host: string
	port: number
	database: string
	username: string
	password: string
	ssl: boolean
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
			id: faker.string.uuid(),
			email: faker.internet.email(),
			username: faker.internet.username(),
			firstName: faker.person.firstName(),
			lastName: faker.person.lastName(),
			createdAt: faker.date.past().toISOString(),
			updatedAt: faker.date.recent().toISOString(),
			...(overrides as object),
		}) as User & T,

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
	createTokenData: (overrides: Overrides<TokenData> = {}) => ({
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
	create: (overrides: Overrides<Chat> = {}) => ({
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
	createMany: (count: number, overrides: Overrides<Chat> = {}) =>
		Array.from({ length: count }, () => chatFactory.create(overrides)),

	/**
	 * Generate a chat message
	 */
	createMessage: (overrides: Overrides<ChatMessage> = {}) => ({
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
	createMessages: (count: number, overrides: Overrides<ChatMessage> = {}) =>
		Array.from({ length: count }, () => chatFactory.createMessage(overrides)),
}

// API response factories
export const apiResponseFactory = {
	/**
	 * Generate a successful API response
	 */
	createSuccess: <T>(data: T, overrides: Overrides<ApiResponse<T>> = {}) => ({
		success: true,
		data,
		message: faker.lorem.sentence(),
		timestamp: new Date().toISOString(),
		...overrides,
	}),

	/**
	 * Generate an error API response
	 */
	createError: (overrides: Overrides<ApiResponse<never>> = {}) => ({
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
	createPaginated: <T>(
		data: T[],
		overrides: Overrides<PaginatedResponse<T>> = {},
	) => ({
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
	createConnectionConfig: (overrides: Overrides<DatabaseConfig> = {}) => ({
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
