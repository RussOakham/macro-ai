/**
 * Environment variable schema for Lambda API
 * Defines and validates all environment variables used in the Lambda function
 */

import { z } from 'zod'

const envSchema = z.object({
	// Node.js Environment
	NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),

	// AWS Lambda Environment Variables (automatically set by AWS)
	AWS_REGION: z.string().min(1, 'AWS region is required').default('us-east-1'),
	AWS_LAMBDA_FUNCTION_NAME: z
		.string()
		.min(1, 'Lambda function name is required')
		.default('macro-ai-lambda'),
	AWS_LAMBDA_RUNTIME_API: z.string().optional(),
	LAMBDA_RUNTIME_DIR: z.string().optional(),

	// Lambda Configuration (optional overrides)
	LAMBDA_MEMORY_SIZE: z.coerce.number().min(128).max(10240).optional(),
	LAMBDA_TIMEOUT: z.coerce.number().min(1).max(900).optional(),

	// Parameter Store Configuration (optional overrides)
	PARAMETER_STORE_CACHE_TTL: z.coerce.number().min(60).max(3600).default(300), // 5 minutes

	// Logging Configuration
	LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

	// Development/Testing Environment Variables (optional)
	DEBUG: z.string().optional(),
	VITEST: z.string().optional(),

	// Build-time Environment Variables (set by esbuild)
	BUILD_TIME: z.string().optional(),
	BUILD_VERSION: z.string().optional(),
})

type TEnv = z.infer<typeof envSchema>

export { envSchema }
export type { TEnv }
