import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'

import { pino } from '../../utils/logger.ts'

import { utilityService } from './utility.services.ts'
import { IUtilityController, THealthResponse } from './utility.types.ts'

const { logger } = pino

/**
 * UtilityController class that implements the IUtilityController interface
 * Handles all utility-related requests like health checks
 */
class UtilityController implements IUtilityController {
	private readonly utilityService: typeof utilityService

	constructor(utilitySvc: typeof utilityService = utilityService) {
		this.utilityService = utilitySvc
	}

	/**
	 * Health check endpoint
	 * Returns the current health status of the API
	 */
	public getHealthStatus = (
		req: Request,
		res: Response,
		next: NextFunction,
	): void => {
		// Log health check request details
		logger.info(
			{
				operation: 'healthCheck',
				path: req.path,
				method: req.method,
				timestamp: new Date().toISOString(),
			},
			'Health check request received',
		)

		const [healthStatus, error] = this.utilityService.getHealthStatus()

		if (error) {
			logger.error({
				msg: '[utilityController - getHealthStatus]: Error checking health status',
				error: error.message,
			})
			next(error)
			return
		}

		const healthResponse: THealthResponse = {
			message: healthStatus.message,
		}

		res.status(StatusCodes.OK).json(healthResponse)
	}

	/**
	 * System information endpoint
	 * Returns detailed system information for monitoring
	 */
	public getSystemInfo = (
		req: Request,
		res: Response,
		next: NextFunction,
	): void => {
		const [systemInfo, error] = this.utilityService.getSystemInfo()

		if (error) {
			logger.error({
				msg: '[utilityController - getSystemInfo]: Error retrieving system info',
				error: error.message,
			})
			next(error)
			return
		}

		res.status(StatusCodes.OK).json(systemInfo)
	}

	/**
	 * Detailed health check endpoint for ALB and monitoring
	 * Returns comprehensive health status including dependencies
	 */
	public getDetailedHealthStatus = (
		req: Request,
		res: Response,
		next: NextFunction,
	): void => {
		// Log detailed health check request details
		logger.info(
			{
				operation: 'healthCheckDetailed',
				path: req.path,
				method: req.method,
				headers: {
					'user-agent': req.get('User-Agent'),
					'x-forwarded-for': req.get('X-Forwarded-For'),
					'x-real-ip': req.get('X-Real-IP'),
					origin: req.get('Origin'),
					referer: req.get('Referer'),
				},
				ip: req.ip,
				query: req.query,
				timestamp: new Date().toISOString(),
			},
			'Detailed health check request received',
		)

		const [detailedHealthStatus, error] =
			this.utilityService.getDetailedHealthStatus()

		if (error) {
			logger.error({
				msg: '[utilityController - getDetailedHealthStatus]: Error checking detailed health status',
				error: error.message,
				stack: error.stack,
				service: error.service,
				type: error.type,
			})
			next(error)
			return
		}

		// TypeScript knows detailedHealthStatus is defined here due to Result tuple pattern
		// This assertion is for runtime safety in case of unexpected null values

		// Set appropriate HTTP status based on health status
		const statusCode =
			detailedHealthStatus.status === 'healthy'
				? StatusCodes.OK
				: detailedHealthStatus.status === 'degraded'
					? StatusCodes.OK // Still return 200 for degraded but log warning
					: StatusCodes.SERVICE_UNAVAILABLE

		if (detailedHealthStatus.status === 'degraded') {
			logger.warn({
				msg: '[utilityController - getDetailedHealthStatus]: Service is in degraded state',
				status: detailedHealthStatus.status,
				checks: detailedHealthStatus.checks,
			})
		}

		res.status(statusCode).json(detailedHealthStatus)
	}

