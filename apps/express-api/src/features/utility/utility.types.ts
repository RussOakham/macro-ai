import type express from 'express'
import type { z } from 'zod'

import type { Result } from '../../utils/errors.ts'
import type {
	healthErrorSchema,
	healthResponseSchema,
} from './utility.schemas.ts'

// Controller interface
interface IUtilityController {
	getHealthStatus: express.Handler
	getSystemInfo: express.Handler
	getDetailedHealthStatus: express.Handler
	getReadinessStatus: express.Handler
	getPublicReadinessStatus: express.Handler
	getLivenessStatus: express.Handler
	getConfigurationStatus: express.Handler
}

// Service interface
interface IUtilityService {
	getHealthStatus: () => Result<THealthStatus>
	getSystemInfo: () => Result<TSystemInfo>
	getDetailedHealthStatus: () => Result<TDetailedHealthStatus>
	getReadinessStatus: () => Result<TReadinessStatus>
	getPublicReadinessStatus: () => Result<TReadinessStatus>
	getLivenessStatus: () => Result<TLivenessStatus>
	getConfigurationStatus: () => Result<TConfigurationStatus>
}

// Health status type (internal service type)
interface THealthStatus {
	message: string
	timestamp: string
	uptime: number
	memoryUsageMB: number
}

interface TSystemInfo {
	nodeVersion: string
	platform: string
	architecture: string
	uptime: number
	memoryUsage: {
		rss: number
		heapTotal: number
		heapUsed: number
		external: number
	}
	cpuUsage: {
		user: number
		system: number
	}
	timestamp: string
}

// Enhanced health status for ALB and monitoring
interface TDetailedHealthStatus {
	status: 'healthy' | 'unhealthy' | 'degraded'
	message: string
	timestamp: string
	uptime: number
	version: string
	environment: string
	checks: {
		database: {
			status: 'healthy' | 'unhealthy' | 'unknown'
			responseTime?: number
			error?: string
		}
		memory: {
			status: 'healthy' | 'unhealthy'
			usagePercent: number
			usageMB: number
		}
		disk: {
			status: 'healthy' | 'unhealthy'
			usagePercent?: number
		}
		dependencies: {
			status: 'healthy' | 'unhealthy' | 'degraded'
			services: {
				name: string
				status: 'healthy' | 'unhealthy'
				responseTime?: number
				error?: string
			}[]
		}
	}
}

// Readiness probe for Kubernetes-style health checks
interface TReadinessStatus {
	ready: boolean
	message: string
	timestamp: string
	checks: {
		database: boolean
		dependencies: boolean
		configuration: boolean
	}
}

// Liveness probe for Kubernetes-style health checks
interface TLivenessStatus {
	alive: boolean
	message: string
	timestamp: string
	uptime: number
}

// Configuration validation status for debugging deployment issues
interface TConfigurationStatus {
	status: 'healthy' | 'unhealthy' | 'degraded'
	message: string
	timestamp: string
	checks: {
		critical: {
			ready: boolean
			missing: string[]
		}
		important: {
			ready: boolean
			missing: string[]
		}
		optional: {
			ready: boolean
			missing: string[]
		}
	}
}

// API response types (from schemas)
type THealthResponse = z.infer<typeof healthResponseSchema>
type THealthErrorResponse = z.infer<typeof healthErrorSchema>

export type {
	IUtilityController,
	IUtilityService,
	TConfigurationStatus,
	TDetailedHealthStatus,
	THealthErrorResponse,
	THealthResponse,
	THealthStatus,
	TLivenessStatus,
	TReadinessStatus,
	TSystemInfo,
}
