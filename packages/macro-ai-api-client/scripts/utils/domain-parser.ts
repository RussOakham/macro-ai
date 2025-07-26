import type { OpenAPIObject, PathItemObject } from 'openapi3-ts'

export interface DomainEndpoint {
	path: string
	method: string
	operation: any // eslint-disable-line @typescript-eslint/no-explicit-any
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
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const operation = endpoint.operation

		// Extract request body schemas
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		if (operation.requestBody?.content) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
			const content = operation.requestBody.content
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			for (const mediaType of Object.values(content)) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
				if ((mediaType as any)?.schema?.$ref) {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
					const schemaName = (mediaType as any).schema.$ref.split('/').pop()
					// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
					if (schemaName) schemas.add(schemaName)
				}
			}
		}

		// Extract response schemas
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		if (operation.responses) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
			for (const response of Object.values(operation.responses)) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
				if ((response as any)?.content) {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
					for (const mediaType of Object.values((response as any).content)) {
						// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
						if ((mediaType as any)?.schema?.$ref) {
							// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
							const schemaName = (mediaType as any).schema.$ref.split('/').pop()
							// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
							if (schemaName) schemas.add(schemaName)
						}
					}
				}
			}
		}

		// Extract parameter schemas
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		if (operation.parameters) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			for (const param of operation.parameters) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				if (param?.schema?.$ref) {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
					const schemaName = param.schema.$ref.split('/').pop()
					// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
					if (schemaName) schemas.add(schemaName)
				}
			}
		}
	}

	return schemas
}
