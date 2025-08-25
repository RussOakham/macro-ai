import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import { config } from '../utils/load-config.ts'

const pool = new Pool({
	connectionString: config.RELATIONAL_DATABASE_URL,
})

const db = drizzle(pool)

export { db }
