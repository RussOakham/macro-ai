import type { SchemaObject } from 'openapi3-ts'

import type { DomainEndpoint } from './domain-parser.js'

/**
 * Type guard to check if an object has content with application/json schema
 */
function hasJsonSchema(
	obj: unknown,
): obj is { content: { 'application/json': { schema: SchemaObject } } } {
	if (typeof obj !== 'object' || obj === null) {
		return false
	}

	const record = obj as Record<string, unknown>

	if (
		!('content' in record) ||
		typeof record.content !== 'object' ||
		record.content === null
	) {
		return false
	}

	const content = record.content as Record<string, unknown>

	if (
		!('application/json' in content) ||
		typeof content['application/json'] !== 'object' ||
		content['application/json'] === null
	) {
		return false
	}

	const jsonContent = content['application/json'] as Record<string, unknown>

	return (
		'schema' in jsonContent &&
		typeof jsonContent.schema === 'object' &&
		jsonContent.schema !== null
	)
}

export interface TypeDefinition {
	name: string
	definition: string
	isRequest: boolean
	isResponse: boolean
}

/**
 * Converts OpenAPI schema to TypeScript interface definition
 */
function convertSchemaToTypeScript(
	schema: SchemaObject,
	typeName: string,
	indent = 0,
): string {
	const indentStr = '  '.repeat(indent)

	if (schema.type === 'object' && schema.properties) {
		const properties: string[] = []

		for (const [propName, propSchema] of Object.entries(schema.properties)) {
			const isRequired = schema.required?.includes(propName) ?? false
			const optional = isRequired ? '' : '?'
			const propType = getTypeScriptType(propSchema as SchemaObject)

			properties.push(`${indentStr}  ${propName}${optional}: ${propType}`)
		}

		return `export interface ${typeName} {\n${properties.join('\n')}\n${indentStr}}`
	}

	// For non-object schemas, create a type alias
	const tsType = getTypeScriptType(schema)
	return `export type ${typeName} = ${tsType}`
}

/**
 * Cache for memoizing schema type conversions to prevent infinite recursion
 */
const typeConversionCache = new Map<string, string>()

/**
 * Clears the type conversion cache (useful for testing or memory management)
 */
export function clearTypeConversionCache(): void {
	typeConversionCache.clear()
}

/**
 * Maximum recursion depth to prevent infinite loops
 */
const MAX_RECURSION_DEPTH = 10

/**
 * Converts OpenAPI schema type to TypeScript type with recursion protection
 */
function getTypeScriptType(
	schema: SchemaObject,
	depth = 0,
	visited = new Set<string>(),
): string {
	// Prevent infinite recursion by checking depth
	if (depth > MAX_RECURSION_DEPTH) {
		console.warn(
			`[Type Generator] Maximum recursion depth (${String(MAX_RECURSION_DEPTH)}) exceeded, returning 'unknown'`,
		)
		return 'unknown'
	}

	// Create a unique key for this schema to detect circular references
	const schemaKey = JSON.stringify(schema)

	// Check if we've already processed this exact schema
	if (visited.has(schemaKey)) {
		console.warn(
			"[Type Generator] Circular reference detected in schema, returning 'unknown'",
		)
		return 'unknown'
	}

	// Check memoization cache
	const cachedResult = typeConversionCache.get(schemaKey)
	if (cachedResult !== undefined) {
		return cachedResult
	}

	// Add to visited set to track circular references
	const newVisited = new Set(visited)
	newVisited.add(schemaKey)

	let result: string
	if (schema.type === 'string') {
		if (schema.enum) {
			result = schema.enum.map((val) => `'${String(val)}'`).join(' | ')
		} else {
			result = 'string'
		}
	} else if (schema.type === 'number' || schema.type === 'integer') {
		result = 'number'
	} else if (schema.type === 'boolean') {
		result = 'boolean'
	} else if (schema.type === 'array' && schema.items) {
		const itemType = getTypeScriptType(
			schema.items as SchemaObject,
			depth + 1,
			newVisited,
		)
		result = `${itemType}[]`
	} else if (schema.type === 'object' && schema.properties) {
		const properties: string[] = []

		for (const [propName, propSchema] of Object.entries(schema.properties)) {
			const isRequired = schema.required?.includes(propName) ?? false
			const optional = isRequired ? '' : '?'
			const propType = getTypeScriptType(
				propSchema as SchemaObject,
				depth + 1,
				newVisited,
			)

			properties.push(`  ${propName}${optional}: ${propType}`)
		}

		result = `{\n${properties.join('\n')}\n}`
	} else if (schema.nullable) {
		// Handle nullable types
		const baseType = getTypeScriptType(
			{ ...schema, nullable: false },
			depth + 1,
			newVisited,
		)
		result = `${baseType} | null`
	} else {
		// Fallback
		result = 'unknown'
	}

	// Cache the result for future use
	typeConversionCache.set(schemaKey, result)
	return result
}

