import { NextFunction, Request, Response } from 'express'
import rateLimit, { Options } from 'express-rate-limit'
import { StatusCodes } from 'http-status-codes'
import { RedisStore } from 'rate-limit-redis'
import { createClient } from 'redis'

import { assertConfig } from '../../config/default.ts'
import { standardizeError } from '../utils/errors.ts'
import { pino } from '../utils/logger.ts'

const { logger } = pino

// Initialize Redis stores for production environments
// Each rate limiter needs its own store instance with unique prefix
let defaultStore = undefined
let authStore = undefined
let apiStore = undefined

const config = assertConfig()
if (config.nodeEnv === 'production' && config.redisUrl) {
	const redisClient = createClient({
		url: config.redisUrl,
		socket: {
			connectTimeout: 50000,
		},
	})

	redisClient.connect().catch((err: unknown) => {
		const error = standardizeError(err)
		logger.error(
			`[middleware - rateLimit]: Redis connection error: ${error.message}`,
		)
	})

	// Create separate store instances with unique prefixes
	defaultStore = new RedisStore({
		sendCommand: (...args: string[]) => redisClient.sendCommand(args),
		prefix: 'rl:default:',
	})

	authStore = new RedisStore({
		sendCommand: (...args: string[]) => redisClient.sendCommand(args),
		prefix: 'rl:auth:',
	})

	apiStore = new RedisStore({
		sendCommand: (...args: string[]) => redisClient.sendCommand(args),
		prefix: 'rl:api:',
	})

	logger.info('[middleware - rateLimit]: Using Redis store for rate limiting')
}

// Default rate limit configuration
const defaultRateLimiter = rateLimit({
	windowMs: config.rateLimitWindowMs || 15 * 60 * 1000, // 15 minutes by default
	limit: config.rateLimitMaxRequests || 100, // 100 requests per windowMs by default
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
	windowMs: config.authRateLimitWindowMs || 60 * 60 * 1000, // 1 hour by default
	limit: config.authRateLimitMaxRequests || 10, // 10 requests per hour by default
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
	windowMs: config.apiRateLimitWindowMs || 60 * 1000, // 1 minute by default
	limit: config.apiRateLimitMaxRequests || 60, // 60 requests per minute by default
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
