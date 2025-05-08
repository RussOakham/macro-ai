import { eq } from 'drizzle-orm'

import { db } from '../../data-access/db.ts'

import { usersTable } from './user.schemas.ts'
import { TInsertUser, TUser } from './user.types.ts'

const findUserByEmail = async (email: string): Promise<TUser | undefined> => {
	const users = await db
		.select()
		.from(usersTable)
		.where(eq(usersTable.email, email))
		.limit(1)

	return users[0]
}

const findUserById = async (id: string): Promise<TUser | undefined> => {
	const users = await db
		.select()
		.from(usersTable)
		.where(eq(usersTable.id, id))
		.limit(1)

	return users[0]
}

const createUser = async (userData: TInsertUser): Promise<TUser> => {
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
