import { eq } from 'drizzle-orm'

import { db } from '../../data-access/db.ts'
import { usersTable } from '../../data-access/schema.ts'

const findUserByEmail = async (email: string) => {
	const user = await db
		.select()
		.from(usersTable)
		.where(eq(usersTable.email, email))
		.limit(1)
		.then((rows) => rows[0] ?? null)

	return user
}

const findUserById = async (id: string) => {
	const user = await db
		.select()
		.from(usersTable)
		.where(eq(usersTable.id, id))
		.limit(1)
		.then((rows) => rows[0] ?? null)

	return user
}

// Update to create user with id
const createUser = async (
	id: string,
	email: string,
	firstName?: string,
	lastName?: string,
) => {
	return await db
		.insert(usersTable)
		.values({
			id,
			email,
			firstName,
			lastName,
		})
		.returning()
		.then((rows) => rows[0] ?? null)
}

const updateLastLogin = async (email: string) => {
	return db
		.update(usersTable)
		.set({
			lastLogin: new Date(),
		})
		.where(eq(usersTable.email, email))
		.returning()
		.then((rows) => rows[0] ?? null)
}

export { createUser, findUserByEmail, findUserById, updateLastLogin }
