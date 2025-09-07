import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import { config } from '../utils/load-config.ts'
import {
	getNeonDatabaseUrl,
	getCurrentDatabaseConfig,
	logEnvironmentInfo,
} from '../utils/neon-branching.ts'

// Get the appropriate database URL based on environment and branching
const databaseUrl = getNeonDatabaseUrl()
const dbConfig = getCurrentDatabaseConfig()

// Log comprehensive environment information for development debugging
logEnvironmentInfo()

console.log(`🗄️ Database Configuration:`, {
	environment: config.APP_ENV,
	branch: dbConfig.branch,
	description: dbConfig.description,
	url: databaseUrl.replace(/:[^:]+@/, ':***@'), // Hide password in logs
})

const pool = new Pool({
	connectionString: databaseUrl,
})

const db = drizzle(pool)

export { db }
