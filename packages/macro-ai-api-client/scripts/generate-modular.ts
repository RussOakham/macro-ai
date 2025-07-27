import SwaggerParser from '@apidevtools/swagger-parser'
import fs from 'fs/promises'
import { generateZodClientFromOpenAPI } from 'openapi-zod-client'
import type { OpenAPIObject } from 'openapi3-ts'
import path from 'path'
import { resolveConfig } from 'prettier'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const EXPRESS_API_PATH = path.resolve(__dirname, '../../../apps/express-api')
const SWAGGER_PATH = path.resolve(EXPRESS_API_PATH, 'public/swagger.json')
const OUTPUT_DIR = path.resolve(__dirname, '../src')
const LEGACY_OUTPUT_PATH = path.resolve(__dirname, '../src/output.ts')

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

		// Generate legacy output.ts for backward compatibility
		console.log('Generating legacy output.ts for backward compatibility...')
		await generateZodClientFromOpenAPI({
			openApiDoc,
			distPath: LEGACY_OUTPUT_PATH,
			prettierConfig,
		})

		// Read the generated output.ts and split it into domains
		console.log('Splitting generated client into domain-specific files...')
		const outputContent = await fs.readFile(LEGACY_OUTPUT_PATH, 'utf-8')

		await splitIntoModularFiles(outputContent, OUTPUT_DIR)

		console.log('✅ Modular API client generation complete!')
		console.log('📁 Generated files:')
		console.log('  - schemas/auth.schemas.ts')
		console.log('  - schemas/chat.schemas.ts')
		console.log('  - schemas/user.schemas.ts')
		console.log('  - schemas/shared.schemas.ts')
		console.log('  - clients/auth.client.ts')
		console.log('  - clients/chat.client.ts')
		console.log('  - clients/user.client.ts')
		console.log('  - clients/unified.client.ts')
		console.log('  - output.ts (legacy, for backward compatibility)')
	} catch (error) {
		console.error('Error generating modular API client:', error)
		process.exit(1)
	}
}

async function splitIntoModularFiles(outputContent: string, outputDir: string) {
	const lines = outputContent.split('\n')

	// Parse schemas and endpoints from the generated content
	const authSchemas: string[] = []
	const chatSchemas: string[] = []
	const userSchemas: string[] = []
	const authEndpoints: string[] = []
	const chatEndpoints: string[] = []
	const userEndpoints: string[] = []

	let inEndpoints = false
	let currentEndpoint: string[] = []
	let braceCount = 0

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
			while (
				j < lines.length &&
				lines[j] &&
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				!lines[j]!.includes('const ') &&
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				!lines[j]!.includes('export const schemas')
			) {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				schemaLines.push(lines[j]!)
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
			}
			continue
		}

		// Detect endpoints section
		if (line.includes('const endpoints = makeApi([')) {
			inEndpoints = true
			continue
		}

		if (inEndpoints) {
			// Check if this line starts a new endpoint object
			if (line.trim() === '{' && braceCount === 0) {
				currentEndpoint = [line]
				braceCount = 1
			} else if (braceCount > 0) {
				currentEndpoint.push(line)

				// Count braces to track nesting
				const openBraces = (line.match(/{/g) ?? []).length
				const closeBraces = (line.match(/}/g) ?? []).length
				braceCount += openBraces - closeBraces

				// When we close the main endpoint object
				if (braceCount === 0 && currentEndpoint.length > 0) {
					// Determine domain based on path
					const pathLine = currentEndpoint.find((l) => l.includes('path:'))
					if (pathLine) {
						const path = pathLine.split("'")[1] ?? pathLine.split('"')[1]
						if (path?.startsWith('/auth')) {
							authEndpoints.push(...currentEndpoint)
						} else if (path?.startsWith('/chats')) {
							chatEndpoints.push(...currentEndpoint)
						} else if (path?.startsWith('/users')) {
							userEndpoints.push(...currentEndpoint)
						}
					}
					currentEndpoint = []
				}
			} else if (line.includes('])')) {
				inEndpoints = false
			}
		}
	}

	// Log endpoint and schema counts for debugging
	console.log(`Auth schemas found: ${authSchemas.length.toString()}`)
	console.log(`Chat schemas found: ${chatSchemas.length.toString()}`)
	console.log(`User schemas found: ${userSchemas.length.toString()}`)
	console.log(`Auth endpoints found: ${authEndpoints.length.toString()}`)
	console.log(`Chat endpoints found: ${chatEndpoints.length.toString()}`)
	console.log(`User endpoints found: ${userEndpoints.length.toString()}`)

	// Generate domain-specific schema files
	await generateDomainSchemaFile('auth', authSchemas, outputDir)
	await generateDomainSchemaFile('chat', chatSchemas, outputDir)
	await generateDomainSchemaFile('user', userSchemas, outputDir)

	// Generate domain-specific client files
	await generateDomainClientFile('auth', authEndpoints, outputDir)
	await generateDomainClientFile('chat', chatEndpoints, outputDir)
	await generateDomainClientFile('user', userEndpoints, outputDir)

	// Generate shared schemas
	await generateSharedSchemas(outputDir)

	// Generate index files
	await generateIndexFiles(outputDir)

	// Generate unified client
	await generateUnifiedClient(outputDir)
}

