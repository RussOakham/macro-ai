import express from 'express'
import { z } from 'zod'

import {
	insertUserSchema,
	messageBaseSchema,
	selectUserSchema,
	userResponseSchema,
} from './user.schemas.ts'

interface IUserController {
	getUserById: express.Handler
	getCurrentUser: express.Handler
}

// Define types using Zod schemas
type TInsertUser = z.infer<typeof insertUserSchema>
type TUser = z.infer<typeof selectUserSchema>
type TUserResponse = z.infer<typeof userResponseSchema>
type TMessageBase = z.infer<typeof messageBaseSchema>

export type { IUserController, TInsertUser, TMessageBase, TUser, TUserResponse }
