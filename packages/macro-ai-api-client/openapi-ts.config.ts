import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
	// Input: Path to the OpenAPI spec file
	input: '../../apps/express-api/public/swagger.json',

	// Output: Where to generate the client
	output: 'src/client',

	// Plugins configuration
	plugins: [
		// Core plugins
		'@hey-api/typescript', // Generates TypeScript interfaces and enums
		'@hey-api/schemas', // Exports OpenAPI definitions as JavaScript objects

		// Zod plugin for schema validation
		{
			name: 'zod',
			// Generate Zod schemas for requests, responses, and definitions
			requests: true,
			responses: true,
			definitions: true,
			// Generate TypeScript types from Zod schemas
			types: {
				infer: true, // Generate z.infer types
			},
			exportFromIndex: true,
		},

		// SDK plugin to generate API functions
		'@hey-api/sdk',

		// Axios client plugin
		'@hey-api/client-axios',
	],
})
