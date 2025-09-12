import type express from 'express'
import type { z } from 'zod'

import { type Result } from '../../utils/errors.ts'
import type {
	insertUserSchema,
	selectUserSchema,
	userResponseSchema,
} from './user.schemas.ts'

interface IUserController {
	getCurrentUser: express.Handler
	getUserById: express.Handler
}

interface IUserService {
	getUserById: ({ userId }: { userId: string }) => Promise<Result<TUser>>
	getUserByEmail: ({ email }: { email: string }) => Promise<Result<TUser>>
	getUserByAccessToken: ({
		accessToken,
	}: {
		accessToken: string
	}) => Promise<Result<TUser>>
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
	}) => Promise<Result<TUser>>
}

interface IUserRepository {
	findUserByEmail: ({
		email,
	}: {
		email: string
	}) => Promise<Result<TUser | undefined>>
	findUserById: ({ id }: { id: string }) => Promise<Result<TUser | undefined>>
	createUser: ({
		userData,
	}: {
		userData: TInsertUser
	}) => Promise<Result<TUser>>
	updateLastLogin: ({
		id,
	}: {
		id: string
	}) => Promise<Result<TUser | undefined>>
	updateUser: (
		id: string,
		userData: Partial<TInsertUser>,
	) => Promise<Result<TUser | undefined>>
}

// Define types using Zod schemas
type TInsertUser = z.infer<typeof insertUserSchema>
type TUser = z.infer<typeof selectUserSchema>
type TUserResponse = z.infer<typeof userResponseSchema>

export type {
	IUserController,
	IUserRepository,
	IUserService,
	TInsertUser,
	TUser,
	TUserResponse,
}
