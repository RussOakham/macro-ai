import { eq } from 'drizzle-orm'

import { db } from '../../data-access/db.ts'
import { tryCatch } from '../../utils/error-handling/try-catch.ts'
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
	 * @returns The user object or undefined if not found
	 */
	public async findUserByEmail({
		email,
	}: {
		email: string
	}): Promise<TUser | undefined> {
		const { data: users, error } = await tryCatch(
			this.db
				.select()
				.from(usersTable)
				.where(eq(usersTable.email, email))
				.limit(1),
			'userRepository - findUserByEmail',
		)

		if (error) {
			throw AppError.from(error, 'userRepository')
		}

		// If no user found, return undefined
		if (!users.length) return undefined

		// Validate the returned user with Zod
		const result = safeValidateSchema(
			users[0],
			selectUserSchema,
			'userRepository',
		)

		if (result.error) {
			throw AppError.from(result.error, 'userRepository')
		}

		return result.data
	}

	/**
	 * Find a user by ID
	 * @param id The user's unique identifier
	 * @returns The user object or undefined if not found
	 */
	public async findUserById({
		id,
	}: {
		id: string
	}): Promise<TUser | undefined> {
		const { data: users, error } = await tryCatch(
			this.db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1),
			'userRepository - findUserById',
		)

		if (error) {
			throw AppError.from(error, 'userRepository')
		}

		// If no user found, return undefined
		if (!users.length) return undefined

		// Validate the returned user with Zod
		const result = safeValidateSchema(
			users[0],
			selectUserSchema,
			'userRepository',
		)

		if (result.error) {
			throw AppError.from(result.error, 'userRepository')
		}

		return result.data
	}

	/**
	 * Create a new user
	 * @param userData The user data to insert
	 * @returns The created user object
	 */
	public async createUser({
		userData,
	}: {
		userData: TInsertUser
	}): Promise<TUser> {
		const { data: user, error } = await tryCatch(
			this.db.insert(usersTable).values(userData).returning(),
			'userRepository - createUser',
		)

		if (error) {
			throw AppError.from(error, 'userRepository')
		}

		// If no user created, throw error
		if (!user.length) {
			throw AppError.internal('Failed to create user', 'userRepository')
		}

		// Validate the returned user with Zod
		const result = safeValidateSchema(user, selectUserSchema, 'userRepository')

		if (result.error) {
			throw AppError.from(result.error, 'userRepository')
		}

		return result.data
	}

	/**
	 * Update a user's last login timestamp
	 * @param id The user's unique identifier
	 * @returns The updated user object or undefined if not found
	 */
	public async updateLastLogin({
		id,
	}: {
		id: string
	}): Promise<TUser | undefined> {
		const { data: user, error } = await tryCatch(
			this.db
				.update(usersTable)
				.set({ lastLogin: new Date() })
				.where(eq(usersTable.id, id))
				.returning(),
			'userRepository - updateLastLogin',
		)

		if (error) {
			throw AppError.from(error, 'userRepository')
		}

		// If no user found, return undefined
		if (!user.length) return undefined

		// Validate the returned user with Zod
		const result = safeValidateSchema(user, selectUserSchema, 'userRepository')

		if (result.error) {
			throw AppError.from(result.error, 'userRepository')
		}

		return result.data
	}

	/**
	 * Update a user's profile
	 * @param id The user's unique identifier
	 * @param userData The user data to update
	 * @returns The updated user object or undefined if not found
	 */
	public async updateUser(
		id: string,
		userData: Partial<TInsertUser>,
	): Promise<TUser | undefined> {
		const { data: user, error } = await tryCatch(
			this.db
				.update(usersTable)
				.set(userData)
				.where(eq(usersTable.id, id))
				.returning(),
			'userRepository - updateUser',
		)

		if (error) {
			throw AppError.from(error, 'userRepository')
		}

		if (!user.length) return undefined

		// Validate the returned user with Zod
		const result = safeValidateSchema(user, selectUserSchema, 'userRepository')

		if (result.error) {
			throw AppError.from(result.error, 'userRepository')
		}

		return result.data
	}
}

// Create an instance of the UserRepository
const userRepository = new UserRepository()

export { userRepository }
