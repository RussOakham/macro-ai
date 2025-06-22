import { z } from 'zod'
import { fromError } from 'zod-validation-error'

import { tryCatchSync } from '../../utils/error-handling/try-catch.ts'
import {
	InternalError,
	NotFoundError,
	Result,
	UnauthorizedError,
	ValidationError,
} from '../../utils/errors.ts'
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
	 * @returns Result tuple with the user object or error
	 */
	getUserById = async ({
		userId,
	}: {
		userId: string
	}): Promise<Result<TUser>> => {
		// Validate userId with Zod using tryCatchSync
		const [validatedId, validationError] = tryCatchSync(() => {
			const result = userIdSchema.safeParse(userId)
			if (!result.success) {
				const validationError = fromError(result.error)
				throw new ValidationError(
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
			return [null, validationError]
		}

		const [user, repositoryError] = await this.userRepository.findUserById({
			id: validatedId,
		})

		if (repositoryError) {
			logger.error({
				msg: '[userService - getUserById]: Error retrieving user',
				userId,
				error: repositoryError,
			})
			return [null, repositoryError]
		}

		// If user is not found, return a NotFoundError instead of undefined
		if (!user) {
			const error = new NotFoundError(
				`User with ID ${userId} not found`,
				'userService - getUserById',
			)
			logger.info({
				msg: '[userService - getUserById]: User not found',
				userId,
			})
			return [null, error]
		}

		return [user, null]
	}

	/**
	 * Get user by email from the database
	 * @param email The user's email address
	 * @returns Result tuple with the user object or error
	 */
	getUserByEmail = async ({
		email,
	}: {
		email: string
	}): Promise<Result<TUser>> => {
		// Validate email with Zod and tryCatchSync
		const [validatedEmail, validationError] = tryCatchSync(() => {
			const result = z.string().email().safeParse(email)
			if (!result.success) {
				const validationError = fromError(result.error)
				throw new ValidationError(
					`Invalid email: ${validationError.message}`,
					{ details: validationError.details },
					'userService',
				)
			}
			return result.data
		}, 'userService - validateEmail')

		if (validationError) {
			logger.error({
				msg: '[userService - getUserByEmail]: Invalid email',
				email,
				error: validationError,
			})
			return [null, validationError]
		}

		const [user, repositoryError] = await this.userRepository.findUserByEmail({
			email: validatedEmail,
		})

		if (repositoryError) {
			logger.error({
				msg: '[userService - getUserByEmail]: Error retrieving user',
				email,
				error: repositoryError,
			})
			return [null, repositoryError]
		}

		// If user is not found, return a NotFoundError instead of undefined
		if (!user) {
			const error = new NotFoundError(
				`User with email ${email} not found`,
				'userService - getUserByEmail',
			)
			logger.info({
				msg: '[userService - getUserByEmail]: User not found',
				email,
			})
			return [null, error]
		}

		return [user, null]
	}

	/**
	 * Get user by access token
	 * Verifies the token with Cognito and retrieves the user from the database
	 * @param accessToken The Cognito access token
	 * @returns Result tuple with the user object or error
	 */
	getUserByAccessToken = async ({
		accessToken,
	}: {
		accessToken: string
	}): Promise<Result<TUser>> => {
		// Get user ID from Cognito using access token
		const [cognitoUser, cognitoError] =
			await this.cognitoService.getAuthUser(accessToken)

		if (cognitoError) {
			logger.error({
				msg: '[userService - getUserByAccessToken]: Error retrieving user by token',
				error: cognitoError,
			})
			return [null, cognitoError]
		}

		// Check if cognitoUser exists and has a Username property
		if (!cognitoUser.Username) {
			const error = new UnauthorizedError('Invalid access token', 'userService')
			logger.error({
				msg: '[userService - getUserByAccessToken]: Missing or invalid user data from token',
				error: error.message,
			})
			return [null, error]
		}

		// Use ID to get user from database
		const [user, userError] = await this.getUserById({
			userId: cognitoUser.Username,
		})

		// No need to check for undefined here since getUserById now returns an error if user not found
		if (userError) {
			logger.error({
				msg: '[userService - getUserByAccessToken]: Error retrieving user by ID',
				userId: cognitoUser.Username,
				error: userError,
			})
			return [null, userError]
		}

		return [user, null]
	}

	/**
	 * Register a new user or update login timestamp for existing user
	 * @param id The user's unique identifier from Cognito
	 * @param email The user's email address
	 * @param firstName Optional first name
	 * @param lastName Optional last name
	 * @returns Result tuple with the user object
	 */
	registerOrLoginUserById = async ({
		id,
		email,
		firstName,
		lastName,
	}: {
		id: string
		email: string
		firstName?: string
		lastName?: string
	}): Promise<Result<TUser>> => {
		// Check if user Exists
		const [existingUser, userError] = await this.userRepository.findUserById({
			id,
		})

		if (userError) {
			logger.error({
				msg: '[userService - registerOrLoginUserById]: Error retrieving user',
				userId: id,
				error: userError,
			})
			return [null, userError]
		}

		// Create new user if not found
		if (!existingUser) {
			const [newUser, createError] = await this.userRepository.createUser({
				userData: {
					id,
					email,
					firstName,
					lastName,
				},
			})

			if (createError) {
				logger.error({
					msg: '[userService - registerOrLoginUserById]: Error creating user',
					userId: id,
					error: createError,
				})
				return [null, createError]
			}

			return [newUser, null]
		}

		// Update last login timestamp if found
		const [updatedUser, updateError] =
			await this.userRepository.updateLastLogin({ id })

		if (updateError) {
			logger.error({
				msg: '[userService - registerOrLoginUserById]: Error updating last login',
				userId: id,
				error: updateError,
			})
			return [null, updateError]
		}

		if (!updatedUser) {
			const error = new InternalError(
				'Failed to update last login timestamp',
				'userService',
			)
			logger.error({
				msg: '[userService - registerOrLoginUserById]: Failed to update last login',
				userId: id,
			})
			return [null, error]
		}

		return [updatedUser, null]
	}
}

// Create an instance of the UserService
const userService = new UserService()

export { UserService, userService }
