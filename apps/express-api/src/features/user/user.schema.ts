import {
	boolean,
	pgTable,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'

const usersTable = pgTable(
	'users',
	{
		id: uuid('id').primaryKey(),
		email: varchar('email', { length: 255 }).notNull().unique(),
		emailVerified: boolean('email_verified').default(false),
		firstName: varchar('first_name', { length: 255 }),
		lastName: varchar('last_name', { length: 255 }),
		createdAt: timestamp('created_at').defaultNow(),
		updatedAt: timestamp('updated_at').defaultNow(),
		lastLogin: timestamp('last_login'),
	},
	(users) => [uniqueIndex('email_idx').on(users.email)],
)

// Generate Zod schemas for type validation
const insertUserSchema = createInsertSchema(usersTable)
const selectUserSchema = createSelectSchema(usersTable)

export { insertUserSchema, selectUserSchema, usersTable }
