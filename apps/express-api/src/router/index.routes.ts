import { Router } from 'express'
import { utilityRouter } from '../features/utility/utility.routes.ts'

const router = Router()

const appRouter = (): Router => {
	utilityRouter(router)

	return router
}

export { appRouter }
