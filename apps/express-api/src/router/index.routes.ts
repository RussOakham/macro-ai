import { Router } from 'express'
import { utilityRouter } from './utility.routes.ts'

const router = Router()

const appRouter = (): Router => {
	utilityRouter(router)

	return router
}

export { appRouter }
