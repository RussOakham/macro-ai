import { type Router } from 'express'

import { pino } from '../../utils/logger.ts'

const { logger } = pino

const utilityRouter = (router: Router) => {
	/**
	 * @swagger
	 * tags:
	 *   name: Utility
	 *   description: System utility endpoints
	 * /health:
	 *   get:
	 *     tags: [Utility]
	 *     summary: Check API health status
	 *     description: Returns the current health status of the API
	 *     responses:
	 *       200:
	 *         description: API is healthy
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   example: "Api Health Status: OK"
	 *       500:
	 *         description: API is unhealthy
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   example: "Api Status: Error"
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

