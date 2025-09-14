import type express from 'express'
import type { z } from 'zod'

import type { Result } from '../../utils/errors.ts'
import type {
	healthErrorSchema,
	healthResponseSchema,
} from './utility.schemas.ts'

// Common status types
type TStatus = 'degraded' | 'healthy' | 'unhealthy' | 'unknown'

// Controller interface
interface IUtilityController {
	getConfigurationStatus: express.Handler
	getDetailedHealthStatus: express.Handler
	getHealthStatus: express.Handler
	getLivenessStatus: express.Handler
	getPublicReadinessStatus: express.Handler
	getReadinessStatus: express.Handler
	getSystemInfo: express.Handler
}

// Service interface
interface IUtilityService {
	getConfigurationStatus: () => Result<TConfigurationStatus>
	getDetailedHealthStatus: () => Result<TDetailedHealthStatus>
	getHealthStatus: () => Result<THealthStatus>
	getLivenessStatus: () => Result<TLivenessStatus>
	getPublicReadinessStatus: () => Result<TReadinessStatus>
	getReadinessStatus: () => Result<TReadinessStatus>
	getSystemInfo: () => Result<TSystemInfo>
}

// Health status type (internal service type)
interface THealthStatus {
	memoryUsageMB: number
	message: string
	timestamp: string
	uptime: number
}

interface TSystemInfo {
	architecture: string
	cpuUsage: {
		system: number
		user: number
	}
	memoryUsage: {
		external: number
		heapTotal: number
		heapUsed: number
		rss: number
	}
	nodeVersion: string
	platform: string
	timestamp: string
	uptime: number
}

// Enhanced health status for ALB and monitoring
interface TDetailedHealthStatus {
	checks: {
		database: {
			error?: string
			responseTime?: number
			status: 'healthy' | 'unhealthy' | 'unknown'
		}
		dependencies: {
			services: {
				error?: string
				name: string
				responseTime?: number
				status: 'healthy' | 'unhealthy'
			}[]
			status: TStatus
		}
		disk: {
			status: 'healthy' | 'unhealthy'
			usagePercent?: number
		}
		memory: {
			status: 'healthy' | 'unhealthy'
			usageMB: number
			usagePercent: number
		}
	}
	environment: string
	message: string
	status: TStatus
	timestamp: string
	uptime: number
	version: string
}

// Readiness probe for Kubernetes-style health checks
interface TReadinessStatus {
	checks: {
		configuration: boolean
		database: boolean
		dependencies: boolean
	}
	message: string
	ready: boolean
	timestamp: string
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
	checks: {
		critical: {
			missing: string[]
			ready: boolean
		}
		important: {
			missing: string[]
			ready: boolean
		}
		optional: {
			missing: string[]
			ready: boolean
		}
	}
	message: string
	status: TStatus
	timestamp: string
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
	TStatus,
	TSystemInfo,
}
