import {
	ConfirmForgotPasswordCommandOutput,
	ConfirmSignUpCommandOutput,
	ForgotPasswordCommandOutput,
	GetUserCommandOutput,
	GlobalSignOutCommandOutput,
	InitiateAuthCommandOutput,
	ResendConfirmationCodeCommandOutput,
	SignUpCommandOutput,
} from '@aws-sdk/client-cognito-identity-provider'
import express from 'express'
import { z } from 'zod'

import { EnhancedResult } from '../../utils/error-handling/try-catch.ts'

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

// Service interfaces
interface ICognitoService {
	signUpUser: (
		request: TRegisterUserRequest,
	) => Promise<EnhancedResult<SignUpCommandOutput>>
	confirmSignUp: (
		email: string,
		code: number,
	) => Promise<EnhancedResult<ConfirmSignUpCommandOutput>>
	resendConfirmationCode: (
		email: string,
	) => Promise<EnhancedResult<ResendConfirmationCodeCommandOutput>>
	signInUser: (
		email: string,
		password: string,
	) => Promise<EnhancedResult<InitiateAuthCommandOutput & { Username: string }>>
	signOutUser: (
		accessToken: string,
	) => Promise<EnhancedResult<GlobalSignOutCommandOutput>>
	forgotPassword: (
		email: string,
	) => Promise<EnhancedResult<ForgotPasswordCommandOutput>>
	confirmForgotPassword: (
		email: string,
		code: string,
		newPassword: string,
		confirmPassword: string,
	) => Promise<EnhancedResult<ConfirmForgotPasswordCommandOutput>>
	getAuthUser: (
		accessToken: string,
	) => Promise<EnhancedResult<GetUserCommandOutput>>
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
	ICognitoService,
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