async function generateDomainSchemaFile(
	domain: string,
	schemas: string[],
	outputDir: string,
) {
	if (schemas.length === 0) {
		// Generate empty schema file with placeholder
		const imports = "import { z } from 'zod'\n\n"
		const exports = `export const ${domain}Schemas = {\n\t// Schemas will be exported individually\n}\n`
		const content = imports + exports
		const filePath = path.join(outputDir, 'schemas', `${domain}.schemas.ts`)
		await fs.writeFile(filePath, content)
		return
	}

	const imports = "import { z } from 'zod'\n\n"
	const schemaContent = schemas.join('\n') + '\n'

	// Extract schema names for exports
	const schemaNames: string[] = []
	schemas.forEach((schemaLine) => {
		const line = schemaLine
		if (line.includes('const ') && line.includes('_Body = z')) {
			const schemaName = line.split('const ')[1]?.split(' =')[0]
			if (schemaName) {
				schemaNames.push(schemaName)
			}
		}
	})

	// Generate exports
	const schemaExports =
		schemaNames.length > 0
			? `\n// Individual exports for direct access\nexport {\n\t${schemaNames.join(',\n\t')},\n}\n`
			: `\nexport const ${domain}Schemas = {\n\t// Schemas will be exported individually\n}\n`

	const content = imports + schemaContent + schemaExports
	const filePath = path.join(outputDir, 'schemas', `${domain}.schemas.ts`)
	await fs.writeFile(filePath, content)
}

async function generateDomainClientFile(
	domain: string,
	endpoints: string[],
	outputDir: string,
) {
	const filePath = path.join(outputDir, 'clients', `${domain}.client.ts`)

	// Check if file exists and has manual implementation
	try {
		const existingContent = await fs.readFile(filePath, 'utf-8')

		// Check for manual implementation markers
		if (
			existingContent.includes('// MANUAL IMPLEMENTATION') ||
			existingContent.includes('extracted from output.ts') ||
			(existingContent.includes('makeApi([') &&
				!existingContent.includes('makeApi([\n\n])'))
		) {
			console.log(
				`⚠️  Skipping ${domain}.client.ts - manual implementation detected`,
			)
			return
		}
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
	} catch (error: unknown) {
		// File doesn't exist, proceed with generation
		console.log(`Generating ${domain}.client.ts...`)
	}

	const imports = `import { makeApi, Zodios, type ZodiosOptions } from '@zodios/core'
import { z } from 'zod'
import {
	postAuthconfirmForgotPassword_Body,
	postAuthconfirmRegistration_Body,
	postAuthforgotPassword_Body,
	postAuthlogin_Body,
	postAuthlogout_Body,
	postAuthregister_Body,
	postAuthresendConfirmationCode_Body,
	postChats_Body,
	postChatsId_Body,
	postChatsIdstream_Body,
} from '../output'

`
	const endpointsContent = `const ${domain}Endpoints = makeApi([\n${endpoints.join('\n')}\n])\n\n`
	const exports = `export const ${domain}Client = new Zodios(${domain}Endpoints)\n\nexport function create${domain.charAt(0).toUpperCase() + domain.slice(1)}Client(baseUrl: string, options?: ZodiosOptions) {\n  return new Zodios(baseUrl, ${domain}Endpoints, options)\n}\n\nexport { ${domain}Endpoints }\n`

	const content = imports + endpointsContent + exports
	await fs.writeFile(filePath, content)
}

async function generateSharedSchemas(outputDir: string) {
	const content = `// Shared schemas - auto-generated, do not edit manually
import { z } from 'zod'

// Common response schemas that are used across domains
export const sharedSchemas = {
  // Will be populated with common schemas like ErrorResponse, etc.
}
`
	const filePath = path.join(outputDir, 'schemas', 'shared.schemas.ts')
	await fs.writeFile(filePath, content)
}

async function generateIndexFiles(outputDir: string) {
	// Schemas index
	const schemasIndex = `// Schema re-exports for modular API client
// This file is auto-generated - do not edit manually

export * from './auth.schemas'
export * from './chat.schemas'
export * from './user.schemas'
export * from './shared.schemas'
`
	await fs.writeFile(path.join(outputDir, 'schemas', 'index.ts'), schemasIndex)

	// Clients index
	const clientsIndex = `// Client re-exports for modular API client
// This file is auto-generated - do not edit manually

export * from './auth.client'
export * from './chat.client'
export * from './user.client'
export * from './unified.client'
`
	await fs.writeFile(path.join(outputDir, 'clients', 'index.ts'), clientsIndex)
}

async function generateUnifiedClient(outputDir: string) {
	const content = `// Unified client - auto-generated, do not edit manually
import { makeApi, Zodios, type ZodiosOptions } from '@zodios/core'
import { authEndpoints } from './auth.client'
import { chatEndpoints } from './chat.client'
import { userEndpoints } from './user.client'

// Combines all domain endpoints into a single client for backward compatibility
export const endpoints = makeApi([
  ...authEndpoints,
  ...chatEndpoints,
  ...userEndpoints,
])

export const api = new Zodios(endpoints)

export function createApiClient(baseUrl: string, options?: ZodiosOptions) {
  return new Zodios(baseUrl, endpoints, options)
}
`
	await fs.writeFile(
		path.join(outputDir, 'clients', 'unified.client.ts'),
		content,
	)
}

await main()
