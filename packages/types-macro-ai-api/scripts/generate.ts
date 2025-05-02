import SwaggerParser from '@apidevtools/swagger-parser'
import { generateZodClientFromOpenAPI } from 'openapi-zod-client'
import type { OpenAPIObject } from 'openapi3-ts'
import path from 'path'
import { resolveConfig } from 'prettier'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const EXPRESS_API_PATH = path.resolve(__dirname, '../../../apps/express-api')
const SWAGGER_PATH = path.resolve(EXPRESS_API_PATH, 'public/swagger.json')
const OUTPUT_PATH = path.resolve(__dirname, '../src/output.ts')

const main = async () => {
	try {
		await SwaggerParser.validate(SWAGGER_PATH)
	} catch (error) {
		console.error('Invalid Swagger file:', error)
		process.exit(1)
	}

	try {
		console.log(`Generating types from ${SWAGGER_PATH} to ${OUTPUT_PATH}`)
		const openApiDoc = (await SwaggerParser.parse(
			SWAGGER_PATH,
		)) as OpenAPIObject
		const prettierConfig = await resolveConfig('./')
		await generateZodClientFromOpenAPI({
			openApiDoc,
			distPath: OUTPUT_PATH,
			prettierConfig,
		})
		console.log('Generated api client')
	} catch (error) {
		console.error('Error generating types:', error)
		process.exit(1)
	}
}

await main()
