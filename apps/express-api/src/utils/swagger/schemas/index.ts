// Central export file for all schema definitions
import { authSchemas } from './auth.schemas.ts'
import { errorSchemas } from './error.schemas.ts'
import { healthSchemas } from './health.schemas.ts'
import { userSchemas } from './user.schemas.ts'

// Combine all schemas into a single object
export const schemas = {
	...userSchemas,
	...authSchemas,
	...healthSchemas,
	...errorSchemas,
}
