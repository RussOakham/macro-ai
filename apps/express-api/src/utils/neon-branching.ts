/**
 * Neon Database Branching Configuration
 *
 * This utility manages environment-specific Neon database branching:
 * - Production: main-production-branch (parent branch)
 * - Staging: auto-branch-from-production
 * - Feature: auto-branch-from-staging
 * - Development: Uses branch-specific database or localhost
 */

import { config } from './load-config.ts'

// Neon branching configuration
const NEON_BRANCH_CONFIG = {
	production: {
		branch: 'main-production-branch',
		description: 'Production database (parent branch with live data)',
	},
	staging: {
		branch: 'auto-branch-from-production',
		description: 'Staging database (auto-branched from production)',
	},
	feature: {
		branch: 'auto-branch-from-staging',
		description: 'Feature database (auto-branched from staging)',
	},
} as const

/**
 * Get the current environment type
 */
export function getEnvironmentType():
	| 'production'
	| 'staging'
	| 'feature'
	| 'development'
	| 'preview' {
	const appEnv = config.APP_ENV

	if (appEnv === 'production') return 'production'
	if (appEnv === 'staging') return 'staging'
	if (appEnv === 'feature' || appEnv.startsWith('feature/')) return 'feature'
	if (appEnv.startsWith('pr-')) return 'preview'

	return 'development'
}

/**
 * Get Neon branch configuration for the current environment
 */
export function getNeonBranchConfig() {
	const envType = getEnvironmentType()

	if (
		envType === 'production' ||
		envType === 'staging' ||
		envType === 'feature'
	) {
		return NEON_BRANCH_CONFIG[envType]
	}

	// For development and preview environments, use localhost or branch-specific database
	return {
		branch:
			envType === 'development' ? 'localhost' : `preview-${config.APP_ENV}`,
		description: `${envType} environment database`,
	}
}

/**
 * Generate Neon database URL with branch-specific configuration
 *
 * This function takes the base Neon database URL and modifies it to point to the correct branch
 * based on the current environment and git branch.
 */
export function getNeonDatabaseUrl(): string {
	const baseUrl = config.RELATIONAL_DATABASE_URL
	const branchConfig = getNeonBranchConfig()

	// For local development, use the original URL
	if (branchConfig.branch === 'localhost') {
		return baseUrl
	}

	// For production/staging/feature environments, modify the URL to use the correct branch
	// Neon URLs typically look like: postgresql://user:pass@ep-xxx-xxx.us-east-1.neon.tech/dbname
	// We need to modify this to include the branch parameter
	const url = new URL(baseUrl)

	// Add branch parameter to the connection options
	const searchParams = new URLSearchParams(url.search)
	searchParams.set('branch', branchConfig.branch)

	url.search = searchParams.toString()

	console.log(
		`🔄 Using Neon branch: ${branchConfig.branch} (${branchConfig.description})`,
	)

	return url.toString()
}

/**
 * Environment-specific database configuration
 */
export const databaseConfig = {
	production: {
		url: getNeonDatabaseUrl(),
		branch: NEON_BRANCH_CONFIG.production.branch,
		description: NEON_BRANCH_CONFIG.production.description,
	},
	staging: {
		url: getNeonDatabaseUrl(),
		branch: NEON_BRANCH_CONFIG.staging.branch,
		description: NEON_BRANCH_CONFIG.staging.description,
	},
	feature: {
		url: getNeonDatabaseUrl(),
		branch: NEON_BRANCH_CONFIG.feature.branch,
		description: NEON_BRANCH_CONFIG.feature.description,
	},
} as const

/**
 * Get current database configuration
 */
export function getCurrentDatabaseConfig() {
	const envType = getEnvironmentType()

	if (envType in databaseConfig) {
		return databaseConfig[envType as keyof typeof databaseConfig]
	}

	// For development/preview environments
	return {
		url: getNeonDatabaseUrl(),
		branch: getNeonBranchConfig().branch,
		description: getNeonBranchConfig().description,
	}
}
