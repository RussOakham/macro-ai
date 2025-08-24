import { Router } from 'express'

import { authRouter } from '../features/auth/auth.routes.ts'
import { chatRouter } from '../features/chat/chat.routes.ts'
import { userRouter } from '../features/user/user.routes.ts'
import { utilityRouter } from '../features/utility/utility.routes.ts'

// Configuration type for route setup
interface RouteConfig {
	nodeEnv: string
	appEnv: string
	port: number
	cookieDomain: string
	awsCognitoRefreshTokenExpiry: number
}

const router = Router()

const appRouter = (config: RouteConfig): Router => {
	authRouter(router, config)
	chatRouter(router)
	utilityRouter(router)
	userRouter(router)

	return router
}

export { appRouter }
