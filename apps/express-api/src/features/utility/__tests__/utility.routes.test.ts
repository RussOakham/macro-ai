import express, {
	type NextFunction,
	type Request,
	type Response,
	Router,
} from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'

import { utilityRouter } from '../utility.routes.ts'

describe('utilityRouter', () => {
	let app: express.Express

	beforeEach(() => {
		app = express()
		// oxlint-disable-next-line new-cap
		const router = Router()
		utilityRouter(router)
		app.use(router)
		// Add error handler middleware for consistent error responses
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
			res.status(500).json({ message: 'Api Status: Error' })
		})
	})

	it('GET /health should return 200 and health message', async () => {
		const res = await request(app).get('/health')
		expect(res.status).toBe(200)
		expect(res.body).toEqual({ message: 'Api Health Status: OK' })
	})

	it('GET /system-info should return 200 and system information', async () => {
		const res = await request(app).get('/system-info')
		expect(res.status).toBe(200)
		expect(res.body).toHaveProperty('nodeVersion')
		expect(res.body).toHaveProperty('platform')
		expect(res.body).toHaveProperty('architecture')
		expect(res.body).toHaveProperty('uptime')
		expect(res.body).toHaveProperty('memoryUsage')
		expect(res.body).toHaveProperty('cpuUsage')
		expect(res.body).toHaveProperty('timestamp')
	})

	it('should handle errors and return 500', async () => {
		// Override the /health route to simulate an error
		// oxlint-disable-next-line new-cap
		const router = Router()
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		router.get('/health', (_req: Request, _res: Response) => {
			throw new Error('Simulated error')
		})
		app = express()
		app.use(router)
		// Add error handler middleware again for this app instance
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
			res.status(500).json({ message: 'Api Status: Error' })
		})

		const res = await request(app).get('/health')
		expect(res.status).toBe(500)
		expect(res.body).toEqual({ message: 'Api Status: Error' })
	})
})
