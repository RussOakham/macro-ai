// Generated from types/validation.types.ts

export interface ValidationError {
	field: string
	message: string
}

export interface ValidationErrorResponse {
	message: string
	errors: ValidationError[]
}
