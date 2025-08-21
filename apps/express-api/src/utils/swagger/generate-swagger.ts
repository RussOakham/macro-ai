import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi'
import fs from 'fs/promises'
import path from 'path'

// Import all route files to ensure they register with the OpenAPI registry
import '../../features/auth/auth.routes.ts'
import '../../features/chat/chat.routes.ts'
import '../../features/user/user.routes.ts'
import '../../features/utility/utility.routes.ts'

import { assertConfig } from '../../../config/default.ts'
import { standardizeError } from '../errors.ts'
import { pino } from '../logger.ts'

import { registry } from './openapi-registry.ts'

const { logger } = pino

const generateSwaggerSpec = async () => {
	try {
		const config = assertConfig()
		const outputDir = path.resolve(process.cwd(), 'public')

		// Generate OpenAPI document from registry
		const generator = new OpenApiGeneratorV3(registry.definitions)

		// Generate server URL from configuration
		const getServerConfig = () => {
			switch (config.appEnv) {
				case 'production':
					return {
						protocol: 'https',
						host: 'api.macro-ai.com',
						description: 'Production server',
					}
				case 'staging':
					return {
						protocol: 'https',
						host: 'api-staging.macro-ai.com',
						description: 'Staging server',
					}
				default: // development, test
					return {
						protocol: 'http',
						host: `localhost:${config.port.toString()}`,
						description: 'Development server',
					}
			}
		}

		const serverConfig = getServerConfig()
		const serverUrl = `${serverConfig.protocol}://${serverConfig.host}/api`

		const openApiDocument = generator.generateDocument({
			openapi: '3.0.0',
			info: {
				title: 'Macro AI Express API',
				version: '0.0.1',
				description: `API documentation for Macro AI
				
## Rate Limiting
This API implements rate limiting to protect against abuse:

- **Global Rate Limit**: 100 requests per 15 minutes for all endpoints
- **Authentication Rate Limit**: 10 requests per hour for authentication endpoints
- **API Rate Limit**: 60 requests per minute for API endpoints

Rate limit headers are included in responses to help track usage.`,
				license: {
					name: 'MIT',
					url: 'https://spdx.org/licenses/MIT.html',
				},
			},
			servers: [
				{
					url: serverUrl,
					description: serverConfig.description,
				},
			],
		})

		// Ensure directory exists
		await fs.mkdir(outputDir, { recursive: true })

		// Write swagger spec to file
		await fs.writeFile(
			path.join(outputDir, 'swagger.json'),
			JSON.stringify(openApiDocument, null, 2),
		)

		logger.info('Swagger spec generated successfully at public/swagger.json')
	} catch (error: unknown) {
		const err = standardizeError(error)
		logger.error({ error: err }, 'Failed to generate swagger spec')
		process.exit(1)
	}
}

// Run if called directly
if (import.meta.url === import.meta.resolve('./generate-swagger.ts')) {
	void generateSwaggerSpec()
}

export { generateSwaggerSpec }
