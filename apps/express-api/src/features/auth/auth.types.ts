import express from 'express'
import { z } from 'zod'

import {
	authResponseSchema,
	confirmForgotPasswordRequestSchema,
	confirmRegistrationRequestSchema,
	forgotPasswordRequestSchema,
	getAuthUserResponseSchema,
	loginRequestSchema,
	loginResponseSchema,
	registerUserRequestSchema,
	registerUserResponseSchema,
	resendConfirmationCodeRequestSchema,
} from './auth.schemas.ts'

// Define types using Zod schemas
type TAuthResponse = z.infer<typeof authResponseSchema>
type TConfirmForgotPasswordRequest = z.infer<
	typeof confirmForgotPasswordRequestSchema
>
type TConfirmRegistrationRequest = z.infer<
	typeof confirmRegistrationRequestSchema
>
type TForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>
type TGetAuthUserResponse = z.infer<typeof getAuthUserResponseSchema>
type TLoginRequest = z.infer<typeof loginRequestSchema>
type TLoginResponse = z.infer<typeof loginResponseSchema>
type TResendConfirmationCodeRequest = z.infer<
	typeof resendConfirmationCodeRequestSchema
>
type TRegisterUserRequest = z.infer<typeof registerUserRequestSchema>
type TRegisterUserResponse = z.infer<typeof registerUserResponseSchema>

// Cognito related interfaces
interface ICognitoError {
	$fault: 'client' | 'server'
	$metadata: {
		httpStatusCode: number
		requestId: string
		extendedRequestId?: string
		cfId?: string
		attempts: number
		totalRetryDelay: number
	}
	__type: string
	message?: string
}

// Controller interfaces
interface IAuthController {
	register: express.Handler
	login: express.Handler
	logout: express.Handler
	refreshToken: express.Handler
	confirmRegistration: express.Handler
	resendConfirmationCode: express.Handler
	forgotPassword: express.Handler
	confirmForgotPassword: express.Handler
	getAuthUser: express.Handler
}

export type {
	IAuthController,
	ICognitoError,
	TAuthResponse,
	TConfirmForgotPasswordRequest,
	TConfirmRegistrationRequest,
	TForgotPasswordRequest,
	TGetAuthUserResponse,
	TLoginRequest,
	TLoginResponse,
	TRegisterUserRequest,
	TRegisterUserResponse,
	TResendConfirmationCodeRequest,
}
