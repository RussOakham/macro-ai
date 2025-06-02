import {
	extendZodWithOpenApi,
	OpenAPIRegistry,
} from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'

extendZodWithOpenApi(z)

// Create a registry to store all schemas and routes
const registry = new OpenAPIRegistry()

// Helper function to register a schema and return it
const registerZodSchema = <T extends z.ZodType>(
	name: string,
	schema: T,
	description?: string,
): T => {
	registry.register(name, schema.openapi({ description }))
	return schema
}

// Register common schemas that will be reused
const ErrorResponseSchema = registerZodSchema(
	'ErrorResponse',
	z.object({
		message: z.string().openapi({ description: 'Error message' }),
		details: z
			.record(z.any())
			.optional()
			.openapi({ description: 'Error details' }),
	}),
	'Standard error response',
)

type TErrorResponse = z.infer<typeof ErrorResponseSchema>

// Register security schemes
registry.registerComponent('securitySchemes', 'cookieAuth', {
	type: 'apiKey',
	in: 'cookie',
	name: 'macro-ai-accessToken',
})

registry.registerComponent('securitySchemes', 'apiKey', {
	type: 'apiKey',
	in: 'header',
	name: 'x-api-key',
})

export { ErrorResponseSchema, registerZodSchema, registry }
export type { TErrorResponse }
