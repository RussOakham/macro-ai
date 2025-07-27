import fs from 'fs/promises'
import { generateZodClientFromOpenAPI } from 'openapi-zod-client'
import type { OpenAPIObject } from 'openapi3-ts'
import path from 'path'

import type { DomainEndpoint } from './domain-parser.ts'
import {
	extractTypeDefinitions,
	generateDomainTypesFile,
} from './type-generator.js'

/**
 * Generates schema-based types file for a domain
 */
function generateSchemaBasedTypesFile(domain: string): string {
	const lines: string[] = []

	// Add file header
	lines.push(
		`// ${domain.charAt(0).toUpperCase() + domain.slice(1)} API Types - auto-generated, do not edit manually`,
	)
	lines.push(
		'// Types are now inferred from Zod schemas for runtime validation and type safety',
	)
	lines.push('')
	lines.push("import type { z } from 'zod'")
	lines.push('')

	// Add schema imports based on domain
	if (domain === 'chat') {
		lines.push('import type {')
		lines.push('  getChats_Response,')
		lines.push('  getChatsId_Response,')
		lines.push('  postChats_Body,')
		lines.push('  postChats_Response,')
		lines.push('  putChatsId_Body,')
		lines.push('  putChatsId_Response,')
		lines.push('  deleteChatsId_Response,')
		lines.push('  postChatsIdstream_Body,')
		lines.push(`} from '../schemas/${domain}.schemas.js'`)
		lines.push('')

		// Add type definitions
		lines.push(
			'// ============================================================================',
		)
		lines.push('// REQUEST TYPES (inferred from Zod schemas)')
		lines.push(
			'// ============================================================================',
		)
		lines.push('')
		lines.push(
			'export type ChatPostChatsRequest = z.infer<typeof postChats_Body>',
		)
		lines.push('')
		lines.push(
			'export type ChatPutChatsByIdRequest = z.infer<typeof putChatsId_Body>',
		)
		lines.push('')
		lines.push(
			'export type ChatPostChatsByIdStreamRequest = z.infer<typeof postChatsIdstream_Body>',
		)
		lines.push('')
		lines.push(
			'// ============================================================================',
		)
		lines.push('// RESPONSE TYPES (inferred from Zod schemas)')
		lines.push(
			'// ============================================================================',
		)
		lines.push('')
		lines.push(
			'export type ChatGetChatsResponse = z.infer<typeof getChats_Response>',
		)
		lines.push('')
		lines.push(
			'export type ChatPostChatsResponse = z.infer<typeof postChats_Response>',
		)
		lines.push('')
		lines.push(
			'export type ChatGetChatsByIdResponse = z.infer<typeof getChatsId_Response>',
		)
		lines.push('')
		lines.push(
			'export type ChatPutChatsByIdResponse = z.infer<typeof putChatsId_Response>',
		)
		lines.push('')
		lines.push(
			'export type ChatDeleteChatsByIdResponse = z.infer<typeof deleteChatsId_Response>',
		)
	} else if (domain === 'auth') {
		lines.push('import type {')
		lines.push('  postAuthregister_Body,')
		lines.push('  postAuthconfirmRegistration_Body,')
		lines.push('  postAuthresendConfirmationCode_Body,')
		lines.push('  postAuthlogin_Body,')
		lines.push('  postAuthforgotPassword_Body,')
		lines.push('  postAuthconfirmForgotPassword_Body,')
		lines.push('  postAuthregister_Response,')
		lines.push('  postAuthconfirmRegistration_Response,')
		lines.push('  postAuthresendConfirmationCode_Response,')
		lines.push('  postAuthlogin_Response,')
		lines.push('  postAuthlogout_Response,')
		lines.push('  postAuthrefresh_Response,')
		lines.push('  postAuthforgotPassword_Response,')
		lines.push('  postAuthconfirmForgotPassword_Response,')
		lines.push('  getAuthuser_Response,')
		lines.push(`} from '../schemas/${domain}.schemas.js'`)
		lines.push('')

		// Add type definitions
		lines.push(
			'// ============================================================================',
		)
		lines.push('// REQUEST TYPES (inferred from Zod schemas)')
		lines.push(
			'// ============================================================================',
		)
		lines.push('')
		lines.push(
			'export type AuthPostRegisterRequest = z.infer<typeof postAuthregister_Body>',
		)
		lines.push('')
		lines.push(
			'export type AuthPostConfirmRegistrationRequest = z.infer<typeof postAuthconfirmRegistration_Body>',
		)
		lines.push('')
		lines.push(
			'export type AuthPostResendConfirmationCodeRequest = z.infer<typeof postAuthresendConfirmationCode_Body>',
		)
		lines.push('')
		lines.push(
			'export type AuthPostLoginRequest = z.infer<typeof postAuthlogin_Body>',
		)
		lines.push('')
		lines.push(
			'export type AuthPostForgotPasswordRequest = z.infer<typeof postAuthforgotPassword_Body>',
		)
		lines.push('')
		lines.push(
			'export type AuthPostConfirmForgotPasswordRequest = z.infer<typeof postAuthconfirmForgotPassword_Body>',
		)
		lines.push('')
		lines.push(
			'// ============================================================================',
		)
		lines.push('// RESPONSE TYPES (inferred from Zod schemas)')
		lines.push(
			'// ============================================================================',
		)
		lines.push('')
		lines.push(
			'export type AuthPostRegisterResponse = z.infer<typeof postAuthregister_Response>',
		)
		lines.push('')
		lines.push(
			'export type AuthPostConfirmRegistrationResponse = z.infer<typeof postAuthconfirmRegistration_Response>',
		)
		lines.push('')
		lines.push(
			'export type AuthPostResendConfirmationCodeResponse = z.infer<typeof postAuthresendConfirmationCode_Response>',
		)
		lines.push('')
		lines.push(
			'export type AuthPostLoginResponse = z.infer<typeof postAuthlogin_Response>',
		)
		lines.push('')
		lines.push(
			'export type AuthPostLogoutResponse = z.infer<typeof postAuthlogout_Response>',
		)
		lines.push('')
		lines.push(
			'export type AuthPostRefreshResponse = z.infer<typeof postAuthrefresh_Response>',
		)
		lines.push('')
		lines.push(
			'export type AuthPostForgotPasswordResponse = z.infer<typeof postAuthforgotPassword_Response>',
		)
		lines.push('')
		lines.push(
			'export type AuthPostConfirmForgotPasswordResponse = z.infer<typeof postAuthconfirmForgotPassword_Response>',
		)
		lines.push('')
		lines.push(
			'export type AuthGetUserResponse = z.infer<typeof getAuthuser_Response>',
		)
	} else if (domain === 'user') {
		lines.push('import type {')
		lines.push('  getUsersId_Response,')
		lines.push('  getUsersMe_Response,')
		lines.push(`} from '../schemas/${domain}.schemas.js'`)
		lines.push('')

		// Add type definitions
		lines.push(
			'// ============================================================================',
		)
		lines.push('// RESPONSE TYPES (inferred from Zod schemas)')
		lines.push(
			'// ============================================================================',
		)
		lines.push('')
		lines.push(
			'export type UserGetUsersByIdResponse = z.infer<typeof getUsersId_Response>',
		)
		lines.push('')
		lines.push(
			'export type UserGetUsersMeResponse = z.infer<typeof getUsersMe_Response>',
		)
	} else {
		// For other domains, fall back to the original approach
		lines.push(`// No schema-based types available for ${domain} domain yet`)
		lines.push(
			`// Types will be added here when ${domain} endpoints are migrated to schema-based approach`,
		)
		lines.push('')
		lines.push(
			`export type ${domain.charAt(0).toUpperCase() + domain.slice(1)}Types = Record<string, never>`,
		)
	}

	return lines.join('\n')
}

