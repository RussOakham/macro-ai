import { AppError } from '../../utils/errors.ts'
import { pino } from '../../utils/logger.ts'
import { CognitoService } from '../auth/auth.services.ts'

import {
	createUser,
	findUserById,
	updateLastLogin,
} from './user.data-access.ts'

const { logger } = pino
const cognitoService = new CognitoService()

/**
 * UserService class for handling user-related business logic
 */
class UserService {
	/**
	 * Register or login a user by their ID (Cognito user ID)
	 * If the user doesn't exist, creates a new user
	 * If the user exists, updates their last login timestamp
	 *
	 * @param id - The Cognito user ID
	 * @param email - The user's email address
	 * @returns The user object
	 */
	async registerOrLoginUserById(id: string, email: string) {
		let user = await findUserById(id)

		if (!user) {
			user = await createUser(id, email)
		} else {
			user = await updateLastLogin(id)
		}

		return user
	}

	/**
	 * Get a user by their ID
	 *
	 * @param id - The user ID to look up
	 * @returns The user object or null if not found
	 */
	async getUserById(id: string) {
		const user = await findUserById(id)

		if (!user) {
			return null
		}

		return user
	}

	/**
	 * Get a user by their access token
	 *
	 * @param accessToken - The access token to validate
	 * @returns The user object or null if not found/invalid
	 */
	async getUserByAccessToken(accessToken: string) {
		try {
			// Step 1: Get user information from Cognito using the access token
			const cognitoUser = await cognitoService.getCognitoUser(accessToken)

			if (!cognitoUser.Username) {
				logger.error(
					'[UserService]: No user found in Cognito for the provided access token',
				)
				return null
			}

			// Step 2: Use the Cognito user ID to get user details from PostgreSQL
			const userId = cognitoUser.Username
			const user = await this.getUserById(userId)

			if (!user) {
				logger.error(
					`[UserService]: User with ID ${userId} not found in database`,
				)
				return null
			}

			return user
		} catch (error) {
			// Handle token validation errors
			if (error instanceof AppError && error.status === 401) {
				logger.error('[UserService]: Invalid or expired access token')
				return null
			}

			// Log other errors but don't expose them
			logger.error(
				`[UserService]: Error getting user by access token: ${error instanceof Error ? error.message : 'Unknown error'}`,
			)
			return null
		}
	}
}

// Create a singleton instance
const userService = new UserService()

export { userService }