	/**
	 * Readiness probe endpoint
	 * Returns whether the application is ready to receive traffic
	 */
	public getReadinessStatus = (
		req: Request,
		res: Response,
		next: NextFunction,
	): void => {
		// Log readiness probe request details
		logger.info(
			{
				operation: 'healthCheckReady',
				path: req.path,
				method: req.method,
				headers: {
					'user-agent': req.get('User-Agent'),
					'x-forwarded-for': req.get('X-Forwarded-For'),
					'x-real-ip': req.get('X-Real-IP'),
					origin: req.get('Origin'),
					referer: req.get('Referer'),
				},
				ip: req.ip,
				query: req.query,
				timestamp: new Date().toISOString(),
			},
			'Readiness probe request received',
		)

		const [readinessStatus, error] = this.utilityService.getReadinessStatus()

		if (error) {
			logger.error({
				msg: '[utilityController - getReadinessStatus]: Error checking readiness status',
				error: error.message,
				stack: error.stack,
				service: error.service,
				type: error.type,
			})
			next(error)
			return
		}

		// TypeScript knows readinessStatus is defined here due to Result tuple pattern

		// Return 503 if not ready, 200 if ready
		const statusCode = readinessStatus.ready
			? StatusCodes.OK
			: StatusCodes.SERVICE_UNAVAILABLE

		res.status(statusCode).json(readinessStatus)
	}

	/**
	 * Public readiness probe endpoint
	 * Returns minimal readiness information without detailed error messages in production
	 */
	public getPublicReadinessStatus = (
		req: Request,
		res: Response,
		next: NextFunction,
	): void => {
		const [readinessStatus, error] =
			this.utilityService.getPublicReadinessStatus()

		if (error) {
			logger.error({
				msg: '[utilityController - getPublicReadinessStatus]: Error checking public readiness status',
				error: error.message,
				stack: error.stack,
				service: error.service,
				type: error.type,
			})
			next(error)
			return
		}

		// TypeScript knows readinessStatus is defined here due to Result tuple pattern

		// Return 503 if not ready, 200 if ready
		const statusCode = readinessStatus.ready
			? StatusCodes.OK
			: StatusCodes.SERVICE_UNAVAILABLE

		res.status(statusCode).json(readinessStatus)
	}

	/**
	 * Liveness probe endpoint
	 * Returns whether the application is alive and should not be restarted
	 */
	public getLivenessStatus = (
		req: Request,
		res: Response,
		next: NextFunction,
	): void => {
		// Log liveness probe request details
		logger.info(
			{
				operation: 'healthCheckLive',
				path: req.path,
				method: req.method,
				headers: {
					'user-agent': req.get('User-Agent'),
					'x-forwarded-for': req.get('X-Forwarded-For'),
					'x-real-ip': req.get('X-Real-IP'),
					origin: req.get('Origin'),
					referer: req.get('Referer'),
				},
				ip: req.ip,
				query: req.query,
				uptime: process.uptime(),
				timestamp: new Date().toISOString(),
			},
			'Liveness probe request received',
		)

		const [livenessStatus, error] = this.utilityService.getLivenessStatus()

		if (error) {
			logger.error({
				msg: '[utilityController - getLivenessStatus]: Error checking liveness status',
				error: error.message,
				stack: error.stack,
				service: error.service,
				type: error.type,
			})
			next(error)
			return
		}

		// TypeScript knows livenessStatus is defined here due to Result tuple pattern

		// Return 503 if not alive, 200 if alive
		const statusCode = livenessStatus.alive
			? StatusCodes.OK
			: StatusCodes.SERVICE_UNAVAILABLE

		res.status(statusCode).json(livenessStatus)
	}

	/**
	 * Configuration validation endpoint
	 * Returns detailed configuration validation status for debugging
	 */
	public getConfigurationStatus = (
		req: Request,
		res: Response,
		next: NextFunction,
	): void => {
		const [configStatus, error] = this.utilityService.getConfigurationStatus()

		if (error) {
			logger.error({
				msg: '[utilityController - getConfigurationStatus]: Error checking configuration status',
				error: error.message,
				stack: error.stack,
				service: error.service,
				type: error.type,
			})
			next(error)
			return
		}

		// Return 200 for configuration status (always returns data, even if unhealthy)
		res.status(StatusCodes.OK).json(configStatus)
	}
}

// Create an instance of the UtilityController
const utilityController = new UtilityController()

export { utilityController }
