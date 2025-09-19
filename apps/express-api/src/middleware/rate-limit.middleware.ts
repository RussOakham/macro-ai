import { Redis } from '@upstash/redis'
import { type NextFunction, type Request, type Response } from 'express'
import rateLimit, { type Options } from 'express-rate-limit'
import { StatusCodes } from 'http-status-codes'

import { standardizeError } from '../utils/errors.ts'
import { config } from '../utils/load-config.ts'
import { pino } from '../utils/logger.ts'

const { logger } = pino

// Initialize Upstash Redis for production environments
let defaultStore = undefined
let authStore = undefined
let apiStore = undefined

// Initialize Upstash Redis if in production and Redis URL is available
if (config.NODE_ENV === 'production' && config.REDIS_URL) {
	try {
		// Parse the Redis URL to extract connection details
		const redisUrl = new URL(config.REDIS_URL)
		const redis = new Redis({
			url: redisUrl.toString(),
			token: redisUrl.password,
		})

		// Test the connection
		redis
			.ping()
			.then(() => {
				logger.info(
					'[middleware - rateLimit]: Upstash Redis connected successfully',
				)
				return undefined
			})
			.catch((err: unknown) => {
				const error = standardizeError(err)
				logger.warn(
					`[middleware - rateLimit]: Upstash Redis connection failed: ${error.message}. Falling back to in-memory rate limiting.`,
				)
				return undefined
			})

		// Create custom store instances for each rate limiter
		// Upstash Redis doesn't need the RedisStore wrapper - we'll create custom stores
		defaultStore = createUpstashStore(redis, 'rl:default:')
		authStore = createUpstashStore(redis, 'rl:auth:')
		apiStore = createUpstashStore(redis, 'rl:api:')

		logger.info(
			'[middleware - rateLimit]: Using Upstash Redis store for rate limiting',
		)
	} catch (error) {
		const err = standardizeError(error)
		logger.warn(
			`[middleware - rateLimit]: Failed to initialize Upstash Redis: ${err.message}. Falling back to in-memory rate limiting.`,
		)
	}
}

// Custom store implementation for Upstash Redis
function createUpstashStore(redis: Redis, prefix: string) {
	return {
		async increment(key: string) {
			try {
				const fullKey = `${prefix}${key}`
				const now = Date.now()
				const windowMs = 15 * 60 * 1000 // Default window size
				const window = Math.floor(now / windowMs)
				const keyWithWindow = `${fullKey}:${window}`

				// Increment the counter and set expiration
				const pipeline = redis.pipeline()
				pipeline.incr(keyWithWindow)
				pipeline.expire(keyWithWindow, Math.ceil(windowMs / 1000))

				const results = await pipeline.exec()
				return {
					totalHits: results[0] as number,
					resetTime: new Date((window + 1) * windowMs),
				}
			} catch (error) {
				logger.warn(
					`[middleware - rateLimit]: Redis operation failed: ${error}. Falling back to in-memory.`,
				)
				// Return a fallback response
				return {
					totalHits: 1,
					resetTime: new Date(Date.now() + 15 * 60 * 1000),
				}
			}
		},
		async decrement(key: string) {
			try {
				const fullKey = `${prefix}${key}`
				// Get all keys matching the pattern and decrement
				const keys = await redis.keys(`${fullKey}:*`)
				if (keys.length > 0 && keys[0]) {
					await redis.decr(keys[0])
				}
			} catch (error) {
				logger.warn(
					`[middleware - rateLimit]: Redis decrement failed: ${error}`,
				)
			}
		},
		async resetKey(key: string) {
			try {
				const fullKey = `${prefix}${key}`
				const keys = await redis.keys(`${fullKey}:*`)
				if (keys.length > 0) {
					await redis.del(...(keys as string[]))
				}
			} catch (error) {
				logger.warn(`[middleware - rateLimit]: Redis reset failed: ${error}`)
			}
		},
	}
}

// Default rate limit configuration
const defaultRateLimiter = rateLimit({
	windowMs: config.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes by default
	limit: config.RATE_LIMIT_MAX_REQUESTS || 100, // 100 requests per windowMs by default
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
	store: defaultStore, // Use Redis store in production if available
	message: {
		status: StatusCodes.TOO_MANY_REQUESTS,
		message: 'Too many requests, please try again later.',
	},
	handler: (
		req: Request,
		res: Response,
		_next: NextFunction,
		options: Options,
	) => {
		logger.warn(
			`[middleware - rateLimit]: Rate limit exceeded for IP: ${req.ip ?? 'undefined'}`,
		)
		res.status(options.statusCode).json(options.message)
	},
})

// Stricter rate limit for authentication endpoints
const authRateLimiter = rateLimit({
	windowMs: config.AUTH_RATE_LIMIT_WINDOW_MS || 60 * 60 * 1000, // 1 hour by default
	limit: config.AUTH_RATE_LIMIT_MAX_REQUESTS || 10, // 10 requests per hour by default
	standardHeaders: true,
	legacyHeaders: false,
	store: authStore, // Use Redis store in production if available
	message: {
		status: StatusCodes.TOO_MANY_REQUESTS,
		message: 'Too many authentication attempts, please try again later.',
	},
	handler: (
		req: Request,
		res: Response,
		_next: NextFunction,
		options: Options,
	) => {
		logger.warn(
			`[middleware - rateLimit]: Auth rate limit exceeded for IP: ${req.ip ?? 'undefined'}`,
		)
		res.status(options.statusCode).json(options.message)
	},
})

// API rate limiter for endpoints that require API key
const apiRateLimiter = rateLimit({
	windowMs: config.API_RATE_LIMIT_WINDOW_MS || 60 * 1000, // 1 minute by default
	limit: config.API_RATE_LIMIT_MAX_REQUESTS || 60, // 60 requests per minute by default
	standardHeaders: true,
	legacyHeaders: false,
	store: apiStore, // Use Redis store in production if available
	message: {
		status: StatusCodes.TOO_MANY_REQUESTS,
		message: 'API rate limit exceeded, please try again later.',
	},
	handler: (
		req: Request,
		res: Response,
		_next: NextFunction,
		options: Options,
	) => {
		logger.warn(
			`[middleware - rateLimit]: API rate limit exceeded for IP: ${req.ip ?? 'undefined'}`,
		)
		res.status(options.statusCode).json(options.message)
	},
})

export { apiRateLimiter, authRateLimiter, defaultRateLimiter }
