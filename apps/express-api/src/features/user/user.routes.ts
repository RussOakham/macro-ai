import { Router } from 'express'

import { verifyAuth } from '../../middleware/auth.middleware.ts'

import { userController } from './user.controller.ts'

const userRouter = (router: Router) => {
	/**
	 * @swagger
	 * /users/me:
	 *   get:
	 *     summary: Get current user profile
	 *     description: Returns the profile of the currently authenticated user
	 *     tags: [Users]
	 *     security:
	 *       - cookieAuth: []
	 *     responses:
	 *       200:
	 *         description: User profile retrieved successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/UserProfile'
	 *       401:
	 *         description: Unauthorized - Authentication required or token expired
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       500:
	 *         description: Internal server error
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 */
	router.get('/users/me', verifyAuth, userController.getCurrentUser)
}

export { userRouter }
