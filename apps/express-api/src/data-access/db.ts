import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import { assertConfig } from '../../config/default.ts'

const config = assertConfig()

const pool = new Pool({
	connectionString: config.relationalDatabaseUrl,
})

const db = drizzle({ client: pool })

export { db }
