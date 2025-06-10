import { z } from 'zod'
import { fromError } from 'zod-validation-error'

import {
	EnhancedResult,
	tryCatchSync,
} from '../../utils/error-handling/try-catch.ts'
import { AppError } from '../../utils/errors.ts'
import { pino } from '../../utils/logger.ts'
import { CognitoService } from '../auth/auth.services.ts'

import { userRepository } from './user.data-access.ts'
import { userIdSchema } from './user.schemas.ts'
import { IUserRepository, IUserService, TUser } from './user.types.ts'

const { logger } = pino
const cognito = new CognitoService()

class UserService implements IUserService {
	private readonly userRepository: IUserRepository
	private readonly cognitoService: CognitoService

	constructor(
		userRepo: IUserRepository = userRepository,
		cognitoSvc: CognitoService = cognito,
	) {
		this.userRepository = userRepo
		this.cognitoService = cognitoSvc
	}

	/**
	 * Get user by ID from the database
	 * @param userId The user's unique identifier
	 * @returns EnhancedResult with the user object or undefined if not found
	 */
	async getUserById({
		userId,
	}: {
		userId: string
	}): Promise<EnhancedResult<TUser | undefined>> {
		// Validate userId with Zod using tryCatchSync
		const { data: validatedId, error: validationError } = tryCatchSync(() => {
			const result = userIdSchema.safeParse(userId)
			if (!result.success) {
				const validationError = fromError(result.error)
				throw AppError.validation(
					`Invalid user ID: ${validationError.message}`,
					{ details: validationError.details },
					'userService',
				)
			}
			return userId
		}, 'userService - validateUserId')

		if (validationError) {
			logger.error({
				msg: '[userService - getUserById]: Invalid user ID',
				userId,
				error: validationError,
			})
			return { data: null, error: validationError }
		}

		const result = await this.userRepository.findUserById({
			id: validatedId,
		})

		if (result.error) {
			logger.error({
				msg: '[userService - getUserById]: Error retrieving user',
				userId,
				error: result.error,
			})
			return { data: null, error: result.error }
		}

		return { data: result.data, error: null }
	}

	/**
	 * Get user by email from the database
	 * @param email The user's email address
	 * @returns EnhancedResult with the user object or undefined if not found
	 */
	async getUserByEmail({
		email,
	}: {
		email: string
	}): Promise<EnhancedResult<TUser | undefined>> {
		// Validate email with Zod and tryCatchSync
		const { data: validatedEmail, error: validationError } = tryCatchSync(
			() => {
				const result = z.string().email().safeParse(email)
				if (!result.success) {
					const validationError = fromError(result.error)
					throw AppError.validation(
						`Invalid email: ${validationError.message}`,
						{ details: validationError.details },
						'userService',
					)
				}
				return result.data
			},
			'userService - validateEmail',
		)

		if (validationError) {
			logger.error({
				msg: '[userService - getUserByEmail]: Invalid email',
				email,
				error: validationError,
			})
			return { data: null, error: validationError }
		}

		const { data: result, error: resultError } =
			await this.userRepository.findUserByEmail({
				email: validatedEmail,
			})

		if (resultError) {
			logger.error({
				msg: '[userService - getUserByEmail]: Error retrieving user',
				email,
				error: resultError,
			})
			return { data: null, error: resultError }
		}

		return { data: result, error: null }
	}

	/**
	 * Get user by access token
	 * Verifies the token with Cognito and retrieves the user from the database
	 * @param accessToken The Cognito access token
	 * @returns EnhancedResult with the user object or undefined if not found
	 */
	async getUserByAccessToken({
		accessToken,
	}: {
		accessToken: string
	}): Promise<EnhancedResult<TUser | undefined>> {
		// Get user ID from Cognito using access token
		const cognitoResult = await this.cognitoService.getAuthUser(accessToken)

		if (cognitoResult.error) {
			logger.error({
				msg: '[userService - getUserByAccessToken]: Error retrieving user by token',
				error: cognitoResult.error,
			})
			return { data: null, error: cognitoResult.error }
		}

		if (!cognitoResult.data.Username) {
			const error = AppError.unauthorized('Invalid access token', 'userService')
			return { data: null, error }
		}

		// Use ID to get user from database
		const userResult = await this.getUserById({
			userId: cognitoResult.data.Username,
		})

		if (userResult.error) {
			logger.error({
				msg: '[userService - getUserByAccessToken]: Error retrieving user by ID',
				userId: cognitoResult.data.Username,
				error: userResult.error,
			})
			return { data: null, error: userResult.error }
		}

		return { data: userResult.data, error: null }
	}

	/**
	 * Register a new user or update login timestamp for existing user
	 * @param id The user's unique identifier from Cognito
	 * @param email The user's email address
	 * @param firstName Optional first name
	 * @param lastName Optional last name
	 * @returns EnhancedResult with the user object
	 */
	async registerOrLoginUserById({
		id,
		email,
		firstName,
		lastName,
	}: {
		id: string
		email: string
		firstName?: string
		lastName?: string
	}): Promise<EnhancedResult<TUser>> {
		// Check if user Exists
		const userResult = await this.userRepository.findUserById({ id })

		if (userResult.error) {
			logger.error({
				msg: '[userService - registerOrLoginUserById]: Error retrieving user',
				userId: id,
				error: userResult.error,
			})
			return { data: null, error: userResult.error }
		}

		// Create new user if not found
		if (!userResult.data) {
			const newUserResult = await this.userRepository.createUser({
				userData: {
					id,
					email,
					firstName,
					lastName,
				},
			})

			if (newUserResult.error) {
				logger.error({
					msg: '[userService - registerOrLoginUserById]: Error creating user',
					userId: id,
					error: newUserResult.error,
				})
				return { data: null, error: newUserResult.error }
			}

			return { data: newUserResult.data, error: null }
		}

		// Update last login timestamp if found
		const updatedUserResult = await this.userRepository.updateLastLogin({ id })

		if (updatedUserResult.error) {
			logger.error({
				msg: '[userService - registerOrLoginUserById]: Error updating last login',
				userId: id,
				error: updatedUserResult.error,
			})
			return { data: null, error: updatedUserResult.error }
		}

		if (!updatedUserResult.data) {
			const error = AppError.internal(
				'Failed to update last login timestamp',
				'userService',
			)
			logger.error({
				msg: '[userService - registerOrLoginUserById]: Failed to update last login',
				userId: id,
			})
			return { data: null, error }
		}

		return { data: updatedUserResult.data, error: null }
	}
}

// Create an instance of the UserService
const userService = new UserService()

export { UserService, userService }
