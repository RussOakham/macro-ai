import { fromError } from 'zod-validation-error'

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
	private userRepository: IUserRepository
	private cognitoService: CognitoService

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
		try {
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

			const user = await this.userRepository.findUserById({ id: userId })

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
	 * Get user by email from the database
	 * @param email The user's email address
	 * @returns The user object or null if not found
	 */
	async getUserByEmail({ email }: { email: string }) {
		try {
			const user = await this.userRepository.findUserByEmail({ email })

			if (!user) {
				throw AppError.notFound('User not found', 'userService')
			}

			return user
		} catch (error) {
			logger.error({
				msg: '[userService - getUserByEmail]: Error retrieving user',
				email,
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
	async getUserByAccessToken({ accessToken }: { accessToken: string }) {
		try {
			// Get user ID from Cognito using access token
			const cognitoUser = await this.cognitoService.getAuthUser(accessToken)

			if (!cognitoUser.Username) {
				throw AppError.unauthorized('Invalid access token', 'userService')
			}

			// Use ID to get user from database
			const user = await this.getUserById({ userId: cognitoUser.Username })
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
		try {
			let user = await this.userRepository.findUserById({ id })

			if (!user) {
				// Create new user if not found
				logger.info({
					msg: '[userService - registerOrLoginUserById]: Creating new user',
					userId: id,
					email,
				})
				user = await this.userRepository.createUser({
					userData: {
						id,
						email,
						firstName,
						lastName,
					},
				})
			} else {
				// Update last login timestamp for existing user
				logger.info({
					msg: '[userService - registerOrLoginUserById]: Updating last login',
					userId: id,
					email,
				})
				user = await this.userRepository.updateLastLogin({ id })
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

// Create an instance of the UserService
const userService = new UserService()

export { UserService, userService }
