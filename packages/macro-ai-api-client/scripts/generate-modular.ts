import SwaggerParser from '@apidevtools/swagger-parser'
import fs from 'fs/promises'
import type { OpenAPIObject } from 'openapi3-ts'
import path from 'path'
import { type Options, resolveConfig } from 'prettier'
import { fileURLToPath } from 'url'

import { parseEndpointsByDomain } from './utils/domain-parser.js'
import { generateDomainClient } from './utils/file-generator.js'

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
		await fs.mkdir(path.join(OUTPUT_DIR, 'types'), { recursive: true })

		// Generate domain-specific clients, schemas, and types from OpenAPI spec
		console.log(
			'Generating domain-specific clients, schemas, and types from OpenAPI spec...',
		)
		await generateDomainClients(openApiDoc, OUTPUT_DIR, prettierConfig)

		// Generate unified client
		console.log('Generating unified client...')
		await generateUnifiedClient(OUTPUT_DIR)

		// Generate unified types index
		console.log('Generating unified types index...')
		await generateUnifiedTypesIndex(OUTPUT_DIR)

		console.log('✅ Modular API client generation complete!')
		console.log('📁 Generated files:')
		console.log('  - schemas/auth.schemas.ts (auto-generated)')
		console.log('  - schemas/chat.schemas.ts (auto-generated)')
		console.log('  - schemas/user.schemas.ts (auto-generated)')
		console.log('  - schemas/shared.schemas.ts (auto-generated)')
		console.log('  - clients/auth.client.ts (auto-generated)')
		console.log('  - clients/chat.client.ts (auto-generated)')
		console.log('  - clients/user.client.ts (auto-generated)')
		console.log('  - clients/unified.client.ts (auto-generated)')
		console.log('  - types/auth.types.ts (auto-generated)')
		console.log('  - types/chat.types.ts (auto-generated)')
		console.log('  - types/user.types.ts (auto-generated)')
		console.log('  - types/index.ts (auto-generated)')
		console.log('')
		console.log('ℹ️  All files are auto-generated from OpenAPI spec.')
		console.log('   No manual maintenance required!')
	} catch (error) {
		console.error('Error generating modular API client:', error)
		process.exit(1)
	}
}

async function generateDomainClients(
	openApiDoc: OpenAPIObject,
	outputDir: string,
	prettierConfig: Options | null,
) {
	// Parse endpoints by domain
	const domainGroups = parseEndpointsByDomain(openApiDoc)

	// Generate client for each domain
	const domains = ['auth', 'chat', 'user'] as const
	for (const domain of domains) {
		const endpoints = domainGroups[domain]
		if (endpoints.length > 0) {
			// Skip chat domain - using custom schema-based approach
			if (domain === 'chat') {
				console.log(
					`Skipping ${domain} domain - using custom schema-based approach`,
				)
				continue
			}
			await generateDomainClient(
				domain,
				endpoints,
				openApiDoc,
				outputDir,
				prettierConfig,
			)
		}
	}

	// Generate empty shared schemas file for consistency
	const sharedSchemasContent = `// import { z } from 'zod'

// Shared schemas will be added here when available
export const sharedSchemas = {
	// Schemas will be exported individually
}
`
	const sharedSchemasPath = path.join(outputDir, 'schemas', 'shared.schemas.ts')
	await fs.writeFile(sharedSchemasPath, sharedSchemasContent)

	// Generate empty user schemas file if no schemas were generated
	const userSchemasPath = path.join(outputDir, 'schemas', 'user.schemas.ts')
	try {
		const userSchemasContent = await fs.readFile(userSchemasPath, 'utf-8')
		if (userSchemasContent.trim().length <= 20) {
			// Just imports
			const emptyUserSchemasContent = `// import { z } from 'zod'

// User schemas will be added here when available
export const userSchemas = {
	// Schemas will be exported individually
}
`
			await fs.writeFile(userSchemasPath, emptyUserSchemasContent)
		}
	} catch {
		// File doesn't exist, create it
		const emptyUserSchemasContent = `// import { z } from 'zod'

// User schemas will be added here when available
export const userSchemas = {
	// Schemas will be exported individually
}
`
		await fs.writeFile(userSchemasPath, emptyUserSchemasContent)
	}
}

async function generateUnifiedClient(outputDir: string) {
	const unifiedClientContent = `// Unified client - auto-generated, do not edit manually
import { makeApi, Zodios, type ZodiosOptions } from '@zodios/core'

import { authEndpoints } from './auth.client.js'
import { chatEndpoints } from './chat.client.js'
import { userEndpoints } from './user.client.js'

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

	const clientPath = path.join(outputDir, 'clients', 'unified.client.ts')
	await fs.writeFile(clientPath, unifiedClientContent)
}

async function generateUnifiedTypesIndex(outputDir: string) {
	const unifiedTypesContent = `// Unified types index - auto-generated, do not edit manually

// Re-export all domain-specific types
export * from './auth.types.js'
export * from './chat.types.js'
export * from './user.types.js'

// Type utilities for easier consumption
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ApiRequestTypes {
	// Request types will be available here as they are generated
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ApiResponseTypes {
	// Response types will be available here as they are generated
}
`

	const typesIndexPath = path.join(outputDir, 'types', 'index.ts')
	await fs.writeFile(typesIndexPath, unifiedTypesContent)
}

await main()
