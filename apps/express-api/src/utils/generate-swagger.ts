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
			schemas: {
				GetUserResponse: {
					type: 'object',
					required: ['id', 'email', 'emailVerified'],
					properties: {
						id: {
							type: 'string',
							description: 'User ID',
							example: 'user123',
						},
						email: {
							type: 'string',
							description: 'User email',
							example: 'user@example.com',
						},
						emailVerified: {
							type: 'boolean',
							description: "Whether the user's email is verified",
							example: true,
						},
					},
				},
				HealthResponse: {
					type: 'object',
					properties: {
						message: {
							type: 'string',
							example: 'Api Health Status: OK',
						},
					},
				},
			},
			responses: {
				BadRequest: {
					description:
						'Bad Request - The request was malformed or contains invalid parameters',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									message: {
										type: 'string',
										example: 'Validation Failed',
									},
									details: {
										type: 'object',
										example: { field: 'Error details' },
									},
								},
							},
						},
					},
				},
				Unauthorized: {
					description:
						'Unauthorized - Authentication is required or has failed',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									message: {
										type: 'string',
										example: 'Invalid credentials',
									},
								},
							},
						},
					},
				},
				Forbidden: {
					description:
						'Forbidden - The user does not have permission to access the resource',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									message: {
										type: 'string',
										example: 'Access denied',
									},
								},
							},
						},
					},
				},
				NotFound: {
					description: 'Not Found - The requested resource was not found',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									message: {
										type: 'string',
										example: 'Resource not found',
									},
								},
							},
						},
					},
				},
				ServerError: {
					description:
						'Server Error - An unexpected error occurred on the server',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									message: {
										type: 'string',
										example: 'Internal server error',
									},
									details: {
										type: 'object',
										example: { error: 'Error details' },
									},
								},
							},
						},
					},
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
