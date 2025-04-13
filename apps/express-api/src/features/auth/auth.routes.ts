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
	 *     Logout:
	 *       type: object
	 *       properties:
	 *         accessToken:
	 *           type: string
	 *         refreshToken:
	 *           type: string
	 *       required:
	 *         - accessToken
	 *     RefreshToken:
	 *       type: object
	 *       properties:
	 *         refreshToken:
	 *           type: string
	 *       required:
	 *         - refreshToken
	 *       example: "8xLOxBtZp8"
	 *     GetUser:
	 *       type: object
	 *       properties:
	 *         accessToken:
	 *           type: string
	 *       required:
	 *         - accessToken
	 *       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
	 *     AuthResponse:
	 *       type: object
	 *       properties:
	 *         message:
	 *           type: string
	 *           description: Response message
	 *         user:
	 *           type: object
	 *           properties:
	 *             id:
	 *               type: string
	 *               description: User ID
	 *             email:
	 *               type: string
	 *               description: User email
	 *         tokens:
	 *           type: object
	 *           properties:
	 *             accessToken:
	 *               type: string
	 *               description: JWT access token
	 *             refreshToken:
	 *               type: string
	 *               description: JWT refresh token
	 *     ErrorResponse:
	 *       type: object
	 *       properties:
	 *         message:
	 *           type: string
	 *           description: Error message
	 *         details:
	 *           type: object
	 *           description: Additional error details (optional)
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
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/AuthResponse'
	 *       400:
	 *         description: Validation error
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       409:
	 *         description: User already exists
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
	router.post('/auth/register', authController.register)

	/**
	 * @swagger
	 * /auth/confirm-registration:
	 *   post:
	 *     tags: [Authorization]
	 *     summary: Confirm user registration with verification code
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             $ref: '#/components/schemas/ConfirmRegistration'
	 *     responses:
	 *       200:
	 *         description: Registration confirmed successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/AuthResponse'
	 *       400:
	 *         description: Invalid verification code
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       404:
	 *         description: User not found
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
	 *         description: Login successful
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   example: "Login successful"
	 *                 tokens:
	 *                   type: object
	 *                   properties:
	 *                     accessToken:
	 *                       type: string
	 *                       description: JWT access token
	 *                     refreshToken:
	 *                       type: string
	 *                       description: JWT refresh token
	 *                     expiresIn:
	 *                       type: number
	 *                       description: Token expiration time in seconds
	 *         headers:
	 *           Set-Cookie:
	 *             schema:
	 *               type: string
	 *               description: Authentication cookies (accessToken, refreshToken)
	 *       400:
	 *         description: Invalid credentials
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       401:
	 *         description: User not confirmed
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
	router.post('/auth/login', authController.login)

	/**
	 * @swagger
	 * /auth/logout:
	 *   post:
	 *     tags: [Authorization]
	 *     summary: Logout user
	 *     security:
	 *       - cookieAuth: []
	 *     responses:
	 *       200:
	 *         description: Logout successful
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   example: "Logout successful"
	 *       401:
	 *         description: Unauthorized - No valid session
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
	router.post('/auth/logout', authController.logout)

	/**
	 * @swagger
	 * /auth/refresh:
	 *   post:
	 *     tags: [Authorization]
	 *     summary: Refresh access token
	 *     security:
	 *       - cookieAuth: []
	 *     responses:
	 *       200:
	 *         description: Tokens refreshed successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   example: "Tokens refreshed successfully"
	 *                 tokens:
	 *                   type: object
	 *                   properties:
	 *                     accessToken:
	 *                       type: string
	 *                       description: New access token
	 *                     refreshToken:
	 *                       type: string
	 *                       description: New refresh token
	 *                     expiresIn:
	 *                       type: number
	 *                       description: Token expiration time in seconds
	 *         headers:
	 *           Set-Cookie:
	 *             schema:
	 *               type: string
	 *               description: Updated authentication cookies
	 *       401:
	 *         description: Invalid or expired refresh token
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
	router.post('/auth/refresh', authController.refreshToken)

	/**
	 * @swagger
	 * /auth/user:
	 *   get:
	 *     tags: [Authorization]
	 *     summary: Get user profile
	 *     security:
	 *       - cookieAuth: []
	 *     responses:
	 *       200:
	 *         description: User profile retrieved successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   example: "User profile retrieved successfully"
	 *                 user:
	 *                   type: object
	 *                   properties:
	 *                     id:
	 *                       type: string
	 *                       description: User ID
	 *                     email:
	 *                       type: string
	 *                       description: User email
	 *       401:
	 *         description: Unauthorized - Invalid or expired token
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
	router.get('/auth/user', authController.getUser)
}

export { authRouter }