/**
 * Creates a filtered OpenAPI spec containing only the specified endpoints
 */
export function createDomainOpenAPISpec(
	originalSpec: OpenAPIObject,
	endpoints: DomainEndpoint[],
): OpenAPIObject {
	const filteredSpec: OpenAPIObject = {
		...originalSpec,
		paths: {},
	}

	// Add only the paths for this domain
	for (const endpoint of endpoints) {
		filteredSpec.paths[endpoint.path] ??= {}

		// Add the specific method for this endpoint
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		filteredSpec.paths[endpoint.path][endpoint.method] = endpoint.operation
	}

	return filteredSpec
}

/**
 * Generates a domain-specific client file
 */
export async function generateDomainClient(
	domain: string,
	endpoints: DomainEndpoint[],
	originalSpec: OpenAPIObject,
	outputDir: string,
	prettierConfig: any, // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<void> {
	const domainSpec = createDomainOpenAPISpec(originalSpec, endpoints)
	const tempOutputPath = path.join(outputDir, `temp-${domain}.ts`)

	try {
		// Generate the domain-specific client
		await generateZodClientFromOpenAPI({
			openApiDoc: domainSpec,
			distPath: tempOutputPath,
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			prettierConfig,
		})

		// Read the generated content
		const generatedContent = await fs.readFile(tempOutputPath, 'utf-8')

		// Process the content to extract schemas and endpoints
		const { schemas, endpoints: endpointCode } = extractSchemasAndEndpoints(
			generatedContent,
			domain,
		)

		// Write domain-specific schema file
		const schemaPath = path.join(outputDir, 'schemas', `${domain}.schemas.ts`)
		await fs.writeFile(schemaPath, schemas)

		// Write domain-specific client file
		const clientPath = path.join(outputDir, 'clients', `${domain}.client.ts`)
		await fs.writeFile(clientPath, endpointCode)

		// Generate and write domain-specific types file
		let typesContent: string
		if (['chat', 'auth', 'user'].includes(domain)) {
			// Use schema-based type generation for schema-driven domains
			typesContent = generateSchemaBasedTypesFile(domain)
		} else {
			// Use original approach for other domains
			const typeDefinitions = extractTypeDefinitions(endpoints, domain)
			typesContent = generateDomainTypesFile(domain, typeDefinitions)
		}
		const typesPath = path.join(outputDir, 'types', `${domain}.types.ts`)
		await fs.writeFile(typesPath, typesContent)

		// Clean up temp file
		await fs.unlink(tempOutputPath)

		console.log(`Generated ${domain} domain files`)
	} catch (error) {
		console.error(`Error generating ${domain} domain:`, error)
		// Clean up temp file if it exists
		try {
			await fs.unlink(tempOutputPath)
		} catch {}
		throw error
	}
}

