// Auth API Types - auto-generated, do not edit manually
// Types are now inferred from Zod schemas for runtime validation and type safety

import type { z } from 'zod'

import type {
	getAuthuser_Response,
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
	postAuthregister_Body,
	postAuthregister_Response,
	postAuthresendConfirmationCode_Body,
	postAuthresendConfirmationCode_Response,
} from '../schemas/auth.schemas.js'

// ============================================================================
// REQUEST TYPES (inferred from Zod schemas)
// ============================================================================

export type AuthPostRegisterRequest = z.infer<typeof postAuthregister_Body>

export type AuthPostConfirmRegistrationRequest = z.infer<
	typeof postAuthconfirmRegistration_Body
>

export type AuthPostResendConfirmationCodeRequest = z.infer<
	typeof postAuthresendConfirmationCode_Body
>

export type AuthPostLoginRequest = z.infer<typeof postAuthlogin_Body>

export type AuthPostForgotPasswordRequest = z.infer<
	typeof postAuthforgotPassword_Body
>

export type AuthPostConfirmForgotPasswordRequest = z.infer<
	typeof postAuthconfirmForgotPassword_Body
>

// ============================================================================
// RESPONSE TYPES (inferred from Zod schemas)
// ============================================================================

export type AuthPostRegisterResponse = z.infer<typeof postAuthregister_Response>

export type AuthPostConfirmRegistrationResponse = z.infer<
	typeof postAuthconfirmRegistration_Response
>

export type AuthPostResendConfirmationCodeResponse = z.infer<
	typeof postAuthresendConfirmationCode_Response
>

export type AuthPostLoginResponse = z.infer<typeof postAuthlogin_Response>

export type AuthPostLogoutResponse = z.infer<typeof postAuthlogout_Response>

export type AuthPostRefreshResponse = z.infer<typeof postAuthrefresh_Response>

export type AuthPostForgotPasswordResponse = z.infer<
	typeof postAuthforgotPassword_Response
>

export type AuthPostConfirmForgotPasswordResponse = z.infer<
	typeof postAuthconfirmForgotPassword_Response
>

export type AuthGetUserResponse = z.infer<typeof getAuthuser_Response>
