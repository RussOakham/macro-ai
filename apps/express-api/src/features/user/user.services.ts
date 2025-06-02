import { fromError } from 'zod-validation-error'

import { tryCatch } from '../../utils/error-handling/try-catch.ts'
import { AppError } from '../../utils/errors.ts'
import { pino } from '../../utils/logger.ts'
import { CognitoService } from '../auth/auth.services.ts'

import { userRepository } from './user.data-access.ts'
import { userIdSchema } from './user.schemas.ts'
import { IUserRepository, TUser } from './user.types.ts'

const { logger } = pino
const cognito = new CognitoService()

interface IUserService {
	getUserById: ({ userId }: { userId: string }) => Promise<TUser | null>
	getUserByEmail: ({ email }: { email: string }) => Promise<TUser | null>
	getUserByAccessToken: ({
		accessToken,
	}: {
		accessToken: string
	}) => Promise<TUser | null>
	registerOrLoginUserById: ({
		id,
		email,
		firstName,
		lastName,
	}: {
		id: string
		email: string
		firstName?: string
		lastName?: string
	}) => Promise<TUser>
}

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
		// Validate userId with Zod
		const result = userIdSchema.safeParse(userId)

		if (!result.success) {
			const validationError = fromError(result.error)
			throw AppError.validation(
				`Invalid user ID: ${validationError.message}`,
				{ details: validationError.details },
				'userService',
			)
		}

		const { data: user, error } = await tryCatch(
			this.userRepository.findUserById({ id: userId }),
		)

		if (error) {
			logger.error({
				msg: '[userService - getUserById]: Error retrieving user',
				userId,
				error,
			})
			throw AppError.from(error, 'userService')
		}

		if (!user) {
			logger.error({
				msg: '[userService - getUserById]: User not found',
				userId,
			})
			throw AppError.notFound('User not found', 'userService')
		}

		console.log(user.id)

		return user
	}

	/**
	 * Get user by email from the database
	 * @param email The user's email address
	 * @returns The user object or null if not found
	 */
	async getUserByEmail({ email }: { email: string }) {
		const { data: user, error } = await tryCatch(
			this.userRepository.findUserByEmail({ email }),
		)

		if (error) {
			logger.error({
				msg: '[userService - getUserByEmail]: Error retrieving user',
				email,
				error,
			})
			throw AppError.from(error, 'userService')
		}

		if (!user) {
			logger.error({
				msg: '[userService - getUserByEmail]: User not found',
				email,
			})
			throw AppError.notFound('User not found', 'userService')
		}

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
		const { data: cognitoUser, error } = await tryCatch(
			this.cognitoService.getAuthUser(accessToken),
		)

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
		)

		if (userError) {
			logger.error({
				msg: '[userService - getUserByAccessToken]: Error retrieving user by ID',
				userId: cognitoUser.Username,
				error: userError,
			})
			throw AppError.from(userError, 'userService')
		}

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
