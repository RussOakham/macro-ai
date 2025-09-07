/**
 * Neon Database Branching Configuration
 *
 * This utility manages environment-specific Neon database branching:
 * - Production: main-production-branch (parent branch)
 * - Staging: auto-branch-from-production
 * - Feature: auto-branch-from-staging
 * - Preview: GitHub Actions PR branches (preview/pr-{number})
 * - Development: Uses branch-specific database or localhost
 *
 * Hybrid Approach: Manual control for production/staging + automated GitHub integration for feature branches
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
 * GitHub Actions environment detection
 */
function isGitHubActions(): boolean {
	return process.env.GITHUB_ACTIONS === 'true'
}

/**
 * Get GitHub PR number from environment
 */
function getGitHubPRNumber(): string | null {
	return process.env.GITHUB_EVENT_NUMBER || null
}

/**
 * Get GitHub branch name from environment
 */
function getGitHubBranchName(): string | null {
	return process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || null
}

/**
 * Get the current environment type
 *
 * Hybrid approach: Detects GitHub Actions for automated branching
 */
export function getEnvironmentType():
	| 'production'
	| 'staging'
	| 'feature'
	| 'development'
	| 'preview' {
	const appEnv = config.APP_ENV

	// Check for GitHub Actions environment first (highest priority)
	if (isGitHubActions()) {
		const prNumber = getGitHubPRNumber()
		const branchName = getGitHubBranchName()

		// GitHub PR environment
		if (prNumber) {
			return 'preview'
		}

		// GitHub push to feature branch
		if (branchName && !['main', 'develop', 'master'].includes(branchName)) {
			return 'feature'
		}
	}

	// Manual environment detection (existing logic)
	if (appEnv === 'production') return 'production'
	if (appEnv === 'staging') return 'staging'
	if (appEnv === 'feature' || appEnv.startsWith('feature/')) return 'feature'
	if (appEnv.startsWith('pr-') || appEnv === 'preview') return 'preview'

	return 'development'
}

/**
 * Get Neon branch configuration for the current environment
 *
 * Hybrid approach: Handles both static branches and GitHub Actions dynamic branches
 */
export function getNeonBranchConfig() {
	const envType = getEnvironmentType()

	// Static branch configurations for manual environments
	if (envType === 'production') {
		return NEON_BRANCH_CONFIG.production
	}

	if (envType === 'staging') {
		return NEON_BRANCH_CONFIG.staging
	}

	if (envType === 'feature' && !isGitHubActions()) {
		return NEON_BRANCH_CONFIG.feature
	}

	// GitHub Actions dynamic branch handling
	if (isGitHubActions()) {
		const prNumber = getGitHubPRNumber()
		const branchName = getGitHubBranchName()

		if (envType === 'preview' && prNumber) {
			return {
				branch: `preview/pr-${prNumber}`,
				description: `GitHub PR #${prNumber} database branch (auto-created)`,
			}
		}

		if (envType === 'feature' && branchName) {
			return {
				branch: `feature/${branchName}`,
				description: `GitHub feature branch '${branchName}' database (auto-created)`,
			}
		}
	}

	// Manual feature branch fallback
	if (envType === 'feature') {
		return NEON_BRANCH_CONFIG.feature
	}

	// Development and other environments
	if (envType === 'development') {
		return {
			branch: 'localhost',
			description: 'Local development database',
		}
	}

	// Fallback for unknown environments
	return {
		branch: `branch-${envType}`,
		description: `${envType} environment database`,
	}
}

/**
 * Generate Neon database URL with branch-specific configuration
 *
 * This function takes the base Neon database URL and modifies it to point to the correct branch
 * based on the current environment, supporting both manual and GitHub Actions automated branches.
 */
export function getNeonDatabaseUrl(): string {
	const baseUrl = config.RELATIONAL_DATABASE_URL
	const branchConfig = getNeonBranchConfig()

	// For local development, use the original URL
	if (branchConfig.branch === 'localhost') {
		return baseUrl
	}

	// For all Neon branches (production, staging, feature, preview), modify the URL
	// Neon URLs typically look like: postgresql://user:pass@ep-xxx-xxx.us-east-1.neon.tech/dbname
	// We need to modify this to include the branch parameter
	const url = new URL(baseUrl)

	// Add branch parameter to the connection options
	const searchParams = new URLSearchParams(url.search)
	searchParams.set('branch', branchConfig.branch)

	url.search = searchParams.toString()

	// Enhanced logging for hybrid approach
	const environmentType = getEnvironmentType()
	const isGitHub = isGitHubActions()
	const logPrefix = isGitHub ? '🤖 GitHub Actions' : '🔧 Manual'

	console.log(
		`${logPrefix} Using Neon branch: ${branchConfig.branch} (${branchConfig.description}) [${environmentType}]`,
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
 *
 * Hybrid approach: Supports both static and GitHub Actions dynamic configurations
 */
export function getCurrentDatabaseConfig() {
	const envType = getEnvironmentType()
	const branchConfig = getNeonBranchConfig()
	const isGitHub = isGitHubActions()

	// Static configurations for manual environments
	if (envType === 'production') {
		return databaseConfig.production
	}

	if (envType === 'staging') {
		return databaseConfig.staging
	}

	if (envType === 'feature' && !isGitHub) {
		return databaseConfig.feature
	}

	// Dynamic configurations for GitHub Actions and other environments
	return {
		url: getNeonDatabaseUrl(),
		branch: branchConfig.branch,
		description: branchConfig.description,
		isGitHubActions: isGitHub,
		environmentType: envType,
	}
}

/**
 * Get branch information for GitHub Actions workflows
 * Useful for setting environment variables in CI/CD pipelines
 */
export function getGitHubBranchInfo() {
	if (!isGitHubActions()) {
		return null
	}

	const prNumber = getGitHubPRNumber()
	const branchName = getGitHubBranchName()
	const envType = getEnvironmentType()
	const branchConfig = getNeonBranchConfig()

	return {
		prNumber,
		branchName,
		environmentType: envType,
		neonBranch: branchConfig.branch,
		description: branchConfig.description,
		databaseUrl: getNeonDatabaseUrl(),
	}
}

/**
 * Check if current environment requires a Neon branch (vs localhost)
 */
export function requiresNeonBranch(): boolean {
	const branchConfig = getNeonBranchConfig()
	return branchConfig.branch !== 'localhost'
}

/**
 * Get all available branch configurations for reference
 */
export function getAllBranchConfigs() {
	const currentEnv = getEnvironmentType()
	const currentBranch = getNeonBranchConfig()
	const isGitHub = isGitHubActions()

	return {
		current: {
			environment: currentEnv,
			branch: currentBranch.branch,
			description: currentBranch.description,
			isGitHubActions: isGitHub,
		},
		available: {
			production: NEON_BRANCH_CONFIG.production,
			staging: NEON_BRANCH_CONFIG.staging,
			feature: NEON_BRANCH_CONFIG.feature,
		},
		github: isGitHub ? getGitHubBranchInfo() : null,
	}
}
