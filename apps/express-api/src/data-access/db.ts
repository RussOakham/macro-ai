import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import { config } from '../../config/default.ts'
import { tryCatch } from '../utils/error-handling/try-catch.ts'
import { AppError, ErrorType } from '../utils/errors.ts'
import { pino } from '../utils/logger.ts'

const { logger } = pino

// Maximum number of connection retries
const MAX_CONNECTION_RETRIES = 5
// Initial delay between retries in ms (will be increased exponentially)
const INITIAL_RETRY_DELAY = 1000

/**
 * Creates a database pool with connection error handling
 * @returns A configured Postgres connection pool
 */
const createDatabasePool = async () => {
	let retries = 0
	let delay = INITIAL_RETRY_DELAY

	while (retries < MAX_CONNECTION_RETRIES) {
		try {
			const pool = new Pool({
				connectionString: config.relationalDatabaseUrl,
				// Add connection timeout to avoid hanging
				connectionTimeoutMillis: 5000,
				// Add idle timeout to clean up unused connections
				idleTimeoutMillis: 30000,
				// Add max clients to prevent connection exhaustion
				max: 20,
			})

			// Test the connection
			const client = await pool.connect()
			client.release()

			logger.info('Database connection established successfully')
			return pool
		} catch (error) {
			retries++

			// Format error message based on error type
			let errorMessage = 'Unknown database connection error'
			if (error instanceof Error) {
				errorMessage = error.message
			}

			logger.error({
				msg: `Database connection attempt ${retries.toString()} failed: ${errorMessage}`,
				retryIn: `${delay.toString()}ms`,
				maxRetries: MAX_CONNECTION_RETRIES,
			})

			if (retries >= MAX_CONNECTION_RETRIES) {
				logger.error('Maximum database connection retries reached, giving up')
				throw new AppError({
					message: 'Failed to connect to database after multiple attempts',
					type: ErrorType.DatabaseError,
					status: 500,
					service: 'database',
					details: error,
				})
			}

			// Wait before retrying with exponential backoff
			await new Promise((resolve) => setTimeout(resolve, delay))
			delay *= 2 // Exponential backoff
		}
	}

	// This should never be reached due to the throw above, but TypeScript needs it
	throw new Error('Failed to connect to database')
}

// Initialize the pool and drizzle instance
let pool: Pool
let db: ReturnType<typeof drizzle>

const initializeDatabase = async () => {
	const { data: dbPool, error } = await tryCatch(
		createDatabasePool(),
		'database - initialization',
	)

	if (error) {
		logger.error({
			msg: 'Failed to initialize database',
			error: error.message,
		})
		throw error
	}

	pool = dbPool
	db = drizzle({ client: pool })

	// Add event listeners for connection issues
	pool.on('error', (err) => {
		logger.error({
			msg: 'Unexpected database pool error',
			error: err.message,
		})
	})

	return { pool, db }
}

// Initialize database connection
const { pool: initializedPool, db: initializedDb } = await initializeDatabase()

// Export the initialized instances
export { initializedDb as db, initializedPool as pool }

// Add a health check function to verify database connectivity
export const checkDatabaseConnection = async () => {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { data, error } = await tryCatch(
		pool.query('SELECT 1'),
		'database - health check',
	)

	if (error) {
		return {
			status: 'error',
			message: 'Database connection failed',
			error: error.message,
		}
	}

	return {
		status: 'ok',
		message: 'Database connection successful',
	}
}
