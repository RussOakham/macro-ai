import { type Router } from 'express'

import { authController } from './auth.controller.ts'

const authRouter = (router: Router) => {
	/**
	 * @swagger
	 * components:
	 *   schemas:
	 *     Register:
	 *       type: object
	 *       properties:
	 *         email:
	 *           type: string
	 *         password:
	 *           type: string
	 *       required:
	 *         - email
	 *         - password
	 *     ConfirmRegistration:
	 *       type: object
	 *       properties:
	 *         username:
	 *           type: string
	 *         code:
	 *           type: number
	 *       required:
	 *         - username
	 *         - code
	 * /auth/register:
	 *   post:
	 *     tags: [Authorization]
	 *     summary: Register a new user
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             $ref: '#/components/schemas/Register'
	 *     responses:
	 *       201:
	 *         description: User registered successfully
	 *       400:
	 *         description: Bad request
	 *       500:
	 *         description: Internal server error
	 * /auth/confirm-registration:
	 *   post:
	 *     tags: [Authorization]
	 *     summary: Confirm user registration
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             $ref: '#/components/schemas/ConfirmRegistration'
	 *     responses:
	 *       200:
	 *         description: User registration confirmed successfully
	 *       400:
	 *         description: Bad request
	 *       500:
	 *         description: Internal server error
	 */
	router.post('/auth/register', authController.register)
	router.post('/auth/login', authController.login)
	router.post('/auth/confirm-registration', authController.confirmRegistration)
	router.get('/auth/profile', authController.getProfile)
}

export { authRouter }
