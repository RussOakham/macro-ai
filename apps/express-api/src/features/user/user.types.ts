import express from 'express'
import { z } from 'zod'

import { insertUserSchema, selectUserSchema } from './user.schema.ts'

interface IUserController {
	getUserById: express.Handler
	getCurrentUser: express.Handler
}

// Define types using Zod schemas
type InsertUser = z.infer<typeof insertUserSchema>
type User = z.infer<typeof selectUserSchema>

export type { InsertUser, IUserController, User }
