import SwaggerParser from '@apidevtools/swagger-parser'
import fs from 'fs/promises'
import { generateZodClientFromOpenAPI } from 'openapi-zod-client'
import type { OpenAPIObject } from 'openapi3-ts'
import path from 'path'
import { type Options, resolveConfig } from 'prettier'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const EXPRESS_API_PATH = path.resolve(__dirname, '../../../apps/express-api')
const SWAGGER_PATH = path.resolve(EXPRESS_API_PATH, 'public/swagger.json')
const OUTPUT_DIR = path.resolve(__dirname, '../src')

const main = async () => {
	try {
		await SwaggerParser.validate(SWAGGER_PATH)
	} catch (error) {
		console.error('Invalid Swagger file:', error)
		process.exit(1)
	}

	try {
		console.log(`Generating modular API client from ${SWAGGER_PATH}`)

		const openApiDoc = (await SwaggerParser.parse(
			SWAGGER_PATH,
		)) as OpenAPIObject
		const prettierConfig = await resolveConfig('./')

		// Ensure directories exist
		await fs.mkdir(path.join(OUTPUT_DIR, 'schemas'), { recursive: true })
		await fs.mkdir(path.join(OUTPUT_DIR, 'clients'), { recursive: true })

		// Generate schemas from OpenAPI spec (always regenerate schemas)
		console.log('Generating schemas from OpenAPI spec...')
		await generateSchemasFromSpec(openApiDoc, OUTPUT_DIR, prettierConfig)

		console.log('✅ Modular API client generation complete!')
		console.log('📁 Generated/verified files:')
		console.log('  - schemas/auth.schemas.ts (regenerated)')
		console.log('  - schemas/chat.schemas.ts (regenerated)')
		console.log('  - schemas/user.schemas.ts (regenerated)')
		console.log('  - schemas/shared.schemas.ts (regenerated)')
		console.log('  - clients/auth.client.ts (manual - preserved)')
		console.log('  - clients/chat.client.ts (manual - preserved)')
		console.log('  - clients/user.client.ts (manual - preserved)')
		console.log('  - clients/unified.client.ts (manual - preserved)')
		console.log('')
		console.log('ℹ️  Schemas are regenerated from OpenAPI spec.')
		console.log('   Client files are manually maintained for better control.')
	} catch (error) {
		console.error('Error generating modular API client:', error)
		process.exit(1)
	}
}

async function generateSchemasFromSpec(
	openApiDoc: OpenAPIObject,
	outputDir: string,
	prettierConfig: Options | null,
) {
	// Generate a temporary output file to extract schemas
	const tempOutputPath = path.join(outputDir, 'temp-output.ts')

	await generateZodClientFromOpenAPI({
		openApiDoc,
		distPath: tempOutputPath,
		prettierConfig,
	})

	// Read the generated content and extract schemas
	const outputContent = await fs.readFile(tempOutputPath, 'utf-8')

	// Extract and organize schemas by domain
	await extractAndOrganizeSchemas(outputContent, outputDir)

	// Clean up temporary file
	await fs.unlink(tempOutputPath)
}

async function extractAndOrganizeSchemas(
	outputContent: string,
	outputDir: string,
) {
	const lines = outputContent.split('\n')

	const authSchemas: string[] = []
	const chatSchemas: string[] = []
	const userSchemas: string[] = []
	const sharedSchemas: string[] = []

	// Extract schema definitions
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		if (!line) continue

		// Detect schema definitions
		if (line.includes('const ') && line.includes('_Body = z')) {
			const schemaName = line.split('const ')[1]?.split(' =')[0]
			if (!schemaName) continue

			// Collect schema definition
			const schemaLines = [line]
			let j = i + 1
			while (j < lines.length) {
				const currentLine = lines[j]
				if (
					!currentLine ||
					currentLine.includes('const ') ||
					currentLine.includes('export const schemas')
				) {
					break
				}
				schemaLines.push(currentLine)
				j++
			}
			i = j - 1

			// Determine domain based on schema name
			if (schemaName.includes('Auth')) {
				authSchemas.push(...schemaLines)
			} else if (schemaName.includes('Chats')) {
				chatSchemas.push(...schemaLines)
			} else if (schemaName.includes('Users')) {
				userSchemas.push(...schemaLines)
			} else {
				sharedSchemas.push(...schemaLines)
			}
		}
	}

	// Generate domain-specific schema files
	await generateSchemaFile('auth', authSchemas, outputDir)
	await generateSchemaFile('chat', chatSchemas, outputDir)
	await generateSchemaFile('user', userSchemas, outputDir)
	await generateSchemaFile('shared', sharedSchemas, outputDir)
}

async function generateSchemaFile(
	domain: string,
	schemas: string[],
	outputDir: string,
) {
	const imports = "import { z } from 'zod'\n\n"

	let content = imports

	if (schemas.length > 0) {
		content += schemas.join('\n') + '\n\n'

		// Extract schema names for exports
		const schemaNames: string[] = []
		schemas.forEach((schemaLine) => {
			if (schemaLine.includes('const ') && schemaLine.includes('_Body = z')) {
				const schemaName = schemaLine.split('const ')[1]?.split(' =')[0]
				if (schemaName) {
					schemaNames.push(schemaName)
				}
			}
		})

		// Generate exports
		if (schemaNames.length > 0) {
			content += `// Individual exports for direct access\nexport {\n\t${schemaNames.join(',\n\t')},\n}\n`
		}
	} else {
		// Generate placeholder for empty domains
		content += `// ${domain.charAt(0).toUpperCase() + domain.slice(1)} schemas will be added here when available\n`
		content += `export const ${domain}Schemas = {\n\t// Schemas will be exported individually\n}\n`
	}

	const filePath = path.join(outputDir, 'schemas', `${domain}.schemas.ts`)
	await fs.writeFile(filePath, content)
}

await main()

await main()
