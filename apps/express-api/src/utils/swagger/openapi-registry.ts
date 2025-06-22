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

// Centralized error response schemas for common middleware and service errors
const RateLimitErrorSchema = registerZodSchema(
	'RateLimitError',
	z.object({
		status: z.number().openapi({
			description: 'HTTP status code',
			example: 429,
		}),
		message: z.string().openapi({
			description: 'Rate limit error message',
			example: 'Too many requests, please try again later.',
		}),
	}),
	'Rate limit exceeded error response',
)

const ValidationErrorSchema = registerZodSchema(
	'ValidationError',
	z.object({
		message: z.string().openapi({
			description: 'Validation error message',
			example: 'Validation Failed',
		}),
		details: z
			.record(z.any())
			.optional()
			.openapi({
				description: 'Detailed validation error information',
				example: { field: 'email', message: 'Invalid email format' },
			}),
	}),
	'Request validation error response',
)

const InternalServerErrorSchema = registerZodSchema(
	'InternalServerError',
	z.object({
		message: z.string().openapi({
			description: 'Internal server error message',
			example: 'Internal server error',
		}),
	}),
	'Internal server error response',
)

const UnauthorizedErrorSchema = registerZodSchema(
	'UnauthorizedError',
	z.object({
		message: z.string().openapi({
			description: 'Unauthorized error message',
			example: 'Authentication required',
		}),
	}),
	'Unauthorized access error response',
)

const NotFoundErrorSchema = registerZodSchema(
	'NotFoundError',
	z.object({
		message: z.string().openapi({
			description: 'Not found error message',
			example: 'Resource not found',
		}),
	}),
	'Resource not found error response',
)

type TErrorResponse = z.infer<typeof ErrorResponseSchema>
type TRateLimitError = z.infer<typeof RateLimitErrorSchema>
type TValidationError = z.infer<typeof ValidationErrorSchema>
type TInternalServerError = z.infer<typeof InternalServerErrorSchema>
type TUnauthorizedError = z.infer<typeof UnauthorizedErrorSchema>
type TNotFoundError = z.infer<typeof NotFoundErrorSchema>

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

export {
	ErrorResponseSchema,
	InternalServerErrorSchema,
	NotFoundErrorSchema,
	RateLimitErrorSchema,
	registerZodSchema,
	registry,
	UnauthorizedErrorSchema,
	ValidationErrorSchema,
}

export type {
	TErrorResponse,
	TInternalServerError,
	TNotFoundError,
	TRateLimitError,
	TUnauthorizedError,
	TValidationError,
}
