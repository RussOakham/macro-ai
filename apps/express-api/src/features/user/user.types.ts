import express from 'express'

interface IUserController {
	getUserById: express.Handler
}

export type { IUserController }
