#!/usr/bin/env tsx

/**
 * Redis Configuration Verification Script
 *
 * This script verifies that Redis (Upstash) configuration is working correctly
 * for different environments.
 */

import { config } from '../apps/express-api/src/utils/load-config.ts'
import {
	getRedisConfig,
	getRedisUrl,
	isRedisEnabled,
	validateRedisConnection,
	logRedisConfig,
	getUpstashUsageInfo,
} from '../apps/express-api/src/utils/redis-config.ts'

async function verifyRedisConfiguration() {
	console.log('🔴 Redis Configuration Verification')
	console.log('=====================================\n')

	// Environment info
	console.log('📋 Environment Information:')
	console.log(`   APP_ENV: ${config.APP_ENV}`)
	console.log(`   NODE_ENV: ${config.NODE_ENV}`)
	console.log(`   REDIS_URL configured: ${!!config.REDIS_URL}`)
	console.log()

	// Redis configuration
	const redisConfig = getRedisConfig()
	console.log('⚙️ Redis Configuration:')
	console.log(`   Enabled: ${isRedisEnabled()}`)
	console.log(`   Description: ${redisConfig.description}`)
	console.log(`   Free Tier: ${redisConfig.freeTier}`)
	console.log(`   Limits:`, redisConfig.limits)
	console.log()

	// Upstash usage info
	const usageInfo = getUpstashUsageInfo()
	console.log('📊 Upstash Usage Information:')
	console.log(`   Tier: ${usageInfo.tier}`)
	if (usageInfo.tier === 'Free') {
		console.log(`   Connections: ${usageInfo.connections}`)
		console.log(`   Daily Requests: ${usageInfo.dailyRequests}`)
		console.log(`   Storage: ${usageInfo.storage}`)
	}
	console.log(`   Note: ${usageInfo.note}`)
	console.log()

	// URL validation
	const redisUrl = getRedisUrl()
	console.log('🔗 Redis URL Validation:')
	if (redisUrl) {
		console.log('   ✅ Redis URL available')
		console.log(`   URL (masked): ${redisUrl.replace(/:[^:]+@/, ':***@')}`)

		// Validate connection
		const isValid = await validateRedisConnection()
		console.log(
			`   Connection validation: ${isValid ? '✅ PASSED' : '❌ FAILED'}`,
		)
	} else {
		console.log(
			'   ⚠️ Redis URL not available (expected for non-production environments)',
		)
	}
	console.log()

	// Detailed logging
	console.log('📝 Detailed Configuration:')
	logRedisConfig()
	console.log()

	// Recommendations
	console.log('💡 Recommendations:')
	if (redisConfig.freeTier && isRedisEnabled()) {
		console.log('   • Monitor Upstash usage to avoid hitting free tier limits')
		console.log('   • Consider upgrading to paid tier when approaching limits')
		console.log(
			'   • Current limits: 30 connections, 10k daily requests, 30MB storage',
		)
	}

	if (
		!isRedisEnabled() &&
		config.APP_ENV !== 'development' &&
		!config.APP_ENV.startsWith('pr-')
	) {
		console.log('   ⚠️ Redis is disabled for this environment')
		console.log('   • Rate limiting will use in-memory store (not persistent)')
		console.log(
			'   • Consider enabling Redis for better rate limiting in production',
		)
	}

	console.log('\n✅ Redis configuration verification completed')
}

if (require.main === module) {
	verifyRedisConfiguration().catch(console.error)
}

export { verifyRedisConfiguration }
