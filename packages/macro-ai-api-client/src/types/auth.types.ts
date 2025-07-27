// Auth API Types - auto-generated, do not edit manually

export interface AuthPostRegisterRequest {
	email: string
	password: string
	confirmPassword: string
}

export interface AuthPostRegisterResponse {
	message: string
}

export interface AuthPostConfirmRegistrationRequest {
	email: string
	code: number
}

export interface AuthPostConfirmRegistrationResponse {
	message: string
}

export interface AuthPostResendConfirmationCodeRequest {
	email: string
}

export interface AuthPostResendConfirmationCodeResponse {
	message: string
}

export interface AuthPostLoginRequest {
	email: string
	password: string
}

export interface AuthPostLoginResponse {
	message: string
	tokens: {
		accessToken: string
		refreshToken: string
		expiresIn: number
	}
}

export interface AuthPostForgotPasswordRequest {
	email: string
}

export interface AuthPostForgotPasswordResponse {
	message: string
}

export interface AuthPostConfirmForgotPasswordRequest {
	email: string
	code: string
	newPassword: string
	confirmPassword: string
}

export interface AuthPostConfirmForgotPasswordResponse {
	message: string
}

export interface AuthPostLogoutResponse {
	message: string
}

export interface AuthPostRefreshResponse {
	message: string
	tokens: {
		accessToken: string
		refreshToken: string
		expiresIn: number
	}
}

export interface AuthGetUserResponse {
	id: string
	email: string
	emailVerified: boolean
}
