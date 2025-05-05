import { Options } from 'swagger-jsdoc'

import { responses } from './responses/index.ts'
import { schemas } from './schemas/index.ts'
import { security, securitySchemes } from './security.ts'

// Main Swagger configuration
export const swaggerOptions: Options = {
	definition: {
		openapi: '3.1.0',
		info: {
			title: 'Macro AI Express API with Swagger',
			version: '0.0.1',
			description:
				'This is a simple CRUD API application made with Express and documented with Swagger',
			license: {
				name: 'MIT',
				url: 'https://spdx.org/licenses/MIT.html',
			},
		},
		servers: [
			{
				url: 'http://localhost:3030/api',
			},
		],
		components: {
			securitySchemes,
			schemas,
			responses,
		},
		security,
	},
	apis: ['./src/features/**/*.ts'],
}
