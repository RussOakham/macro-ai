import { z } from 'zod'

// ============================================================================
// SHARED SCHEMAS
// ============================================================================

// Auth tokens schema
const authTokensSchema = z
	.object({
		accessToken: z.string(),
		refreshToken: z.string(),
		expiresIn: z.number(),
	})
	.passthrough()

// Basic auth user schema (from Cognito)
const authUserSchema = z
	.object({
		id: z.string(),
		email: z.string(),
		emailVerified: z.boolean(),
	})
	.passthrough()

// Basic message response schema
const messageResponseSchema = z
	.object({
		message: z.string(),
	})
	.passthrough()

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

// POST /auth/register request body
const postAuthregister_Body = z
	.object({
		email: z.string().email(),
		password: z.string().min(8).max(15).regex(/\d/),
		confirmPassword: z.string().min(8).max(15).regex(/\d/),
	})
	.passthrough()

// POST /auth/confirm-registration request body
const postAuthconfirmRegistration_Body = z
	.object({
		email: z.string().email(),
		code: z.number(),
	})
	.passthrough()

// POST /auth/resend-confirmation-code request body
const postAuthresendConfirmationCode_Body = z
	.object({
		email: z.string().email(),
	})
	.passthrough()

// POST /auth/login request body
const postAuthlogin_Body = z
	.object({
		email: z.string().email(),
		password: z.string().min(8).max(15).regex(/\d/),
	})
	.passthrough()

// POST /auth/forgot-password request body
const postAuthforgotPassword_Body = z
	.object({
		email: z.string().email(),
	})
	.passthrough()

// POST /auth/confirm-forgot-password request body
const postAuthconfirmForgotPassword_Body = z
	.object({
		email: z.string().email(),
		code: z.string().min(6).max(6),
		newPassword: z.string().min(8).max(15).regex(/\d/),
		confirmPassword: z.string().min(8).max(15).regex(/\d/),
	})
	.passthrough()

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

// POST /auth/register response
const postAuthregister_Response = messageResponseSchema

// POST /auth/confirm-registration response
const postAuthconfirmRegistration_Response = messageResponseSchema

// POST /auth/resend-confirmation-code response
const postAuthresendConfirmationCode_Response = messageResponseSchema

// POST /auth/login response
const postAuthlogin_Response = z
	.object({
		message: z.string(),
		tokens: authTokensSchema,
	})
	.passthrough()

// POST /auth/logout response
const postAuthlogout_Response = messageResponseSchema

// POST /auth/refresh response
const postAuthrefresh_Response = z
	.object({
		message: z.string(),
		tokens: authTokensSchema,
	})
	.passthrough()

// POST /auth/forgot-password response
const postAuthforgotPassword_Response = messageResponseSchema

// POST /auth/confirm-forgot-password response
const postAuthconfirmForgotPassword_Response = messageResponseSchema

// GET /auth/user response
const getAuthuser_Response = authUserSchema

// ============================================================================
// EXPORTS
// ============================================================================

export const authSchemas = {
	// Request schemas
	postAuthregister_Body,
	postAuthconfirmRegistration_Body,
	postAuthresendConfirmationCode_Body,
	postAuthlogin_Body,
	postAuthforgotPassword_Body,
	postAuthconfirmForgotPassword_Body,
	// Response schemas
	postAuthregister_Response,
	postAuthconfirmRegistration_Response,
	postAuthresendConfirmationCode_Response,
	postAuthlogin_Response,
	postAuthlogout_Response,
	postAuthrefresh_Response,
	postAuthforgotPassword_Response,
	postAuthconfirmForgotPassword_Response,
	getAuthuser_Response,
	// Shared schemas
	authTokensSchema,
	authUserSchema,
	messageResponseSchema,
}

// Individual exports for direct access
export {
	// Shared schemas
	authTokensSchema,
	authUserSchema,
	getAuthuser_Response,
	messageResponseSchema,
	postAuthconfirmForgotPassword_Body,
	postAuthconfirmForgotPassword_Response,
	postAuthconfirmRegistration_Body,
	postAuthconfirmRegistration_Response,
	postAuthforgotPassword_Body,
	postAuthforgotPassword_Response,
	postAuthlogin_Body,
	postAuthlogin_Response,
	postAuthlogout_Response,
	postAuthrefresh_Response,
	// Request schemas
	postAuthregister_Body,
	// Response schemas
	postAuthregister_Response,
	postAuthresendConfirmationCode_Body,
	postAuthresendConfirmationCode_Response,
}
