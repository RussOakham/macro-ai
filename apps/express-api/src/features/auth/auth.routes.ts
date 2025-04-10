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
	 *           description: The user's email address.
	 *           example: "user@example.com"
	 *         password:
	 *           type: string
	 *           description: The user's password.
	 *           example: "Password123"
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
	 *         description: User logged in successfully.
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 accessToken:
	 *                   type: string
	 *                   description: The JWT access token.
	 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
	 *                 refreshToken:
	 *                   type: string
	 *                   description: The JWT refresh token.
	 *                   example: "8xLOxBtZp8"
	 *                 expiresIn:
	 *                   type: number
	 *                   description: Token expiration time in seconds.
	 *                   example: 300
	 */
	router.post('/auth/login', authController.login)

	/**
	 * @swagger
	 * /auth/logout:
	 *   post:
	 *     tags: [Authorization]
	 *     summary: Logout user
	 *     responses:
	 *       200:
	 *         description: User logged out successfully
	 *       400:
	 *         description: Bad request
	 *       401:
	 * 		   description: Unauthorized
	 *       500:
	 *         description: Internal server error
	 */
	router.post('/auth/logout', authController.logout)

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
	 * /auth/user:
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
	router.get('/auth/user', authController.getUser)
}

export { authRouter }
