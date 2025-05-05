import { Router } from 'express'

import { verifyAuth } from '../../middleware/auth.middleware.ts'
import { validate } from '../../middleware/validation.middleware.ts'

import { authController } from './auth.controller.ts'
import {
	confirmForgotPasswordSchema,
	confirmRegistrationSchema,
	forgotPasswordSchema,
	loginSchema,
	registerSchema,
	resendConfirmationCodeSchema,
} from './auth.schemas.ts'

const authRouter = (router: Router) => {
	/**
	 * @swagger
	 * /auth/register:
	 *   post:
	 *     summary: Register a new user
	 *     description: Creates a new user account in Cognito and the application database
	 *     tags: [Authentication]
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             $ref: '#/components/schemas/RegisterRequest'
	 *     responses:
	 *       201:
	 *         description: User registered successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/AuthResponse'
	 *       400:
	 *         description: Invalid input or user already exists
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
	router.post(
		'/auth/register',
		validate(registerSchema),
		authController.register,
	)

	/**
	 * @swagger
	 * /auth/login:
	 *   post:
	 *     summary: Login user
	 *     description: Authenticates a user and returns tokens as cookies and in response body
	 *     tags: [Authentication]
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             $ref: '#/components/schemas/LoginRequest'
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
	 *                   example: Login successful
	 *                 tokens:
	 *                   $ref: '#/components/schemas/TokenResponse'
	 *                 user:
	 *                   $ref: '#/components/schemas/UserProfile'
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
	 *       500:
	 *         description: Internal server error
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 */
	router.post('/auth/login', validate(loginSchema), authController.login)

	/**
	 * @swagger
	 * /auth/refresh:
	 *   post:
	 *     summary: Refresh access token
	 *     description: Uses a refresh token to obtain a new access token
	 *     tags: [Authentication]
	 *     responses:
	 *       200:
	 *         description: Token refreshed successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   example: Token refreshed successfully
	 *                 tokens:
	 *                   $ref: '#/components/schemas/TokenResponse'
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
	 * /auth/logout:
	 *   post:
	 *     summary: Logout user
	 *     description: Invalidates the user's tokens and clears authentication cookies
	 *     tags: [Authentication]
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
	 *                   example: Logout successful
	 *         headers:
	 *           Set-Cookie:
	 *             schema:
	 *               type: string
	 *               description: Cleared authentication cookies
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
	router.post(
		'/auth/confirm-registration',
		validate(confirmRegistrationSchema),
		authController.confirmRegistration,
	)

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
		validate(resendConfirmationCodeSchema),
		authController.resendConfirmationCode,
	)

	/**
	 * @swagger
	 * /auth/user:
	 *   get:
	 *     tags: [Authorization]
	 *     summary: Get user profile
	 *     description: Retrieves the authenticated user's profile information
	 *     security:
	 *       - cookieAuth: []
	 *     responses:
	 *       200:
	 *         description: User profile retrieved successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/GetAuthUserResponse'
	 *       401:
	 *         description: Unauthorized - Authentication required
	 *         content:
	 *           application/json:
	 *             schema:
	 *               oneOf:
	 *                 - type: object
	 *                   properties:
	 *                     message:
	 *                       type: string
	 *                       example: "Authentication required"
	 *                 - type: object
	 *                   properties:
	 *                     message:
	 *                       type: string
	 *                       example: "Authentication token expired"
	 *                     code:
	 *                       type: string
	 *                       example: "TOKEN_EXPIRED"
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
	router.get('/auth/user', verifyAuth, authController.getAuthUser)

	/**
	 * @swagger
	 * /auth/forgot-password:
	 *   post:
	 *     tags: [Authorization]
	 *     summary: Request password reset
	 *     description: Sends a password reset code to the user's email
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             properties:
	 *               email:
	 *                 type: string
	 *                 format: email
	 *                 description: User's email address
	 *                 example: "user@example.com"
	 *             required:
	 *               - email
	 *     responses:
	 *       200:
	 *         description: Password reset code sent successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               required:
	 *                 - message
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   example: "Password reset code has been sent to your email"
	 *       400:
	 *         $ref: '#/components/responses/BadRequest'
	 *       404:
	 *         $ref: '#/components/responses/NotFound'
	 *       500:
	 *         $ref: '#/components/responses/ServerError'
	 */
	router.post(
		'/auth/forgot-password',
		validate(forgotPasswordSchema),
		authController.forgotPassword,
	)

	/**
	 * @swagger
	 * /auth/confirm-forgot-password:
	 *   post:
	 *     tags: [Authorization]
	 *     summary: Confirm password reset
	 *     description: Resets the user's password using the confirmation code
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             properties:
	 *               email:
	 *                 type: string
	 *                 format: email
	 *                 description: User's email address
	 *                 example: "user@example.com"
	 *               code:
	 *                 type: string
	 *                 description: Password reset confirmation code
	 *                 example: "123456"
	 *               newPassword:
	 *                 type: string
	 *                 description: New password
	 *                 example: "NewSecurePassword123!"
	 *               confirmPassword:
	 *                 type: string
	 *                 description: Confirm new password
	 *                 example: "NewSecurePassword123!"
	 *             required:
	 *               - email
	 *               - code
	 *               - newPassword
	 *               - confirmPassword
	 *     responses:
	 *       200:
	 *         description: Password reset successful
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               required:
	 *                 - message
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   example: "Password reset successfully"
	 *       400:
	 *         $ref: '#/components/responses/BadRequest'
	 *       404:
	 *         $ref: '#/components/responses/NotFound'
	 *       500:
	 *         $ref: '#/components/responses/ServerError'
	 */
	router.post(
		'/auth/confirm-forgot-password',
		validate(confirmForgotPasswordSchema),
		authController.confirmForgotPassword,
	)
}

export { authRouter }
