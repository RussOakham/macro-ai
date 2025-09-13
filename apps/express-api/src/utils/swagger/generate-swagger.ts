import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// oxlint-disable no-unassigned-import
import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi'

import { standardizeError } from '../errors.ts'
import { config } from '../load-config.ts'
import { pino } from '../logger.ts'
import { registry } from './openapi-registry.ts'

const { logger } = pino

// Import all route files to ensure they register with the OpenAPI registry
import '../../features/auth/auth.routes.ts'
import '../../features/chat/chat.routes.ts'
import '../../features/user/user.routes.ts'
import '../../features/utility/utility.routes.ts'

const generateSwaggerSpec = () => {
	try {
		const outputDir = resolve(process.cwd(), 'public')

		// Generate OpenAPI document from registry
		const generator = new OpenApiGeneratorV3(registry.definitions)
		const openApiDocument = generator.generateDocument({
			openapi: '3.0.0',
			info: {
				title: 'Macro AI API',
				version: '1.0.0',
				description: 'API for Macro AI application',
			},
			servers: [
				{
					url: `http://localhost:${config.SERVER_PORT.toString()}`,
					description: 'Development server',
				},
			],
		})

		// Write swagger spec to file
		writeFileSync(
			resolve(outputDir, 'swagger.json'),
			JSON.stringify(openApiDocument, null, 2),
		)

		logger.info('[swagger]: Swagger specification generated successfully')
	} catch (error) {
		const standardizedError = standardizeError(error)
		logger.error(
			`[swagger]: Failed to generate swagger specification: ${standardizedError.message}`,
		)
		throw standardizedError
	}
}

export { generateSwaggerSpec }
