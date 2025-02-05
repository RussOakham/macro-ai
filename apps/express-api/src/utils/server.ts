import bodyParser from 'body-parser'
import compression from 'compression'
import cors from 'cors'
import express, { Express } from 'express'
import swaggerJSDoc, { type Options } from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'

import { appRouter } from '../router/index.routes.ts'

import { pino } from './logger.ts'

const options: Options = {
	definition: {
		openapi: '3.1.0',
		info: {
			title: 'Macro AI Express API with Swagger',
			version: '0.0.1',
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
	apis: ['./src/features/**/*.ts'],
}

const swaggerSpec = swaggerJSDoc(options)

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
		swaggerUi.setup(swaggerSpec, {
			explorer: true,
			swaggerOptions: {
				url: '/swagger.json',
			},
		}),
	)
	return app
}

export { createServer }
