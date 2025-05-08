import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi'
import fs from 'fs/promises'
import path from 'path'

// Import all route files to ensure they register with the OpenAPI registry
import '../../features/auth/auth.routes.ts'
import '../../features/user/user.routes.ts'
import '../../features/utility/utility.routes.ts'

import { standardizeError } from '../errors.ts'
import { pino } from '../logger.ts'

import { registry } from './openapi-registry.ts'

const { logger } = pino

const generateSwaggerSpec = async () => {
	try {
		const outputDir = path.resolve(process.cwd(), 'public')

		// Generate OpenAPI document from registry
		const generator = new OpenApiGeneratorV3(registry.definitions)
		const openApiDocument = generator.generateDocument({
			openapi: '3.0.0',
			info: {
				title: 'Macro AI Express API',
				version: '0.0.1',
				description: 'API documentation for Macro AI',
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
		logger.error('Failed to generate swagger spec:', err.message)
		process.exit(1)
	}
}

// Run if called directly
if (import.meta.url === import.meta.resolve('./generate-swagger.ts')) {
	void generateSwaggerSpec()
}

export { generateSwaggerSpec }
