import fs from 'fs/promises'
import { generateZodClientFromOpenAPI } from 'openapi-zod-client'
import type { OpenAPIObject } from 'openapi3-ts'
import path from 'path'

import type { DomainEndpoint } from './domain-parser.ts'

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
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
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

	// Add imports for schemas
	schemaLines.push("import { z } from 'zod'")
	schemaLines.push('')

	// Add imports for endpoints
	endpointLines.push(
		"import { makeApi, Zodios, type ZodiosOptions } from '@zodios/core'",
	)
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
			inEndpoints = true
			endpointLines.push(`const ${domain}Endpoints = makeApi([`)
			continue
		}

		// Detect exports
		if (
			line.includes('export const api') ||
			line.includes('export function createApiClient')
		) {
			if (line.includes('export const api')) {
				endpointLines.push(
					`export const ${domain}Client = new Zodios(${domain}Endpoints)`,
				)
			} else if (line.includes('export function createApiClient')) {
				const capitalizedDomain =
					domain.charAt(0).toUpperCase() + domain.slice(1)
				endpointLines.push(
					`export function create${capitalizedDomain}Client(baseUrl: string, options?: ZodiosOptions) {`,
				)
				endpointLines.push(
					`  return new Zodios(baseUrl, ${domain}Endpoints, options)`,
				)
				endpointLines.push('}')
			}
			continue
		}

		// Continue collecting lines for current section
		if (inSchemas && !line.includes('const endpoints')) {
			schemaLines.push(line)
		} else if (inEndpoints && !line.includes('export')) {
			endpointLines.push(line)
		}

		// End of endpoints section
		if (inEndpoints && line.includes('])')) {
			inEndpoints = false
		}
	}

	// Add schema exports
	schemaLines.push('')
	schemaLines.push(`export const ${domain}Schemas = {`)
	// Extract schema names and add to export object
	const schemaNames = schemaLines
		.filter((line) => line.includes('const ') && line.includes('_Body = z'))
		.map((line) => line.split('const ')[1]?.split(' =')[0])
		.filter((name): name is string => Boolean(name))

	for (const schemaName of schemaNames) {
		schemaLines.push(`  ${schemaName},`)
	}
	schemaLines.push('}')

	return {
		schemas: schemaLines.join('\n'),
		endpoints: endpointLines.join('\n'),
	}
}
