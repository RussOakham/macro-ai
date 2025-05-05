import express from 'express'
import { z } from 'zod'

import {
	confirmForgotPasswordSchema,
	confirmRegistrationSchema,
	forgotPasswordSchema,
	getAuthUserResponseSchema,
	getAuthUserSchema,
	loginResponseSchema,
	loginSchema,
	refreshTokenSchema,
	registerSchema,
	resendConfirmationCodeSchema,
} from './auth.schemas.ts'

// Zod inferred types
export type TRegister = z.infer<typeof registerSchema>
export type TConfirmRegistration = z.infer<typeof confirmRegistrationSchema>
export type TResendConfirmationCode = z.infer<
	typeof resendConfirmationCodeSchema
>
export type TLogin = z.infer<typeof loginSchema>
export type TLoginResponse = z.infer<typeof loginResponseSchema>
export type TRefreshToken = z.infer<typeof refreshTokenSchema>
export type TForgotPassword = z.infer<typeof forgotPasswordSchema>
export type TConfirmForgotPassword = z.infer<typeof confirmForgotPasswordSchema>
export type TGetAuthUser = z.infer<typeof getAuthUserSchema>
export type TGetAuthUserResponse = z.infer<
	typeof getAuthUserResponseSchema
>

// Cognito related interfaces
export interface ICognitoError {
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
export interface IAuthController {
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

// Response interfaces
export interface IAuthResponse {
	message: string
	user?: {
		id: string
		email: string
	}
	tokens?: {
		accessToken: string
		refreshToken: string
	}
}
