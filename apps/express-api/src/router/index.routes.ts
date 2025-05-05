import { Router } from 'express'

import { authRouter } from '../features/auth/auth.routes.ts'
import { userRouter } from '../features/user/user.routes.ts'
import { utilityRouter } from '../features/utility/utility.routes.ts'

const router = Router()

const appRouter = (): Router => {
	authRouter(router)
	utilityRouter(router)
	userRouter(router)

	return router
}

export { appRouter }
