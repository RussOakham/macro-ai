export interface IApiErrorDetails {
	[key: string]: unknown
	message: string
}

export interface IStandardizedError extends Error {
	details?: unknown
	message: string
	name: string
	stack: string
	status: number
	type: TErrorType
}

export type TErrorType =
	| 'ApiError'
	| 'AxiosError'
	| 'Error'
	| 'UnknownError'
	| 'ZodError'
	| 'ZodValidationError'
