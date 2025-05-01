import fs from 'fs/promises'
import path from 'path'
import swaggerJSDoc, { Options } from 'swagger-jsdoc'

import { standardizeError } from './errors.ts'
import { pino } from './logger.ts'

const { logger } = pino

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
		components: {
			securitySchemes: {
				cookieAuth: {
					type: 'apiKey',
					in: 'cookie',
					name: 'macro-ai-accessToken',
				},
				apiKeyAuth: {
					type: 'apiKey',
					in: 'header',
					name: 'X-API-KEY',
				},
			},
		},
		security: [
			{
				cookieAuth: [],
				apiKeyAuth: [],
			},
		],
	},
	apis: ['./src/features/**/*.ts'],
}

const generateSwaggerSpec = async () => {
	try {
		const swaggerSpec = swaggerJSDoc(options)
		const outputDir = path.resolve(process.cwd(), 'public')

		// Ensure directory exists
		await fs.mkdir(outputDir, { recursive: true })

		// Write swagger spec to file
		await fs.writeFile(
			path.join(outputDir, 'swagger.json'),
			JSON.stringify(swaggerSpec, null, 2),
		)

		logger.info('Swagger spec generated successfully at public/swagger.json')
	} catch (error: unknown) {
		const err = standardizeError(error)
		logger.error('Failed to generate swagger spec:', err.message)
		process.exit(1)
	}
}

// Run if called directly
if (import.meta.url === import.meta.resolve('./generate-swagger.ts')) {
	void generateSwaggerSpec()
}

export { generateSwaggerSpec }
