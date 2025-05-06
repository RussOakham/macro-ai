import { eq } from 'drizzle-orm'

import { db } from '../../data-access/db.ts'

import { usersTable } from './user.schema.ts'
import { InsertUser, User } from './user.types.ts'

const findUserByEmail = async (email: string): Promise<User | undefined> => {
	const users = await db
		.select()
		.from(usersTable)
		.where(eq(usersTable.email, email))
		.limit(1)

	return users[0]
}

const findUserById = async (id: string): Promise<User | undefined> => {
	const users = await db
		.select()
		.from(usersTable)
		.where(eq(usersTable.id, id))
		.limit(1)

	return users[0]
}

const createUser = async (userData: InsertUser): Promise<User> => {
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
}): Promise<User | undefined> => {
	const [user] = await db
		.update(usersTable)
		.set({ lastLogin: new Date() })
		.where(eq(usersTable.id, id))
		.returning()

	return user
}

const updateUser = async (
	id: string,
	userData: Partial<InsertUser>,
): Promise<User | undefined> => {
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
