import express from 'express'
import { z } from 'zod'

import { Result } from '../../utils/errors.ts'

import { healthErrorSchema, healthResponseSchema } from './utility.schemas.ts'

// Controller interface
interface IUtilityController {
	getHealthStatus: express.Handler
	getSystemInfo: express.Handler
}

// Service interface
interface IUtilityService {
	getHealthStatus: () => Result<THealthStatus>
	getSystemInfo: () => Result<TSystemInfo>
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

// API response types (from schemas)
type THealthResponse = z.infer<typeof healthResponseSchema>
type THealthErrorResponse = z.infer<typeof healthErrorSchema>

export type {
	IUtilityController,
	IUtilityService,
	THealthErrorResponse,
	THealthResponse,
	THealthStatus,
	TSystemInfo,
}
