import { z } from 'zod'
import { fromError } from 'zod-validation-error'

import { tryCatch, tryCatchSync } from '../../utils/error-handling/try-catch.ts'
import { AppError } from '../../utils/errors.ts'
import { pino } from '../../utils/logger.ts'
import { CognitoService } from '../auth/auth.services.ts'

import { userRepository } from './user.data-access.ts'
import { userIdSchema } from './user.schemas.ts'
import { IUserRepository, IUserService } from './user.types.ts'

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
	 * @returns The user object or null if not found
	 */
	async getUserById({ userId }: { userId: string }) {
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
			throw AppError.from(validationError, 'userService')
		}

		const { data: user, error } = await tryCatch(
			this.userRepository.findUserById({ id: validatedId }),
			'userService - getUserById',
		)

		if (error) {
			logger.error({
				msg: '[userService - getUserById]: Error retrieving user',
				userId,
				error,
			})
			throw AppError.from(error, 'userService')
		}

		// If no user found, return undefined
		if (!user) return undefined

		return user
	}

	/**
	 * Get user by email from the database
	 * @param email The user's email address
	 * @returns The user object or null if not found
	 */
	async getUserByEmail({ email }: { email: string }) {
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
			throw AppError.from(validationError, 'userService')
		}

		const { data: user, error } = await tryCatch(
			this.userRepository.findUserByEmail({ email: validatedEmail }),
			'userService - getUserByEmail',
		)

		if (error) {
			logger.error({
				msg: '[userService - getUserByEmail]: Error retrieving user',
				email,
				error,
			})
			throw AppError.from(error, 'userService')
		}

		// If no user found, return undefined
		if (!user) return undefined

		return user
	}

	/**
	 * Get user by access token
	 * Verifies the token with Cognito and retrieves the user from the database
	 * @param accessToken The Cognito access token
	 * @returns The user object or null if not found
	 */
	async getUserByAccessToken({ accessToken }: { accessToken: string }) {
		// Get user ID from Cognito using access token
		const { data: cognitoUser, error } =
			await this.cognitoService.getAuthUser(accessToken)

		if (error) {
			logger.error({
				msg: '[userService - getUserByAccessToken]: Error retrieving user by token',
				error,
			})
			throw AppError.from(error, 'userService')
		}

		if (!cognitoUser.Username) {
			throw AppError.unauthorized('Invalid access token', 'userService')
		}

		// Use ID to get user from database
		const { data: user, error: userError } = await tryCatch(
			this.getUserById({ userId: cognitoUser.Username }),
			'userService - getUserByAccessToken',
		)

		if (userError) {
			logger.error({
				msg: '[userService - getUserByAccessToken]: Error retrieving user by ID',
				userId: cognitoUser.Username,
				error: userError,
			})
			throw AppError.from(userError, 'userService')
		}

		// If no user found, return undefined
		if (!user) return undefined

		return user
	}

	/**
	 * Register a new user or update login timestamp for existing user
	 * @param id The user's unique identifier from Cognito
	 * @param email The user's email address
	 * @param firstName Optional first name
	 * @param lastName Optional last name
	 * @returns The user object
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
	}) {
		// Check if user Exists
		const { data: user, error } = await tryCatch(
			this.userRepository.findUserById({ id }),
			'userService - registerOrLoginUserById',
		)

		if (error) {
			logger.error({
				msg: '[userService - registerOrLoginUserById]: Error retrieving user',
				userId: id,
				error,
			})
			throw AppError.from(error, 'userService')
		}

		// Create new user if not found
		if (!user) {
			const { data: newUser, error: newUserError } = await tryCatch(
				this.userRepository.createUser({
					userData: {
						id,
						email,
						firstName,
						lastName,
					},
				}),
				'userService - registerOrLoginUserById',
			)

			if (newUserError) {
				logger.error({
					msg: '[userService - registerOrLoginUserById]: Error creating user',
					userId: id,
					error: newUserError,
				})
				throw AppError.from(newUserError, 'userService')
			}

			return newUser
		}

		// Update last login timestamp if found
		const { data: updatedUser, error: updatedUserError } = await tryCatch(
			this.userRepository.updateLastLogin({ id }),
			'userService - registerOrLoginUserById',
		)

		if (updatedUserError) {
			logger.error({
				msg: '[userService - registerOrLoginUserById]: Error updating last login',
				userId: id,
				error: updatedUserError,
			})
			throw AppError.from(updatedUserError, 'userService')
		}

		if (!updatedUser) {
			logger.error({
				msg: '[userService - registerOrLoginUserById]: Failed to update last login',
				userId: id,
			})
			throw AppError.internal(
				'Failed to update last login timestamp',
				'userService',
			)
		}

		return updatedUser
	}
}

// Create an instance of the UserService
const userService = new UserService()

export { UserService, userService }
