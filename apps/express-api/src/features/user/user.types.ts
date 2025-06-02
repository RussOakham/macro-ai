import express from 'express'
import { z } from 'zod'

import {
	insertUserSchema,
	messageBaseSchema,
	selectUserSchema,
	userResponseSchema,
} from './user.schemas.ts'

interface IUserController {
	getCurrentUser: express.Handler
	getUserById: express.Handler
}

interface IUserService {
	getUserById: ({
		userId,
	}: {
		userId: string
	}) => Promise<TUser | undefined | null>
	getUserByEmail: ({
		email,
	}: {
		email: string
	}) => Promise<TUser | undefined | null>
	getUserByAccessToken: ({
		accessToken,
	}: {
		accessToken: string
	}) => Promise<TUser | undefined | null>
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

interface IUserRepository {
	findUserByEmail: ({ email }: { email: string }) => Promise<TUser | undefined>
	findUserById: ({ id }: { id: string }) => Promise<TUser | undefined>
	createUser: ({ userData }: { userData: TInsertUser }) => Promise<TUser>
	updateLastLogin: ({ id }: { id: string }) => Promise<TUser | undefined>
	updateUser: (
		id: string,
		userData: Partial<TInsertUser>,
	) => Promise<TUser | undefined>
}

// Define types using Zod schemas
type TInsertUser = z.infer<typeof insertUserSchema>
type TUser = z.infer<typeof selectUserSchema>
type TUserResponse = z.infer<typeof userResponseSchema>
type TMessageBase = z.infer<typeof messageBaseSchema>

export type {
	IUserController,
	IUserRepository,
	IUserService,
	TInsertUser,
	TMessageBase,
	TUser,
	TUserResponse,
}
