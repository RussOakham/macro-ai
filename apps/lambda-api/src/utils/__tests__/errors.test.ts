/**
 * Tests for errors.ts
 */

import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
	AppError,
	err,
	ErrorType,
	isErr,
	isOk,
	ok,
	tryCatch,
	tryCatchSync,
} from '../errors.js'

describe('AppError', () => {
	it('should create an AppError with default values', () => {
		const error = new AppError({ message: 'Test error' })

		expect(error.message).toBe('Test error')
		expect(error.status).toBe(500)
		expect(error.type).toBe(ErrorType.ApiError)
		expect(error.service).toBe('unknown')
		expect(error.name).toBe('AppError')
		expect(error.stack).toBeDefined()
	})

	it('should create an AppError with custom values', () => {
		const error = new AppError({
			message: 'Custom error',
			status: 400,
			type: ErrorType.ValidationError,
			service: 'test-service',
			details: { field: 'test' },
		})

		expect(error.message).toBe('Custom error')
		expect(error.status).toBe(400)
		expect(error.type).toBe(ErrorType.ValidationError)
		expect(error.service).toBe('test-service')
		expect(error.details).toEqual({ field: 'test' })
	})

	it('should create AppError from another AppError', () => {
		const originalError = new AppError({
			message: 'Original error',
			type: ErrorType.ConfigurationError,
		})

		const newError = AppError.from(originalError, 'test-service')

		expect(newError).toBe(originalError) // Should return the same instance
	})

	it('should create AppError from Zod error', () => {
		const schema = z.object({ name: z.string() })
		let zodError: z.ZodError | undefined

		try {
			schema.parse({ name: 123 })
		} catch (error) {
			zodError = error as z.ZodError
		}

		// Ensure zodError is defined before proceeding
		expect(zodError).toBeDefined()
		if (!zodError) return

		const appError = AppError.from(zodError, 'test-service')

		expect(appError.type).toBe(ErrorType.ValidationError)
		expect(appError.status).toBe(400)
		expect(appError.service).toBe('test-service')
		expect(appError.message).toContain('Validation error')
	})

	it('should create AppError from standard Error', () => {
		const standardError = new Error('Standard error message')
		const appError = AppError.from(standardError, 'test-service')

		expect(appError.type).toBe(ErrorType.InternalError)
		expect(appError.status).toBe(500)
		expect(appError.service).toBe('test-service')
		expect(appError.message).toBe('Standard error message')
		expect(appError.details).toEqual({ originalError: 'Error' })
	})

	it('should create AppError from unknown error', () => {
		const unknownError = 'string error'
		const appError = AppError.from(unknownError, 'test-service')

		expect(appError.type).toBe(ErrorType.InternalError)
		expect(appError.status).toBe(500)
		expect(appError.service).toBe('test-service')
		expect(appError.message).toBe('An unknown error occurred')
		expect(appError.details).toEqual({ originalError: 'string error' })
	})

	it('should create validation error', () => {
		const error = AppError.validation(
			'Validation failed',
			{ field: 'name' },
			'test-service',
		)

		expect(error.type).toBe(ErrorType.ValidationError)
		expect(error.status).toBe(400)
		expect(error.message).toBe('Validation failed')
		expect(error.details).toEqual({ field: 'name' })
		expect(error.service).toBe('test-service')
	})

	it('should create configuration error', () => {
		const error = AppError.configuration(
			'Config failed',
			{ config: 'test' },
			'test-service',
		)

		expect(error.type).toBe(ErrorType.ConfigurationError)
		expect(error.status).toBe(500)
		expect(error.message).toBe('Config failed')
		expect(error.details).toEqual({ config: 'test' })
		expect(error.service).toBe('test-service')
	})

	it('should create parameter store error', () => {
		const error = AppError.parameterStore(
			'Parameter failed',
			{ param: 'test' },
			'test-service',
		)

		expect(error.type).toBe(ErrorType.ParameterStoreError)
		expect(error.status).toBe(500)
		expect(error.message).toBe('Parameter failed')
		expect(error.details).toEqual({ param: 'test' })
		expect(error.service).toBe('test-service')
	})

	it('should create internal error', () => {
		const error = AppError.internal('Internal failed', 'test-service')

		expect(error.type).toBe(ErrorType.InternalError)
		expect(error.status).toBe(500)
		expect(error.message).toBe('Internal failed')
		expect(error.service).toBe('test-service')
	})

	it('should convert to standardized error object', () => {
		const error = new AppError({
			message: 'Test error',
			status: 400,
			type: ErrorType.ValidationError,
			service: 'test-service',
			details: { field: 'test' },
		})

		const standardized = error.toStandardized()

		expect(standardized).toEqual({
			type: ErrorType.ValidationError,
			name: 'AppError',
			status: 400,
			message: 'Test error',
			stack: error.stack,
			details: { field: 'test' },
			service: 'test-service',
		})
	})
})

describe('Result helpers', () => {
	it('should create ok result', () => {
		const result = ok('success')

		expect(result).toEqual(['success', null])
		expect(isOk(result)).toBe(true)
		expect(isErr(result)).toBe(false)
	})

	it('should create error result', () => {
		const error = new AppError({ message: 'Test error' })
		const result = err(error)

		expect(result).toEqual([null, error])
		expect(isOk(result)).toBe(false)
		expect(isErr(result)).toBe(true)
	})
})

describe('tryCatch', () => {
	it('should return ok result for successful promise', async () => {
		const promise = Promise.resolve('success')
		const result = await tryCatch(promise, 'test-context')

		expect(isOk(result)).toBe(true)
		expect(result[0]).toBe('success')
		expect(result[1]).toBeNull()
	})

	it('should return error result for rejected promise', async () => {
		const promise = Promise.reject(new Error('Test error'))
		const result = await tryCatch(promise, 'test-context')

		expect(isErr(result)).toBe(true)
		expect(result[0]).toBeNull()
		expect(result[1]).toBeInstanceOf(AppError)
		expect(result[1]?.message).toBe('Test error')
		expect(result[1]?.service).toBe('test-context')
	})
})

describe('tryCatchSync', () => {
	it('should return ok result for successful function', () => {
		const func = () => 'success'
		const result = tryCatchSync(func, 'test-context')

		expect(isOk(result)).toBe(true)
		expect(result[0]).toBe('success')
		expect(result[1]).toBeNull()
	})

	it('should return error result for throwing function', () => {
		const func = () => {
			throw new Error('Test error')
		}
		const result = tryCatchSync(func, 'test-context')

		expect(isErr(result)).toBe(true)
		expect(result[0]).toBeNull()
		expect(result[1]).toBeInstanceOf(AppError)
		expect(result[1]?.message).toBe('Test error')
		expect(result[1]?.service).toBe('test-context')
	})
})
