import fs from 'fs/promises'
import path from 'path'
import swaggerJSDoc from 'swagger-jsdoc'

import { swaggerOptions } from './swagger/index.ts'
import { standardizeError } from './errors.ts'
import { pino } from './logger.ts'

const { logger } = pino

const generateSwaggerSpec = async () => {
	try {
		const swaggerSpec = swaggerJSDoc(swaggerOptions)
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
