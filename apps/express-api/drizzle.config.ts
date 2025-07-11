import { defineConfig } from 'drizzle-kit'

import { config } from './config/default.ts'

export default defineConfig({
	schema: './src/data-access/schema.ts',
	out: './src/data-access/migrations',
	dialect: 'postgresql',
	dbCredentials: {
		url: config.relationalDatabaseUrl,
	},
	// Disable breakpoints to prevent interactive prompts during CI/CD migrations
	// PostgreSQL supports multiple DDL statements in one transaction, so breakpoints are not needed
	breakpoints: false,
})
