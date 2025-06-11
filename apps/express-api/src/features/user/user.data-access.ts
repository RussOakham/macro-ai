import { eq } from 'drizzle-orm'

import { db } from '../../data-access/db.ts'
import {
	EnhancedResult,
	tryCatch,
} from '../../utils/error-handling/try-catch.ts'
import { AppError } from '../../utils/errors.ts'
import { safeValidateSchema } from '../../utils/response-handlers.ts'

import { selectUserSchema, usersTable } from './user.schemas.ts'
import { IUserRepository, TInsertUser, TUser } from './user.types.ts'

/**
 * UserRepository class that implements the IUserRepository interface
 * Handles all user-related database operations
 */
class UserRepository implements IUserRepository {
	private readonly db: typeof db

	constructor(database: typeof db = db) {
		this.db = database
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
		const { data: users, error } = await tryCatch(
			this.db
				.select()
				.from(usersTable)
				.where(eq(usersTable.email, email))
				.limit(1),
			'userRepository - findUserByEmail',
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
