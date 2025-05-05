import express from 'express'

interface IUserController {
	getUserById: express.Handler
	getCurrentUser: express.Handler
}

export type { IUserController }
