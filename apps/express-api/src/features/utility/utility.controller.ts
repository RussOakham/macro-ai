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
}

// Create an instance of the UtilityController
const utilityController = new UtilityController()

export { utilityController }
