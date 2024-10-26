import { type Router } from 'express'

import { pino } from '../../utils/logger.ts'

const { logger } = pino

const utilityRouter = (router: Router) => {
	/**
	 * @swagger
	 * tags:
	 *   name: Utility
	 *   description: Utility endpoints
	 * /health:
	 *   get:
	 *     tags:
	 *       - Utility
	 *     summary: Check if the server is running
	 *     responses:
	 *       '200':
	 *         description: Server is running
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/HealthResponse'
	 *       '500':
	 *         description: Server is not running
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 * components:
	 *   schemas:
	 *     HealthResponse:
	 *       type: object
	 *       properties:
	 *         message:
	 *           type: string
	 *           description: The health status of the api
	 *       example:
	 *         message: "Api Health Status: OK"
	 *     ErrorResponse:
	 *       type: object
	 *       properties:
	 *         message:
	 *           type: string
	 *           description: The error message
	 *       example:
	 *         message: "Api Status: Error"
	 */
	router.get('/health', (req, res) => {
		try {
			res.status(200).json({ message: 'Api Health Status: OK' })
		} catch (error: unknown) {
			logger.error(
				`[utility-routes]: Error checking health status: ${(error as Error).message}`,
			)
			res.status(500).json({ message: 'Api Status: Error' })
		}
	})
}

export { utilityRouter }
