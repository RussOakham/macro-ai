import { eq } from 'drizzle-orm'

import { checkDatabaseConnection, db } from '../../data-access/db.ts'
import {
	EnhancedResult,
	tryCatch,
} from '../../utils/error-handling/try-catch.ts'
import { AppError, ErrorType, isDatabaseError } from '../../utils/errors.ts'
import { pino } from '../../utils/logger.ts'
import { safeValidateSchema } from '../../utils/response-handlers.ts'

import { selectUserSchema, usersTable } from './user.schemas.ts'
import { IUserRepository, TInsertUser, TUser } from './user.types.ts'

const { logger } = pino

/**
 * UserRepository class that implements the IUserRepository interface
 * Handles all user-related database operations
 */
class UserRepository implements IUserRepository {
	private readonly db: typeof db

	constructor(database: typeof db = db) {
		this.db = database
	}

	// Add a method to handle database errors with retry logic
	private async executeWithRetry<T>(
		operation: () => Promise<T>,
		context: string,
		maxRetries = 3,
	): Promise<EnhancedResult<T>> {
		let retries = 0
		let delay = 500 // Start with 500ms delay

		while (retries <= maxRetries) {
			const { data, error } = await tryCatch(
				operation(),
				`userRepository - ${context}`,
			)

			if (!error) {
				return { data, error: null }
			}

			// If it's a database error that might be transient, retry
			if (
				isDatabaseError(error) &&
				(error.type === ErrorType.DatabaseConnectionError ||
					error.type === ErrorType.DatabaseTransactionError)
			) {
				retries++

				if (retries <= maxRetries) {
					logger.warn({
						msg: `Database operation failed, retrying (${retries.toString()}/${maxRetries.toString()})`,
						context,
						error: error.message,
						type: error.type,
					})

					// Check if database is still connected
					const { status } = await checkDatabaseConnection()
					if (status === 'error') {
						logger.error({
							msg: 'Database connection lost during operation',
							context,
						})
						// Don't retry if connection is completely lost
						break
					}

					// Wait before retrying with exponential backoff
					await new Promise((resolve) => setTimeout(resolve, delay))
					delay *= 2 // Exponential backoff
					continue
				}
			}

			// For non-retriable errors or max retries reached
			return { data: null, error }
		}

		// If we've exhausted retries
		return {
			data: null,
			error: AppError.internal(
				`Failed to execute database operation after ${maxRetries.toString()} retries`,
				`userRepository - ${context}`,
			),
		}
	}

	/**
	 * Find a user by email
	 * @param email The user's email address
	 * @returns EnhancedResult with the user object or undefined if not found
	 */
	public async findUserByEmail({
		email,
	}: {
		email: string
	}): Promise<EnhancedResult<TUser | undefined>> {
		const result = await this.executeWithRetry(
			() =>
				this.db
					.select()
					.from(usersTable)
					.where(eq(usersTable.email, email))
					.limit(1),
			'findUserByEmail',
		)

		if (result.error) {
			return { data: null, error: result.error }
		}

		const users = result.data

		// If no user found, return undefined
		if (!users.length) return { data: undefined, error: null }

		// Validate the returned user with Zod
		const { data: validationResult, error: validationError } =
			safeValidateSchema(
				users[0],
				selectUserSchema,
				'userRepository - findUserByEmail',
			)

		if (validationError) {
			return {
				data: null,
				error: AppError.from(
					validationError,
					'userRepository - findUserByEmail',
				),
			}
		}

		return { data: validationResult, error: null }
	}

	/**
	 * Find a user by ID
	 * @param id The user's unique identifier
	 * @returns EnhancedResult with the user object or undefined if not found
	 */
	public async findUserById({
		id,
	}: {
		id: string
	}): Promise<EnhancedResult<TUser | undefined>> {
		const { data: users, error } = await tryCatch(
			this.db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1),
			'userRepository - findUserById',
		)

		if (error) {
			return { data: null, error }
		}

		// If no user found, return undefined
		if (!users.length) return { data: undefined, error: null }

		// Validate the returned user with Zod
		const { data: validationResult, error: validationError } =
			safeValidateSchema(
				users[0],
				selectUserSchema,
				'userRepository - findUserById',
			)

		if (validationError) {
			return {
				data: null,
				error: AppError.from(validationError, 'userRepository - findUserById'),
			}
		}

		return { data: validationResult, error: null }
	}

	/**
	 * Create a new user
	 * @param userData The user data to insert
	 * @returns EnhancedResult with the created user object
	 */
	public async createUser({
		userData,
	}: {
		userData: TInsertUser
	}): Promise<EnhancedResult<TUser>> {
		const { data: user, error } = await tryCatch(
			this.db.insert(usersTable).values(userData).returning(),
			'userRepository - createUser',
		)

		if (error) {
			return { data: null, error }
		}

		// If no user created, return error
		if (!user.length) {
			return {
				data: null,
				error: AppError.internal(
					'Failed to create user',
					'userRepository - createUser',
				),
			}
		}

		// Validate the returned user with Zod
		const { data: validationResult, error: validationError } =
			safeValidateSchema(
				user[0],
				selectUserSchema,
				'userRepository - createUser',
			)

		if (validationError) {
			return {
				data: null,
				error: AppError.from(validationError, 'userRepository - createUser'),
			}
		}

		return { data: validationResult, error: null }
	}

	/**
	 * Update a user's last login timestamp
	 * @param id The user's unique identifier
	 * @returns EnhancedResult with the updated user object or undefined if not found
	 */
	public async updateLastLogin({
		id,
	}: {
		id: string
	}): Promise<EnhancedResult<TUser | undefined>> {
		const { data: user, error } = await tryCatch(
			this.db
				.update(usersTable)
				.set({ lastLogin: new Date() })
				.where(eq(usersTable.id, id))
				.returning(),
			'userRepository - updateLastLogin',
		)

		if (error) {
			return { data: null, error }
		}

		// If no user found, return undefined
		if (!user.length) return { data: undefined, error: null }

		// Validate the returned user with Zod
		const { data: validationResult, error: validationError } =
			safeValidateSchema(
				user[0],
				selectUserSchema,
				'userRepository - updateLastLogin',
			)

		if (validationError) {
			return {
				data: null,
				error: AppError.from(
					validationError,
					'userRepository - updateLastLogin',
				),
			}
		}

		return { data: validationResult, error: null }
	}

	/**
	 * Update a user's profile
	 * @param id The user's unique identifier
	 * @param userData The user data to update
	 * @returns EnhancedResult with the updated user object or undefined if not found
	 */
	public async updateUser(
		id: string,
		userData: Partial<TInsertUser>,
	): Promise<EnhancedResult<TUser | undefined>> {
		const { data: user, error } = await tryCatch(
			this.db
				.update(usersTable)
				.set(userData)
				.where(eq(usersTable.id, id))
				.returning(),
			'userRepository - updateUser',
		)

		if (error) {
			return { data: null, error }
		}

		// If no user found, return undefined
		if (!user.length) return { data: undefined, error: null }

		// Validate the returned user with Zod
		const { data: validationResult, error: validationError } =
			safeValidateSchema(
				user[0],
				selectUserSchema,
				'userRepository - updateUser',
			)

		if (validationError) {
			return {
				data: null,
				error: AppError.from(validationError, 'userRepository - updateUser'),
			}
		}

		return { data: validationResult, error: null }
	}
}

// Create an instance of the UserRepository
const userRepository = new UserRepository()

export { userRepository }
