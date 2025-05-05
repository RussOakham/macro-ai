import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import { config } from '../../config/default.ts'

const pool = new Pool({
	connectionString: config.relationalDatabaseUrl,
})

const db = drizzle({ client: pool })

export { db }
