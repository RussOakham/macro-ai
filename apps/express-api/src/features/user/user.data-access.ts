import { eq } from 'drizzle-orm'

import { db } from '../../data-access/db.ts'
import { tryCatch } from '../../utils/error-handling/try-catch.ts'
import { AppError, InternalError, Result } from '../../utils/errors.ts'
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
	 * @returns Result tuple with the user object or undefined if not found
	 */
	public findUserByEmail = async ({
		email,
	}: {
		email: string
	}): Promise<Result<TUser | undefined>> => {
		const [users, error] = await tryCatch(
			this.db
				.select()
				.from(usersTable)
				.where(eq(usersTable.email, email))
				.limit(1),
			'userRepository - findUserByEmail',
		)

		if (error) {
			return [null, error]
		}

		// If no user found, return undefined
		if (!users.length) return [undefined, null]

		// Validate the returned user with Zod
		const [validationResult, validationError] = safeValidateSchema(
			users[0],
			selectUserSchema,
			'userRepository - findUserByEmail',
		)

		if (validationError) {
			return [
				null,
				AppError.from(validationError, 'userRepository - findUserByEmail'),
			]
		}

		return [validationResult, null]
	}

	/**
	 * Find a user by ID
	 * @param id The user's unique identifier
	 * @returns Result tuple with the user object or undefined if not found
	 */
	public findUserById = async ({
		id,
	}: {
		id: string
	}): Promise<Result<TUser | undefined>> => {
		const [users, error] = await tryCatch(
			this.db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1),
			'userRepository - findUserById',
		)

		if (error) {
			return [null, error]
		}

		// If no user found, return undefined
		if (!users.length) return [undefined, null]

		// Validate the returned user with Zod
		const [validationResult, validationError] = safeValidateSchema(
			users[0],
			selectUserSchema,
			'userRepository - findUserById',
		)

		if (validationError) {
			return [
				null,
				AppError.from(validationError, 'userRepository - findUserById'),
			]
		}

		return [validationResult, null]
	}

	/**
	 * Create a new user
	 * @param userData The user data to insert
	 * @returns Result tuple with the created user object
	 */
	public createUser = async ({
		userData,
	}: {
		userData: TInsertUser
	}): Promise<Result<TUser>> => {
		const [user, error] = await tryCatch(
			this.db.insert(usersTable).values(userData).returning(),
			'userRepository - createUser',
		)

		if (error) {
			return [null, error]
		}

		// If no user created, return error
		if (!user.length) {
			return [
				null,
				new InternalError(
					'Failed to create user',
					'userRepository - createUser',
				),
			]
		}

		// Validate the returned user with Zod
		const [validationResult, validationError] = safeValidateSchema(
			user[0],
			selectUserSchema,
			'userRepository - createUser',
		)

		if (validationError) {
			return [
				null,
				AppError.from(validationError, 'userRepository - createUser'),
			]
		}

		return [validationResult, null]
	}

	/**
	 * Update a user's last login timestamp
	 * @param id The user's unique identifier
	 * @returns Result tuple with the updated user object or undefined if not found
	 */
	public updateLastLogin = async ({
		id,
	}: {
		id: string
	}): Promise<Result<TUser | undefined>> => {
		const [user, error] = await tryCatch(
			this.db
				.update(usersTable)
				.set({ lastLogin: new Date() })
				.where(eq(usersTable.id, id))
				.returning(),
			'userRepository - updateLastLogin',
		)

		if (error) {
			return [null, error]
		}

		// If no user found, return undefined
		if (!user.length) return [undefined, null]

		// Validate the returned user with Zod
		const [validationResult, validationError] = safeValidateSchema(
			user[0],
			selectUserSchema,
			'userRepository - updateLastLogin',
		)

		if (validationError) {
			return [
				null,
				AppError.from(validationError, 'userRepository - updateLastLogin'),
			]
		}

		return [validationResult, null]
	}

	/**
	 * Update a user's profile
	 * @param id The user's unique identifier
	 * @param userData The user data to update
	 * @returns Result tuple with the updated user object or undefined if not found
	 */
	public updateUser = async (
		id: string,
		userData: Partial<TInsertUser>,
	): Promise<Result<TUser | undefined>> => {
		const [user, error] = await tryCatch(
			this.db
				.update(usersTable)
				.set(userData)
				.where(eq(usersTable.id, id))
				.returning(),
			'userRepository - updateUser',
		)

		if (error) {
			return [null, error]
		}

		// If no user found, return undefined
		if (!user.length) return [undefined, null]

		// Validate the returned user with Zod
		const [validationResult, validationError] = safeValidateSchema(
			user[0],
			selectUserSchema,
			'userRepository - updateUser',
		)

		if (validationError) {
			return [
				null,
				AppError.from(validationError, 'userRepository - updateUser'),
			]
		}

		return [validationResult, null]
	}
}

// Create an instance of the UserRepository
const userRepository = new UserRepository()

export { userRepository }
