/**
 * Neon Database Branching Configuration
 *
 * This utility manages environment-specific Neon database branching:
 * - Production: main-production-branch (parent branch)
 * - Staging: auto-branch-from-production
 * - Feature: auto-branch-from-staging
 * - Preview: GitHub Actions PR branches (preview/pr-{number})
 * - Development: Uses git branch-based database selection
 *
 * Hybrid Approach: Manual control for production/staging + automated GitHub integration for feature branches
 *
 * Git Branch Mapping:
 * - main/master: Production branch
 * - develop/staging: Staging branch
 * - feature/*: Feature branch
 * - other branches: Feature branch (fallback)
 */

import { execSync } from 'node:child_process'

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
 * Get current git branch name (for local development)
 *
 * Returns the current git branch name or null if not in a git repository
 * or if git command fails.
 */
function getCurrentGitBranch(): string | null {
	try {
		// Check if we're in a git repository
		const isGitRepo = execSync('git rev-parse --git-dir', {
			stdio: 'pipe',
			encoding: 'utf-8',
			timeout: 2000,
		}).trim()

		if (!isGitRepo) {
			console.log('⚠️  Not in a git repository - using localhost database')
			return null
		}

		// Get current branch name
		const branchName = execSync('git rev-parse --abbrev-ref HEAD', {
			stdio: 'pipe',
			encoding: 'utf-8',
			timeout: 2000,
		}).trim()

		// Handle detached HEAD state
		if (branchName === 'HEAD') {
			console.log('⚠️  Detached HEAD state detected - using localhost database')
			return null
		}

		console.log(`📋 Detected git branch: ${branchName}`)
		return branchName
	} catch (error) {
		console.log(
			'⚠️  Git command failed - using localhost database:',
			error.message,
		)
		return null
	}
}

/**
 * Map git branch name to environment type
 *
 * Branch mapping rules:
 * - main/master: production
 * - develop/staging: staging
 * - feature/*: feature
 * - other: feature (fallback)
 */
function mapGitBranchToEnvironment(
	gitBranch: string,
): 'production' | 'staging' | 'feature' {
	const normalizedBranch = gitBranch.toLowerCase().trim()

	// Production branches
	if (['main', 'master'].includes(normalizedBranch)) {
		return 'production'
	}

	// Staging/develop branches
	if (['develop', 'development', 'staging'].includes(normalizedBranch)) {
		return 'staging'
	}

	// Feature branches (anything starting with feature/ or other branches)
	if (
		normalizedBranch.startsWith('feature/') ||
		normalizedBranch.includes('feature')
	) {
		return 'feature'
	}

	// Default to feature for any other branch
	console.log(
		`📋 Branch '${gitBranch}' mapped to feature environment (default)`,
	)
	return 'feature'
}

/**
 * Get the current environment type
 *
 * Hybrid approach: Detects GitHub Actions for automated branching + git branch detection for local development
 *
 * Priority order:
 * 1. GitHub Actions environment variables (highest priority)
 * 2. Explicit APP_ENV configuration
 * 3. Git branch detection (for local development)
 * 4. Development fallback
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

	// Local development: Detect git branch and map to environment
	if (appEnv === 'development' || !appEnv || appEnv === 'local') {
		const gitBranch = getCurrentGitBranch()

		if (gitBranch) {
			// Map git branch to environment type
			const mappedEnv = mapGitBranchToEnvironment(gitBranch)

			console.log(
				`🔄 Git branch '${gitBranch}' mapped to ${mappedEnv} environment`,
			)
			return mappedEnv
		}

		// No git branch detected - fall back to localhost
		console.log('🏠 No git branch detected - using localhost database')
	}

	return 'development'
}

/**
 * Get Neon branch configuration for the current environment
 *
 * Hybrid approach: Handles static branches, GitHub Actions dynamic branches, and git branch-based local development
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

	// Local development: git branch-based database selection
	if (envType === 'development' || envType === 'feature') {
		const gitBranch = getCurrentGitBranch()

		if (gitBranch) {
			const mappedEnv = mapGitBranchToEnvironment(gitBranch)

			// For production/staging git branches, use static branch names
			if (mappedEnv === 'production') {
				return NEON_BRANCH_CONFIG.production
			}

			if (mappedEnv === 'staging') {
				return NEON_BRANCH_CONFIG.staging
			}

			// For feature branches, use dynamic branch names based on git branch
			if (mappedEnv === 'feature') {
				const sanitizedBranchName = gitBranch
					.replace(/[^a-zA-Z0-9-_]/g, '-')
					.toLowerCase()
				return {
					branch: `feature/${sanitizedBranchName}`,
					description: `Local feature branch '${gitBranch}' database`,
				}
			}
		}

		// Fallback for when no git branch is detected
		if (envType === 'feature') {
			return NEON_BRANCH_CONFIG.feature
		}

		// For development without git branch detection
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
 * Get git repository status information
 */
