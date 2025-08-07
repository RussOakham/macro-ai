import type {
	OpenAPIObject,
	OperationObject,
	ParameterObject,
	PathItemObject,
	ReferenceObject,
	RequestBodyObject,
	ResponseObject,
} from 'openapi3-ts'

/**
 * Type guard to check if an object is a ReferenceObject
 */
function isReferenceObject(obj: unknown): obj is ReferenceObject {
	return typeof obj === 'object' && obj !== null && '$ref' in obj
}

/**
 * Type guard to check if a request body is a RequestBodyObject (not a ReferenceObject)
 */
function isRequestBodyObject(
	obj: RequestBodyObject | ReferenceObject,
): obj is RequestBodyObject {
	return !isReferenceObject(obj)
}

/**
 * Type guard to check if a response is a ResponseObject (not a ReferenceObject)
 */
function isResponseObject(
	obj: ResponseObject | ReferenceObject,
): obj is ResponseObject {
	return !isReferenceObject(obj)
}

/**
 * Type guard to check if a parameter is a ParameterObject (not a ReferenceObject)
 */
function isParameterObject(
	obj: ParameterObject | ReferenceObject,
): obj is ParameterObject {
	return !isReferenceObject(obj)
}

export interface DomainEndpoint {
	path: string
	method: string
	operation: OperationObject
	domain: string
}

export interface DomainGroup {
	auth: DomainEndpoint[]
	chat: DomainEndpoint[]
	user: DomainEndpoint[]
	system: DomainEndpoint[]
}

/**
 * Determines the domain based on the API path
 */
export function getDomainFromPath(path: string): string {
	if (path.startsWith('/auth')) return 'auth'
	if (path.startsWith('/chats')) return 'chat'
	if (path.startsWith('/users')) return 'user'
	if (path.startsWith('/health') || path.startsWith('/system-info'))
		return 'system'
	return 'shared'
}

/**
 * Validates that a path item is a valid PathItemObject
 */
function isValidPathItem(pathItem: unknown): pathItem is PathItemObject {
	return (
		typeof pathItem === 'object' &&
		pathItem !== null &&
		!Array.isArray(pathItem)
	)
}

/**
 * Parses OpenAPI spec and groups endpoints by domain
 * Includes validation to handle malformed OpenAPI specs gracefully
 */
export function parseEndpointsByDomain(openApiDoc: OpenAPIObject): DomainGroup {
	const domains: DomainGroup = {
		auth: [],
		chat: [],
		user: [],
		system: [],
	}

	// Validate that paths is a valid object with entries
	if (typeof openApiDoc.paths !== 'object') {
		console.warn('[Domain Parser] OpenAPI spec has invalid paths object')
		return domains
	}

	// Check if paths object is empty
	if (Object.keys(openApiDoc.paths).length === 0) {
		console.warn('[Domain Parser] OpenAPI spec has no paths defined')
		return domains
	}

	try {
		for (const [path, pathItem] of Object.entries(openApiDoc.paths)) {
			// Validate path is a string
			if (typeof path !== 'string' || !path) {
				console.warn(`[Domain Parser] Invalid path: ${path}`)
				continue
			}

			// Validate pathItem structure
			if (!isValidPathItem(pathItem)) {
				console.warn(`[Domain Parser] Invalid path item for path: ${path}`)
				continue
			}

			// pathItem is now validated as PathItemObject
			const pathItemObj = pathItem
			const domain = getDomainFromPath(path)

			// Skip system endpoints for now (health, system-info)
			if (domain === 'system' || domain === 'shared') continue

			// Extract all HTTP methods for this path
			const methods = ['get', 'post', 'put', 'delete', 'patch'] as const

			for (const method of methods) {
				try {
					const operation = pathItemObj[method]
					if (operation && typeof operation === 'object') {
						const endpoint: DomainEndpoint = {
							path,
							method,
							operation,
							domain,
						}

						if (domain === 'auth') domains.auth.push(endpoint)
						else if (domain === 'chat') domains.chat.push(endpoint)
						else if (domain === 'user') domains.user.push(endpoint)
					}
				} catch (error: unknown) {
					console.warn(
						`[Domain Parser] Error processing method ${method} for path ${path}:`,
						error instanceof Error ? error.message : 'Unknown error',
					)
				}
			}
		}
	} catch (error: unknown) {
		console.error(
			'[Domain Parser] Error parsing OpenAPI spec:',
			error instanceof Error ? error.message : 'Unknown error',
		)
	}

	return domains
}

/**
 * Extracts schema names used by a specific domain's endpoints
 */
export function getSchemasByDomain(endpoints: DomainEndpoint[]): Set<string> {
	const schemas = new Set<string>()

	for (const endpoint of endpoints) {
		const operation = endpoint.operation

		// Extract request body schemas
		if (operation.requestBody && isRequestBodyObject(operation.requestBody)) {
			const content = operation.requestBody.content
			for (const mediaType of Object.values(content)) {
				if (mediaType.schema && '$ref' in mediaType.schema) {
					const schemaName = mediaType.schema.$ref.split('/').pop()
					if (schemaName) schemas.add(schemaName)
				}
			}
		}

		// Extract response schemas
		for (const response of Object.values(operation.responses)) {
			const responseObj = response as ResponseObject | ReferenceObject
			if (isResponseObject(responseObj) && responseObj.content) {
				for (const mediaType of Object.values(responseObj.content)) {
					if (mediaType.schema && '$ref' in mediaType.schema) {
						const schemaName = mediaType.schema.$ref.split('/').pop()
						if (schemaName) schemas.add(schemaName)
					}
				}
			}
		}

		// Extract parameter schemas
		if (operation.parameters) {
			for (const param of operation.parameters) {
				if (
					isParameterObject(param) &&
					param.schema &&
					'$ref' in param.schema
				) {
					const schemaName = param.schema.$ref.split('/').pop()
					if (schemaName) schemas.add(schemaName)
				}
			}
		}
	}

	return schemas
}
