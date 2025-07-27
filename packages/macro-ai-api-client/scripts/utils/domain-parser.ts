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
 * Parses OpenAPI spec and groups endpoints by domain
 */
export function parseEndpointsByDomain(openApiDoc: OpenAPIObject): DomainGroup {
	const domains: DomainGroup = {
		auth: [],
		chat: [],
		user: [],
		system: [],
	}

	for (const [path, pathItem] of Object.entries(openApiDoc.paths)) {
		const pathItemObj = pathItem as PathItemObject
		const domain = getDomainFromPath(path)

		// Skip system endpoints for now (health, system-info)
		if (domain === 'system' || domain === 'shared') continue

		// Extract all HTTP methods for this path
		const methods = ['get', 'post', 'put', 'delete', 'patch'] as const

		for (const method of methods) {
			const operation = pathItemObj[method]
			if (operation) {
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
		}
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
