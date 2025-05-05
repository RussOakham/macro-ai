import { AppError } from '../../utils/errors.ts'
import { pino } from '../../utils/logger.ts'
import { CognitoService } from '../auth/auth.services.ts'

import {
	createUser,
	findUserById,
	updateLastLogin,
} from './user.data-access.ts'

const { logger } = pino
const cognito = new CognitoService()

class UserService {
	/**
	 * Get user by ID from the database
	 * @param userId The user's unique identifier
	 * @returns The user object or null if not found
	 */
	async getUserById(userId: string) {
		try {
			const user = await findUserById(userId)

			if (!user) {
				throw AppError.notFound('User not found', 'userService')
			}

			return user
		} catch (error) {
			logger.error({
				msg: '[userService - getUserById]: Error retrieving user',
				userId,
				error,
			})
			throw AppError.from(error, 'userService')
		}
	}

	/**
	 * Get user by access token
	 * Verifies the token with Cognito and retrieves the user from the database
	 * @param accessToken The Cognito access token
	 * @returns The user object or null if not found
	 */
	async getUserByAccessToken(accessToken: string) {
		try {
			// Get user ID from Cognito using access token
			const cognitoUser = await cognito.getAuthUser(accessToken)

			if (!cognitoUser.Username) {
				throw AppError.unauthorized('Invalid access token', 'userService')
			}

			// Use ID to get user from database
			const user = await this.getUserById(cognitoUser.Username)
			return user
		} catch (error) {
			logger.error({
				msg: '[userService - getUserByAccessToken]: Error retrieving user by token',
				error,
			})
			throw AppError.from(error, 'userService')
		}
	}

	/**
	 * Register a new user or update login timestamp for existing user
	 * @param id The user's unique identifier from Cognito
	 * @param email The user's email address
	 * @param firstName Optional first name
	 * @param lastName Optional last name
	 * @returns The user object
	 */
	async registerOrLoginUserById(
		id: string,
		email: string,
		firstName?: string,
		lastName?: string,
	) {
		try {
			let user = await findUserById(id)

			if (!user) {
				// Create new user if not found
				logger.info({
					msg: '[userService - registerOrLoginUserById]: Creating new user',
					userId: id,
					email,
				})
				user = await createUser({
					id,
					email,
					firstName,
					lastName,
				})
			} else {
				// Update last login timestamp for existing user
				logger.info({
					msg: '[userService - registerOrLoginUserById]: Updating last login',
					userId: id,
					email,
				})
				user = await updateLastLogin(email)
			}

			if (!user) {
				throw AppError.internal(
					'Failed to create or update user',
					'userService',
				)
			}

			return user
		} catch (error) {
			logger.error({
				msg: '[userService - registerOrLoginUserById]: Error registering or logging in user',
				userId: id,
				email,
				error,
			})
			throw AppError.from(error, 'userService')
		}
	}
}

export const userService = new UserService()
