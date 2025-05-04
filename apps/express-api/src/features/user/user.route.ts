import { Router } from 'express'

import { userController } from './user.controller.ts'

const userRouter = (router: Router) => {
	/**
	 * @swagger
	 * /user/{id}:
	 *   get:
	 *     tags: [User]
	 *     summary: Get user by id
	 *     parameters:
	 *       - name: id
	 *         in: path
	 *         required: true
	 *         type: string
	 *     responses:
	 *       200:
	 *         description: User found
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/User'
	 *       400:
	 *         description: User ID is required
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/Error'
	 *       404:
	 *         description: User not found
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/Error'
	 *       500:
	 *         description: Internal server error
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/Error'
	 */
	router.get('/user/:id', userController.getUserById)
}

export { userRouter }
