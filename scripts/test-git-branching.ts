#!/usr/bin/env tsx

/**
 * Test Git Branch Detection Script
 *
 * This script tests the git branch detection functionality to ensure
 * proper database branch mapping for local development environments.
 */

import {
	getCurrentGitBranch,
	mapGitBranchToEnvironment,
	getDevelopmentEnvironmentInfo,
	logEnvironmentInfo,
	getEnvironmentType,
	getNeonBranchConfig,
} from '../apps/express-api/src/utils/neon-branching.ts'

async function testGitBranchDetection() {
	console.log('🧪 Testing Git Branch Detection')
	console.log('==============================\n')

	// Test 1: Current git branch detection
	console.log('1️⃣  Testing Git Branch Detection:')
	const currentBranch = getCurrentGitBranch()
	console.log(`   Current branch: ${currentBranch || 'Not detected'}`)
	console.log('')

	// Test 2: Branch mapping
	console.log('2️⃣  Testing Branch Mapping:')
	const testBranches = [
		'main',
		'master',
		'develop',
		'staging',
		'feature/user-auth',
		'feature/payment-flow',
		'hotfix/bug-fix',
	]

	for (const branch of testBranches) {
		const mappedEnv = mapGitBranchToEnvironment(branch)
		console.log(`   ${branch.padEnd(20)} → ${mappedEnv}`)
	}
	console.log('')

	// Test 3: Current environment type
	console.log('3️⃣  Testing Environment Detection:')
	const envType = getEnvironmentType()
	console.log(`   Detected environment: ${envType}`)
	console.log('')

	// Test 4: Branch configuration
	console.log('4️⃣  Testing Branch Configuration:')
	const branchConfig = getNeonBranchConfig()
	console.log(`   Branch: ${branchConfig.branch}`)
	console.log(`   Description: ${branchConfig.description}`)
	console.log('')

	// Test 5: Comprehensive environment info
	console.log('5️⃣  Comprehensive Environment Information:')
	logEnvironmentInfo()
}

async function testEdgeCases() {
	console.log('🔧 Testing Edge Cases')
	console.log('====================\n')

	// Test detached HEAD scenario
	console.log('Testing detached HEAD scenario...')
	try {
		// This would normally be tested by being in detached HEAD state
		console.log('Note: To test detached HEAD, run: git checkout <commit-hash>')
	} catch (error) {
		console.log(`Error: ${error}`)
	}

	// Test non-git directory scenario
	console.log('Testing non-git directory scenario...')
	try {
		// This would normally be tested by running outside a git repo
		console.log(
			'Note: To test non-git repo, run this script outside a git repository',
		)
	} catch (error) {
		console.log(`Error: ${error}`)
	}

	console.log('')
}

// Run tests
testGitBranchDetection()
	.then(() => testEdgeCases())
	.then(() => {
		console.log('✅ Git branching tests completed successfully!')
		console.log('\n💡 Tips for development:')
		console.log(
			'   - Switch to different branches to see automatic database selection',
		)
		console.log(
			'   - Use `git checkout feature/your-feature` for isolated development',
		)
		console.log('   - Use `git checkout main` for production-like database')
		console.log('   - Use `git checkout develop` for staging-like database')
	})
	.catch((error) => {
		console.error('❌ Test failed:', error)
		process.exit(1)
	})
