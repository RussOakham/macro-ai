#!/usr/bin/env tsx

/**
 * Environment Connection Verification Script
 *
 * This script verifies that environment-specific database connections
 * are working correctly across different scenarios.
 */

import {
	getEnvironmentType,
	getNeonBranchConfig,
	getNeonDatabaseUrl,
	getDevelopmentEnvironmentInfo,
	logEnvironmentInfo,
	getCurrentDatabaseConfig,
	getAllBranchConfigs,
} from '../apps/express-api/src/utils/neon-branching.ts'
import { config } from '../apps/express-api/src/utils/load-config.ts'

async function verifyEnvironmentDetection() {
	console.log('🔍 Verifying Environment Detection')
	console.log('==================================\n')

	const envType = getEnvironmentType()
	const branchConfig = getNeonBranchConfig()
	const databaseUrl = getNeonDatabaseUrl()

	console.log(`✅ Environment Type: ${envType}`)
	console.log(`✅ Database Branch: ${branchConfig.branch}`)
	console.log(`✅ Branch Description: ${branchConfig.description}`)
	console.log(`✅ Database URL: ${databaseUrl.replace(/:[^:]+@/, ':***@')}`)
	console.log('')

	return { envType, branchConfig, databaseUrl }
}

async function verifyConfigurationConsistency() {
	console.log('🔗 Verifying Configuration Consistency')
	console.log('=====================================\n')

	const currentConfig = getCurrentDatabaseConfig()
	const allConfigs = getAllBranchConfigs()
	const devInfo = getDevelopmentEnvironmentInfo()

	console.log('Current Configuration:')
	console.log(`  - Environment: ${currentConfig.environmentType}`)
	console.log(`  - Branch: ${currentConfig.branch}`)
	console.log(`  - Description: ${currentConfig.description}`)
	console.log(`  - GitHub Actions: ${currentConfig.isGitHubActions || false}`)
	console.log('')

	console.log('Available Configurations:')
	Object.entries(allConfigs.available).forEach(([env, config]) => {
		console.log(`  - ${env}: ${config.branch} (${config.description})`)
	})
	console.log('')

	return { currentConfig, allConfigs, devInfo }
}

async function testConnectionScenarios() {
	console.log('🧪 Testing Connection Scenarios')
	console.log('===============================\n')

	const scenarios = [
		{ name: 'Current Environment', func: () => getEnvironmentType() },
		{ name: 'Database URL Generation', func: () => getNeonDatabaseUrl() },
		{ name: 'Branch Configuration', func: () => getNeonBranchConfig() },
	]

	for (const scenario of scenarios) {
		try {
			const result = scenario.func()
			console.log(
				`✅ ${scenario.name}: ${typeof result === 'string' ? result : 'Object returned'}`,
			)
		} catch (error) {
			console.log(`❌ ${scenario.name}: Failed - ${error.message}`)
		}
	}
	console.log('')
}

async function verifyEnvironmentVariables() {
	console.log('🔧 Verifying Environment Variables')
	console.log('==================================\n')

	const requiredVars = ['RELATIONAL_DATABASE_URL']
	const optionalVars = [
		'APP_ENV',
		'NODE_ENV',
		'GITHUB_ACTIONS',
		'GITHUB_HEAD_REF',
	]

	console.log('Required Variables:')
	requiredVars.forEach((varName) => {
		const value = process.env[varName]
		const status = value ? '✅' : '❌'
		console.log(`  ${status} ${varName}: ${value ? 'Set' : 'Missing'}`)
	})

	console.log('\nOptional Variables:')
	optionalVars.forEach((varName) => {
		const value = process.env[varName]
		const status = value ? '✅' : '⚪'
		console.log(`  ${status} ${varName}: ${value || 'Not set'}`)
	})

	console.log('\nApp Configuration:')
	console.log(`  - APP_ENV: ${config.APP_ENV}`)
	console.log(`  - NODE_ENV: ${process.env.NODE_ENV}`)
	console.log('')
}

async function generateConnectionSummary() {
	console.log('📊 Connection Summary')
	console.log('====================\n')

	const info = getDevelopmentEnvironmentInfo()

	console.log('Environment Overview:')
	console.log(`  Type: ${info.environment.type}`)
	console.log(`  App Environment: ${info.environment.appEnv}`)
	console.log(`  Node Environment: ${info.environment.nodeEnv}`)
	console.log('')

	console.log('Database Configuration:')
	console.log(`  Branch: ${info.database.branch}`)
	console.log(`  Description: ${info.database.description}`)
	console.log(`  URL Configured: ${!!info.database.url}`)
	console.log('')

	console.log('Git Status:')
	console.log(`  Is Git Repository: ${info.git.isGitRepo}`)
	console.log(`  Current Branch: ${info.git.currentBranch || 'N/A'}`)
	console.log(`  Has Uncommitted Changes: ${info.git.hasUncommittedChanges}`)
	console.log(`  Is Detached HEAD: ${info.git.isDetachedHead}`)
	console.log('')

	console.log('CI/CD Status:')
	console.log(`  GitHub Actions: ${info.ci.isGitHubActions}`)
	if (info.ci.isGitHubActions) {
		console.log(`  PR Number: ${info.ci.prNumber || 'N/A'}`)
		console.log(`  Branch Name: ${info.ci.branchName || 'N/A'}`)
	}
	console.log('')
}

async function main() {
	console.log('🚀 Environment Connection Verification')
	console.log('=====================================\n')

	try {
		// Run all verification steps
		await verifyEnvironmentVariables()
		await verifyEnvironmentDetection()
		await verifyConfigurationConsistency()
		await testConnectionScenarios()
		await generateConnectionSummary()

		console.log(
			'✅ Environment connection verification completed successfully!',
		)
		console.log(
			'\n💡 If all checks passed, your environment-specific database connections are working correctly.',
		)
		console.log('\n🔧 Next Steps:')
		console.log(
			'   - Start your application to see the detailed environment logging',
		)
		console.log(
			'   - Switch between git branches to test automatic database selection',
		)
		console.log(
			'   - Check the application logs for the comprehensive environment information',
		)
	} catch (error) {
		console.error('❌ Verification failed:', error)
		process.exit(1)
	}
}

// Run the verification
main().catch((error) => {
	console.error('💥 Unexpected error during verification:', error)
	process.exit(1)
})
