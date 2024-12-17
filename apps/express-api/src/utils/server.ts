import express, { Express } from 'express'
import compression from 'compression'
import cors from 'cors'
import bodyParser from 'body-parser'
import swaggerJSDoc, { type Options } from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'

import { pino } from './logger.ts'
import { appRouter } from '../router/index.routes.ts'

const options: Options = {
	definition: {
		openapi: '3.1.0',
		info: {
			title: 'Macro AI Express API with Swagger',
			version: '0.0.0',
			description:
				'This is a simple CRUD API application made with Express and documented with Swagger',
			license: {
				name: 'MIT',
				url: 'https://spdx.org/licenses/MIT.html',
			},
		},
		servers: [
			{
				url: 'http://localhost:3030/api',
			},
		],
	},
	apis: ['./src/router/*.routes.ts'],
	components: {
		schemas: {
			HealthResponse: {
				type: 'object',
			},
		},
	},
}

const specs = swaggerJSDoc(options)

const createServer = (): Express => {
	const app: Express = express()

	app.use(pino)
	app.use(
		cors({
			credentials: true,
		}),
	)
	app.use(compression())
	app.use(bodyParser.json())
	app.use(express.urlencoded({ extended: true }))

	app.use('/api', appRouter())
	app.use(
		'/api-docs',
		swaggerUi.serve,
		swaggerUi.setup(specs, { explorer: true }),
	)
	return app
}

export { createServer }
