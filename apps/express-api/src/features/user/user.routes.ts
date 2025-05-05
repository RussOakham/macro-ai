import { Router } from 'express'

import { userController } from './user.controller.ts'

const userRouter = (router: Router) => {
	/**
	 * @swagger
	 * /users/me:
	 *   get:
	 *     summary: Get the current user
	 *     description: Retrieves the current user based on the access token
	 *     tags: [Users]
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       200:
	 *         description: User found
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/User'
	 *       401:
	 *         description: Unauthorized - Invalid or expired token
	 *       404:
	 *         description: User not found
	 *       500:
	 *         description: Internal server error
	 */
	router.get('/users/me', userController.getCurrentUser)

	/**
	 * @swagger
	 * /users/{id}:
	 *   get:
	 *     summary: Get a user by ID
	 *     description: Retrieves a user by their ID
	 *     tags: [Users]
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: string
	 *         description: The user ID
	 *     responses:
	 *       200:
	 *         description: User found
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/User'
	 *       400:
	 *         description: Bad request - Missing ID
	 *       404:
	 *         description: User not found
	 *       500:
	 *         description: Internal server error
	 */
	router.get('/users/:id', userController.getUserById)
}

export { userRouter }