/**
 * Generates TypeScript type name from endpoint path and method
 */
function generateTypeName(
	path: string,
	method: string,
	domain: string,
	isRequest: boolean,
): string {
	// Convert path to camelCase operation name
	// e.g., /auth/login -> AuthLogin, /users/{id} -> UserGetById
	const pathParts = path.split('/').filter(Boolean)

	// Remove domain prefix if present
	if (pathParts[0] === domain) {
		pathParts.shift()
	}

	// Convert to PascalCase and handle special characters
	let operationName = pathParts
		.map((part) => {
			// Handle path parameters like {id}
			if (part.startsWith('{') && part.endsWith('}')) {
				const paramName = part.slice(1, -1)
				return `By${paramName.charAt(0).toUpperCase() + paramName.slice(1)}`
			}
			// Convert kebab-case to PascalCase
			return part
				.split('-')
				.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
				.join('')
		})
		.join('')

	// Add method prefix for clarity
	const methodPrefix = method.charAt(0).toUpperCase() + method.slice(1)
	if (!operationName.toLowerCase().includes(method.toLowerCase())) {
		operationName = methodPrefix + operationName
	}

	// Add domain prefix
	const domainPrefix = domain.charAt(0).toUpperCase() + domain.slice(1)

	// Add suffix
	const suffix = isRequest ? 'Request' : 'Response'

	return `${domainPrefix}${operationName}${suffix}`
}

/**
 * Extracts type definitions from domain endpoints
 */
export function extractTypeDefinitions(
	endpoints: DomainEndpoint[],
	domain: string,
): TypeDefinition[] {
	const types: TypeDefinition[] = []

	for (const endpoint of endpoints) {
		const operation = endpoint.operation

		// Extract request body types
		if (hasJsonSchema(operation.requestBody)) {
			const schema = operation.requestBody.content['application/json'].schema
			const typeName = generateTypeName(
				endpoint.path,
				endpoint.method,
				domain,
				true,
			)
			const definition = convertSchemaToTypeScript(schema, typeName)

			types.push({
				name: typeName,
				definition,
				isRequest: true,
				isResponse: false,
			})
		}

		// Extract response types
		for (const [statusCode, response] of Object.entries(operation.responses)) {
			// Focus on successful responses (2xx)
			if (statusCode.startsWith('2') && hasJsonSchema(response)) {
				const schema = response.content['application/json'].schema
				const typeName = generateTypeName(
					endpoint.path,
					endpoint.method,
					domain,
					false,
				)
				const definition = convertSchemaToTypeScript(schema, typeName)

				types.push({
					name: typeName,
					definition,
					isRequest: false,
					isResponse: true,
				})

				// Only take the first successful response
				break
			}
		}
	}

	return types
}

/**
 * Generates TypeScript file content for domain types
 */
export function generateDomainTypesFile(
	domain: string,
	types: TypeDefinition[],
): string {
	const lines: string[] = []

	// Add file header
	lines.push(
		`// ${domain.charAt(0).toUpperCase() + domain.slice(1)} API Types - auto-generated, do not edit manually`,
	)
	lines.push('')

	if (types.length === 0) {
		lines.push(`// No types available for ${domain} domain`)
		lines.push(
			`// Types will be added here when ${domain} endpoints define request/response schemas`,
		)
		lines.push('')
		lines.push(
			`export type ${domain.charAt(0).toUpperCase() + domain.slice(1)}Types = Record<string, never>`,
		)
		return lines.join('\n')
	}

	// Add type definitions
	for (const type of types) {
		lines.push(type.definition)
		lines.push('')
	}

	// No need for additional exports since interfaces are already exported
	return lines.join('\n')
}
