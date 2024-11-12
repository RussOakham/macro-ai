import { type Router } from 'express'

import { authController } from './auth.controller.ts'

const authRouter = (router: Router) => {
	/**
	 * @swagger
	 * tags:
	 *   name: Authorization
	 *   description: Authorization endpoints
	 * components:
	 *   schemas:
	 */
	router.post('/auth/register', authController.register)
	router.post('/auth/login', authController.login)
	router.post('/auth/confirm-registration', authController.confirmRegistration)
	router.get('/auth/profile', authController.getProfile)
}

export { authRouter }
