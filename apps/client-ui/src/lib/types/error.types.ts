export type TErrorType =
  | 'ApiError'
  | 'AxiosError'
  | 'ZodValidationError'
  | 'ZodError'
  | 'Error'
  | 'UnknownError'

export interface IStandardizedError extends Error {
  type: TErrorType
  name: string
  status: number
  message: string
  stack: string
  details?: unknown
}

export interface IApiErrorDetails {
  message: string
  [key: string]: unknown
}