/**
 * Extracts schemas and endpoints from generated content
 */
function extractSchemasAndEndpoints(
	content: string,
	domain: string,
): { schemas: string; endpoints: string } {
	const lines = content.split('\n')

	const schemaLines: string[] = []
	const endpointLines: string[] = []
	let inSchemas = false
	let inEndpoints = false

	// Add imports for schemas only if there are schemas to generate
	const hasSchemas = content.includes('_Body = z')
	if (hasSchemas) {
		schemaLines.push("import { z } from 'zod'")
		schemaLines.push('')
	}

	// Extract schema names used in content first
	const usedSchemas = new Set<string>()
	const schemaMatches = content.match(/\b\w+_Body\b/g)
	if (schemaMatches) {
		schemaMatches.forEach((schema) => usedSchemas.add(schema))
	}

	// Add imports for endpoints (external imports first, then internal)
	endpointLines.push(
		"import { makeApi, Zodios, type ZodiosOptions } from '@zodios/core'",
	)
	endpointLines.push("import { z } from 'zod'")

	// Add schema import if any schemas are used
	if (usedSchemas.size > 0) {
		endpointLines.push('')
		// Sort schema imports alphabetically
		const sortedSchemas = Array.from(usedSchemas).sort((a, b) =>
			a.localeCompare(b),
		)
		endpointLines.push(`import {`)
		endpointLines.push(`  ${sortedSchemas.join(',\n  ')},`)
		endpointLines.push(`} from '../schemas/${domain}.schemas.js'`)
	}

	endpointLines.push('')

	for (const line of lines) {
		if (!line) continue

		// Detect schema definitions
		if (line.includes('const ') && line.includes('_Body = z')) {
			inSchemas = true
			schemaLines.push(line)
			continue
		}

		// Detect endpoints
		if (line.includes('const endpoints = makeApi([')) {
			inSchemas = false // Stop collecting schemas
			inEndpoints = true
			endpointLines.push(`const ${domain}Endpoints = makeApi([`)
			continue
		}

		// Skip original exports - we'll add our own at the end
		if (
			line.includes('export const api') ||
			line.includes('export function createApiClient')
		) {
			continue
		}

		// Continue collecting lines for current section
		if (inSchemas && !line.includes('const endpoints')) {
			schemaLines.push(line)
		} else if (inEndpoints && !line.includes('export')) {
			endpointLines.push(line)
			// End of endpoints section - look for closing bracket
			if (line.trim() === '])') {
				inEndpoints = false
			}
		}
	}

	// Add individual schema exports
	schemaLines.push('')
	// Extract schema names and add individual exports
	const schemaNames = schemaLines
		.filter((line) => line.includes('const ') && line.includes('_Body = z'))
		.map((line) => line.split('const ')[1]?.split(' =')[0])
		.filter((name): name is string => Boolean(name))

	if (schemaNames.length > 0) {
		schemaLines.push('// Individual exports for direct access')
		// Sort schema names alphabetically for consistent exports
		const sortedSchemaNames = [...schemaNames].sort((a, b) =>
			a.localeCompare(b),
		)
		schemaLines.push(`export {`)
		for (const schemaName of sortedSchemaNames) {
			schemaLines.push(`  ${schemaName},`)
		}
		schemaLines.push('}')
	} else {
		// Export empty schemas object for domains with no schemas
		if (!hasSchemas) {
			schemaLines.push('')
		}
		schemaLines.push(
			`// ${domain.charAt(0).toUpperCase() + domain.slice(1)} schemas will be added here when available`,
		)
		schemaLines.push(`export const ${domain}Schemas = {`)
		schemaLines.push('  // Schemas will be exported individually')
		schemaLines.push('}')
	}

	// Schema imports were already added at the beginning

	// Add endpoint exports
	endpointLines.push('')
	endpointLines.push(
		`export const ${domain}Client = new Zodios(${domain}Endpoints)`,
	)
	endpointLines.push('')
	const capitalizedDomain = domain.charAt(0).toUpperCase() + domain.slice(1)
	endpointLines.push(
		`export function create${capitalizedDomain}Client(baseUrl: string, options?: ZodiosOptions) {`,
	)
	endpointLines.push(
		`  return new Zodios(baseUrl, ${domain}Endpoints, options)`,
	)
	endpointLines.push('}')
	endpointLines.push('')
	endpointLines.push(`export { ${domain}Endpoints }`)

	return {
		schemas: schemaLines.join('\n'),
		endpoints: endpointLines.join('\n'),
	}
}
