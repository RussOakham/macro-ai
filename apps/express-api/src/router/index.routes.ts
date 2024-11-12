import { Router } from 'express'
import { authRouter } from '../features/auth/auth.routes.ts'
import { utilityRouter } from '../features/utility/utility.routes.ts'

const router = Router()

const appRouter = (): Router => {
	authRouter(router)
	utilityRouter(router)

	return router
}

export { appRouter }
