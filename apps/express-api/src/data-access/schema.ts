import {
	boolean,
	pgTable,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
	vector,
} from 'drizzle-orm/pg-core'

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

const chatVectorsTable = pgTable('chat_vectors', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id').references(() => usersTable.id),
	embedding: vector('vector', { dimensions: 1536 }),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at').defaultNow(),
})

export { chatVectorsTable, usersTable }
