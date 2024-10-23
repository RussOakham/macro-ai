import { type Router } from 'express'

const utilityRouter = (router: Router) => {
	router.get('/health', (req, res) => {
		res.send('OK')
	})
}

export { utilityRouter }