function getGitStatus(): {
	isGitRepo: boolean
	currentBranch: string | null
	hasUncommittedChanges: boolean
	isDetachedHead: boolean
} {
	try {
		// Check if we're in a git repository
		const isGitRepo =
			execSync('git rev-parse --git-dir', {
				stdio: 'pipe',
				encoding: 'utf-8',
				timeout: 2000,
			}).trim() !== ''

		if (!isGitRepo) {
			return {
				isGitRepo: false,
				currentBranch: null,
				hasUncommittedChanges: false,
				isDetachedHead: false,
			}
		}

		// Get current branch name
		let currentBranch: string | null = null
		let isDetachedHead = false

		try {
			currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
				stdio: 'pipe',
				encoding: 'utf-8',
				timeout: 2000,
			}).trim()

			if (currentBranch === 'HEAD') {
				isDetachedHead = true
				currentBranch = null
			}
		} catch {
			isDetachedHead = true
		}

		// Check for uncommitted changes
		let hasUncommittedChanges = false
		try {
			const statusOutput = execSync('git status --porcelain', {
				stdio: 'pipe',
				encoding: 'utf-8',
				timeout: 2000,
			}).trim()
			hasUncommittedChanges = statusOutput.length > 0
		} catch {
			// If git status fails, assume no changes (safe fallback)
			hasUncommittedChanges = false
		}

		return {
			isGitRepo,
			currentBranch,
			hasUncommittedChanges,
			isDetachedHead,
		}
	} catch {
		return {
			isGitRepo: false,
			currentBranch: null,
			hasUncommittedChanges: false,
			isDetachedHead: false,
		}
	}
}

/**
 * Get comprehensive development environment information
 */
export function getDevelopmentEnvironmentInfo() {
	const envType = getEnvironmentType()
	const branchConfig = getNeonBranchConfig()
	const gitStatus = getGitStatus()
	const isGitHub = isGitHubActions()

	return {
		environment: {
			type: envType,
			appEnv: config.APP_ENV,
			nodeEnv: process.env.NODE_ENV,
		},
		database: {
			branch: branchConfig.branch,
			description: branchConfig.description,
			url: getNeonDatabaseUrl(),
		},
		git: {
			...gitStatus,
			mappedEnvironment: gitStatus.currentBranch
				? mapGitBranchToEnvironment(gitStatus.currentBranch)
				: null,
		},
		ci: {
			isGitHubActions: isGitHub,
			prNumber: isGitHub ? getGitHubPRNumber() : null,
			branchName: isGitHub ? getGitHubBranchName() : null,
		},
	}
}

/**
 * Log comprehensive environment information for debugging
 */
export function logEnvironmentInfo() {
	const info = getDevelopmentEnvironmentInfo()

	console.log('\n🌍 Development Environment Information:')
	console.log('=====================================')
	console.log(`Environment Type: ${info.environment.type}`)
	console.log(`APP_ENV: ${info.environment.appEnv}`)
	console.log(`NODE_ENV: ${info.environment.nodeEnv}`)
	console.log('')
	console.log('🗄️  Database Configuration:')
	console.log(`Branch: ${info.database.branch}`)
	console.log(`Description: ${info.database.description}`)
	console.log(`URL: ${info.database.url.replace(/:[^:]+@/, ':***@')}`) // Hide password
	console.log('')
	console.log('📋 Git Status:')
	console.log(`Is Git Repository: ${info.git.isGitRepo}`)
	console.log(`Current Branch: ${info.git.currentBranch || 'N/A'}`)
	console.log(`Has Uncommitted Changes: ${info.git.hasUncommittedChanges}`)
	console.log(`Is Detached HEAD: ${info.git.isDetachedHead}`)
	if (info.git.currentBranch && info.git.mappedEnvironment) {
		console.log(`Mapped Environment: ${info.git.mappedEnvironment}`)
	}
	console.log('')
	console.log('🤖 CI/CD Status:')
	console.log(`GitHub Actions: ${info.ci.isGitHubActions}`)
	if (info.ci.isGitHubActions) {
		console.log(`PR Number: ${info.ci.prNumber || 'N/A'}`)
		console.log(`Branch Name: ${info.ci.branchName || 'N/A'}`)
	}
	console.log('=====================================\n')
}

/**
 * Get all available branch configurations for reference
 */
export function getAllBranchConfigs() {
	const currentEnv = getEnvironmentType()
	const currentBranch = getNeonBranchConfig()
	const isGitHub = isGitHubActions()
	const gitStatus = getGitStatus()

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
		git: gitStatus,
		development: getDevelopmentEnvironmentInfo(),
	}
}
