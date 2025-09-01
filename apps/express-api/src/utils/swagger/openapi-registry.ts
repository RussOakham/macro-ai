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
			.record(z.string(), z.any())
			.nullable()
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
			.record(z.string(), z.any())
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

const ConflictErrorSchema = registerZodSchema(
	'ConflictError',
	z.object({
		message: z.string().openapi({
			description: 'Conflict error message',
			example: 'Resource conflict',
		}),
	}),
	'Resource conflict error response',
)

const ForbiddenErrorSchema = registerZodSchema(
	'ForbiddenError',
	z.object({
		message: z.string().openapi({
			description: 'Forbidden error message',
			example: 'Forbidden',
		}),
	}),
	'Forbidden access error response',
)

// Cognito-specific error schemas
const CognitoCodeMismatchErrorSchema = registerZodSchema(
	'CognitoCodeMismatchError',
	z.object({
		message: z.string().openapi({
			description: 'Invalid verification code error message',
			example: 'Invalid verification code',
		}),
	}),
	'Invalid verification code error response',
)

const CognitoExpiredCodeErrorSchema = registerZodSchema(
	'CognitoExpiredCodeError',
	z.object({
		message: z.string().openapi({
			description: 'Expired verification code error message',
			example: 'Verification code has expired',
		}),
	}),
	'Expired verification code error response',
)

const CognitoUserNotConfirmedErrorSchema = registerZodSchema(
	'CognitoUserNotConfirmedError',
	z.object({
		message: z.string().openapi({
			description: 'User not confirmed error message',
			example: 'User is not confirmed',
		}),
	}),
	'User not confirmed error response',
)

const CognitoUsernameExistsErrorSchema = registerZodSchema(
	'CognitoUsernameExistsError',
	z.object({
		message: z.string().openapi({
			description: 'User already exists error message',
			example: 'User already exists',
		}),
	}),
	'User already exists error response',
)

type TErrorResponse = z.infer<typeof ErrorResponseSchema>
type TRateLimitError = z.infer<typeof RateLimitErrorSchema>
type TValidationError = z.infer<typeof ValidationErrorSchema>
type TInternalServerError = z.infer<typeof InternalServerErrorSchema>
type TUnauthorizedError = z.infer<typeof UnauthorizedErrorSchema>
type TNotFoundError = z.infer<typeof NotFoundErrorSchema>
type TConflictError = z.infer<typeof ConflictErrorSchema>
type TForbiddenError = z.infer<typeof ForbiddenErrorSchema>
type TCognitoCodeMismatchError = z.infer<typeof CognitoCodeMismatchErrorSchema>
type TCognitoExpiredCodeError = z.infer<typeof CognitoExpiredCodeErrorSchema>
type TCognitoUserNotConfirmedError = z.infer<
	typeof CognitoUserNotConfirmedErrorSchema
>
type TCognitoUsernameExistsError = z.infer<
	typeof CognitoUsernameExistsErrorSchema
>

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
	CognitoCodeMismatchErrorSchema,
	CognitoExpiredCodeErrorSchema,
	CognitoUsernameExistsErrorSchema,
	CognitoUserNotConfirmedErrorSchema,
	ConflictErrorSchema,
	ErrorResponseSchema,
	ForbiddenErrorSchema,
	InternalServerErrorSchema,
	NotFoundErrorSchema,
	RateLimitErrorSchema,
	registerZodSchema,
	registry,
	UnauthorizedErrorSchema,
	ValidationErrorSchema,
}

export type {
	TCognitoCodeMismatchError,
	TCognitoExpiredCodeError,
	TCognitoUsernameExistsError,
	TCognitoUserNotConfirmedError,
	TConflictError,
	TErrorResponse,
	TForbiddenError,
	TInternalServerError,
	TNotFoundError,
	TRateLimitError,
	TUnauthorizedError,
	TValidationError,
}
