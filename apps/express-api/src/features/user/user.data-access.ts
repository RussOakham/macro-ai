import { eq } from 'drizzle-orm'
import { fromError } from 'zod-validation-error'

import { db } from '../../data-access/db.ts'
import { AppError } from '../../utils/errors.ts'
import { pino } from '../../utils/logger.ts'

import { selectUserSchema, usersTable } from './user.schemas.ts'
import { TInsertUser, TUser } from './user.types.ts'

const { logger } = pino

// TODO: Refactor to UserRepository class function with IUserRepository interface
const findUserByEmail = async ({
	email,
}: {
	email: string
}): Promise<TUser | undefined> => {
	const users = await db
		.select()
		.from(usersTable)
		.where(eq(usersTable.email, email))
		.limit(1)

	return users[0]
}

const findUserById = async ({
	id,
}: {
	id: string
}): Promise<TUser | undefined> => {
	try {
		const users = await db
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
				'userDataAccess',
			)
		}

		return result.data
	} catch (error) {
		logger.error({
			msg: '[userDataAccess - findUserById]: Database error',
			id,
			error,
		})
		throw AppError.from(error, 'userDataAccess')
	}
}

const createUser = async ({
	userData,
}: {
	userData: TInsertUser
}): Promise<TUser> => {
	const [user] = await db.insert(usersTable).values(userData).returning()

	if (!user) {
		throw new Error('Failed to create user')
	}

	return user
}

const updateLastLogin = async ({
	id,
}: {
	id: string
}): Promise<TUser | undefined> => {
	const [user] = await db
		.update(usersTable)
		.set({ lastLogin: new Date() })
		.where(eq(usersTable.id, id))
		.returning()

	return user
}

const updateUser = async (
	id: string,
	userData: Partial<TInsertUser>,
): Promise<TUser | undefined> => {
	const [user] = await db
		.update(usersTable)
		.set(userData)
		.where(eq(usersTable.id, id))
		.returning()

	return user
}

export {
	createUser,
	findUserByEmail,
	findUserById,
	updateLastLogin,
	updateUser,
}
