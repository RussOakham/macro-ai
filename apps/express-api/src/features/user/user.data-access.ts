import { eq } from 'drizzle-orm'
import { fromError } from 'zod-validation-error'

import { db } from '../../data-access/db.ts'
import { AppError } from '../../utils/errors.ts'
import { pino } from '../../utils/logger.ts'

import { selectUserSchema, usersTable } from './user.schemas.ts'
import { IUserRepository, TInsertUser, TUser } from './user.types.ts'

const { logger } = pino

/**
 * UserRepository class that implements the IUserRepository interface
 * Handles all user-related database operations
 */
class UserRepository implements IUserRepository {
	private db: typeof db

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
		try {
			const users = await this.db
				.select()
				.from(usersTable)
				.where(eq(usersTable.email, email))
				.limit(1)

			// If no user found, return undefined
			if (!users.length) return undefined

			// Validate the returned user with Zod
			const result = selectUserSchema.safeParse(users[0])

			if (!result.success) {
				const validationError = fromError(result.error)
				throw AppError.validation(
					`Invalid user data returned from database: ${validationError.message}`,
					{ details: validationError.details },
					'userRepository',
				)
			}

			return result.data
		} catch (error) {
			logger.error({
				msg: '[userRepository - findUserByEmail]: Database error',
				email,
				error,
			})
			throw AppError.from(error, 'userRepository')
		}
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
		try {
			const users = await this.db
				.select()
				.from(usersTable)
				.where(eq(usersTable.id, id))
				.limit(1)

			// If no user found, return undefined
			if (!users.length) return undefined

			// Validate the returned user with Zod
			const result = selectUserSchema.safeParse(users[0])

			if (!result.success) {
				const validationError = fromError(result.error)
				throw AppError.validation(
					`Invalid user data returned from database: ${validationError.message}`,
					{ details: validationError.details },
					'userRepository',
				)
			}

			return result.data
		} catch (error) {
			logger.error({
				msg: '[userRepository - findUserById]: Database error',
				id,
				error,
			})
			throw AppError.from(error, 'userRepository')
		}
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
		try {
			const [user] = await this.db
				.insert(usersTable)
				.values(userData)
				.returning()

			if (!user) {
				throw AppError.internal('Failed to create user', 'userRepository')
			}

			// Validate the returned user with Zod
			const result = selectUserSchema.safeParse(user)

			if (!result.success) {
				const validationError = fromError(result.error)
				throw AppError.validation(
					`Invalid user data returned from database: ${validationError.message}`,
					{ details: validationError.details },
					'userRepository',
				)
			}

			return result.data
		} catch (error) {
			logger.error({
				msg: '[userRepository - createUser]: Database error',
				userData,
				error,
			})
			throw AppError.from(error, 'userRepository')
		}
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
		try {
			const [user] = await this.db
				.update(usersTable)
				.set({ lastLogin: new Date() })
				.where(eq(usersTable.id, id))
				.returning()

			if (!user) return undefined

			// Validate the returned user with Zod
			const result = selectUserSchema.safeParse(user)

			if (!result.success) {
				const validationError = fromError(result.error)
				throw AppError.validation(
					`Invalid user data returned from database: ${validationError.message}`,
					{ details: validationError.details },
					'userRepository',
				)
			}

			return result.data
		} catch (error) {
			logger.error({
				msg: '[userRepository - updateLastLogin]: Database error',
				id,
				error,
			})
			throw AppError.from(error, 'userRepository')
		}
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
		try {
			const [user] = await this.db
				.update(usersTable)
				.set(userData)
				.where(eq(usersTable.id, id))
				.returning()

			if (!user) return undefined

			// Validate the returned user with Zod
			const result = selectUserSchema.safeParse(user)

			if (!result.success) {
				const validationError = fromError(result.error)
				throw AppError.validation(
					`Invalid user data returned from database: ${validationError.message}`,
					{ details: validationError.details },
					'userRepository',
				)
			}

			return result.data
		} catch (error) {
			logger.error({
				msg: '[userRepository - updateUser]: Database error',
				id,
				userData,
				error,
			})
			throw AppError.from(error, 'userRepository')
		}
	}
}

// Create an instance of the UserRepository
const userRepository = new UserRepository()

export { userRepository }
