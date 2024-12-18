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
	 *     ResendConfirmationCode:
	 *       type: object
	 *       properties:
	 *         username:
	 *           type: string
	 *       required:
	 *         - username
	 *     Login:
	 *       type: object
	 *       properties:
	 *         email:
	 *           type: string
	 *         password:
	 *           type: string
	 *       required:
	 *         - email
	 *         - password
	 */

	/**
	 * @swagger
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
	 */
	router.post('/auth/register', authController.register)

	/**
	 * @swagger
	 * /auth/login:
	 *   post:
	 *     tags: [Authorization]
	 *     summary: Login user
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             $ref: '#/components/schemas/Login'
	 *     responses:
	 *       200:
	 *         description: User logged in successfully
	 *       400:
	 *         description: Bad request
	 *       500:
	 *         description: Internal server error
	 */
	router.post('/auth/login', authController.login)

	/**
	 * @swagger
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
	router.post('/auth/confirm-registration', authController.confirmRegistration)

	/**
	 * @swagger
	 * /auth/resend-confirmation-code:
	 *   post:
	 *     tags: [Authorization]
	 *     summary: Resend confirmation code
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             $ref: '#/components/schemas/ResendConfirmationCode'
	 *     responses:
	 *       200:
	 *         description: Confirmation code resent successfully
	 *       400:
	 *         description: Bad request
	 *       500:
	 *         description: Internal server error
	 */
	router.post(
		'/auth/resend-confirmation-code',
		authController.resendConfirmationCode,
	)

	/**
	 * @swagger
	 * /auth/profile:
	 *   get:
	 *     tags: [Authorization]
	 *     summary: Get user profile
	 *     responses:
	 *       200:
	 *         description: User profile retrieved successfully
	 *       400:
	 *         description: Bad request
	 *       500:
	 *         description: Internal server error
	 */
	router.get('/auth/profile', authController.getProfile)
}

export { authRouter }
