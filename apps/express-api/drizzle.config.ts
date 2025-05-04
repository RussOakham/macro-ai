import { defineConfig } from 'drizzle-kit'

import { config } from './config/default.ts'

export default defineConfig({
	schema: './src/data-access/schema.ts',
	out: './src/data-access/migrations',
	dialect: 'postgresql',
	dbCredentials: {
		url: config.relationalDatabaseUrl,
	},
})
