/**
 * Redis Configuration for Upstash
 *
 * This utility manages Redis connectivity for different environments:
 * - Production/Staging: Upstash Redis (external service)
 * - Development/Local: Local Redis or disabled
 * - Testing: Mocked Redis
 */

import { config } from './load-config.ts'
import { pino } from './logger.ts'

const { logger } = pino

/**
 * Redis configuration for different environments
 */
export const REDIS_CONFIG = {
	production: {
		enabled: true,
		description: 'Upstash Redis (external service)',
		freeTier: true,
		limits: {
			connections: 30,
			dailyRequests: 10000,
			storage: '30MB',
		},
	},
	staging: {
		enabled: true,
		description: 'Upstash Redis (external service)',
		freeTier: true,
		limits: {
			connections: 30,
			dailyRequests: 10000,
			storage: '30MB',
		},
	},
	feature: {
		enabled: true,
		description: 'Upstash Redis (external service)',
		freeTier: true,
		limits: {
			connections: 30,
			dailyRequests: 10000,
			storage: '30MB',
		},
	},
	development: {
		enabled: false,
		description: 'Local Redis or disabled',
		freeTier: true,
		limits: {
			connections: 'unlimited',
			dailyRequests: 'unlimited',
			storage: 'unlimited',
		},
	},
	preview: {
		enabled: false,
		description: 'Disabled for preview environments',
		freeTier: true,
		limits: {
			connections: 0,
			dailyRequests: 0,
			storage: '0MB',
		},
	},
} as const

/**
 * Get Redis configuration for current environment
 */
export function getRedisConfig() {
	const appEnv = config.APP_ENV

	// Handle undefined/null appEnv (fallback to development)
	if (!appEnv) return REDIS_CONFIG.development

	if (appEnv === 'production') return REDIS_CONFIG.production
	if (appEnv === 'staging') return REDIS_CONFIG.staging
	if (appEnv === 'feature' || (typeof appEnv === 'string' && appEnv.startsWith('feature/')))
		return REDIS_CONFIG.feature
	if (typeof appEnv === 'string' && appEnv.startsWith('pr-')) return REDIS_CONFIG.preview

	return REDIS_CONFIG.development
}

/**
 * Check if Redis should be enabled for current environment
 */
export function isRedisEnabled(): boolean {
	const redisConfig = getRedisConfig()
	return redisConfig.enabled && !!config.REDIS_URL
}

/**
 * Get Redis connection URL with validation
 */
export function getRedisUrl(): string | undefined {
	if (!isRedisEnabled()) {
		return undefined
	}

	const url = config.REDIS_URL
	if (!url) {
		logger.warn('⚠️ Redis is enabled but REDIS_URL is not configured')
		return undefined
	}

	return url
}

/**
 * Validate Redis connectivity (basic check)
 */
export async function validateRedisConnection(): Promise<boolean> {
	const url = getRedisUrl()
	if (!url) {
		logger.info('ℹ️ Redis is disabled for this environment')
		return true // Not an error if Redis is intentionally disabled
	}

	try {
		// Basic URL validation
		const redisUrl = new URL(url)

		if (redisUrl.protocol !== 'redis:' && redisUrl.protocol !== 'rediss:') {
			logger.error(
				'❌ Invalid Redis URL protocol. Expected redis:// or rediss://',
			)
			return false
		}

		logger.info('✅ Redis URL validation passed')
		return true
	} catch (error) {
		logger.error(`❌ Invalid Redis URL format: ${error}`)
		return false
	}
}

/**
 * Log Redis configuration for debugging
 */
export function logRedisConfig() {
	const redisConfig = getRedisConfig()
	const url = getRedisUrl()

	logger.info(
		'🔴 Redis Configuration: environment=%s, enabled=%s, description=%s, freeTier=%s, urlConfigured=%s',
		config.APP_ENV,
		isRedisEnabled(),
		redisConfig.description,
		redisConfig.freeTier,
		!!url,
	)
}

/**
 * Get Upstash Redis usage information
 */
export function getUpstashUsageInfo() {
	const redisConfig = getRedisConfig()

	if (!redisConfig.freeTier) {
		return {
			tier: 'Paid',
			note: 'Upstash paid tier with higher limits',
		}
	}

	return {
		tier: 'Free',
		connections: redisConfig.limits.connections,
		dailyRequests: redisConfig.limits.dailyRequests,
		storage: redisConfig.limits.storage,
		note: 'Consider upgrading to paid tier when approaching limits',
	}
}
