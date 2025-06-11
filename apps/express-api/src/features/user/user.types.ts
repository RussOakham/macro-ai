import express from 'express'
import { z } from 'zod'

import { EnhancedResult } from '../../utils/error-handling/try-catch.ts'

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
	}) => Promise<EnhancedResult<TUser>>
	getUserByEmail: ({
		email,
	}: {
		email: string
	}) => Promise<EnhancedResult<TUser>>
	getUserByAccessToken: ({
		accessToken,
	}: {
		accessToken: string
	}) => Promise<EnhancedResult<TUser>>
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
	}) => Promise<EnhancedResult<TUser>>
}

interface IUserRepository {
	findUserByEmail: ({
		email,
	}: {
		email: string
	}) => Promise<EnhancedResult<TUser | undefined>>
	findUserById: ({
		id,
	}: {
		id: string
	}) => Promise<EnhancedResult<TUser | undefined>>
	createUser: ({
		userData,
	}: {
		userData: TInsertUser
	}) => Promise<EnhancedResult<TUser>>
	updateLastLogin: ({
		id,
	}: {
		id: string
	}) => Promise<EnhancedResult<TUser | undefined>>
	updateUser: (
		id: string,
		userData: Partial<TInsertUser>,
	) => Promise<EnhancedResult<TUser | undefined>>
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
