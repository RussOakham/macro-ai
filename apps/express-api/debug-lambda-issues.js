#!/usr/bin/env node

/**
 * Lambda Issue Debugging Script
 * Comprehensive analysis of potential Lambda deployment issues
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Environment setup for staging simulation
process.env.AWS_LAMBDA_FUNCTION_NAME = 'macro-ai-staging-api'
process.env.NODE_ENV = 'production'
process.env.ENVIRONMENT = 'staging'

async function debugLambdaIssues() {
	console.log('🔍 Lambda Issue Debugging Analysis')
	console.log('='.repeat(50))

	const issues = []
	const checks = []

	try {
		// Check 1: Bundle File Analysis
		console.log('\n📦 1. Bundle File Analysis')
		const bundlePath = path.join(__dirname, 'dist', 'lambda.bundle.cjs')

		if (!fs.existsSync(bundlePath)) {
			issues.push('❌ Lambda bundle file missing: ' + bundlePath)
			return { issues, checks }
		}

		const bundleStats = fs.statSync(bundlePath)
		const bundleSize = bundleStats.size
		checks.push(`✅ Bundle exists: ${(bundleSize / 1024 / 1024).toFixed(2)} MB`)

		if (bundleSize > 50 * 1024 * 1024) {
			// 50MB limit
			issues.push('⚠️ Bundle size exceeds Lambda limit (50MB)')
		}

		// Check 2: Bundle Content Analysis
		console.log('\n🔍 2. Bundle Content Analysis')
		const bundleContent = fs.readFileSync(bundlePath, 'utf8')

		// Check for pino-pretty references
		if (bundleContent.includes('pino-pretty')) {
			issues.push('❌ Bundle still contains pino-pretty references')
		} else {
			checks.push('✅ No pino-pretty references found in bundle')
		}

		// Check for proper exports
		if (bundleContent.includes('module.exports')) {
			checks.push('✅ CommonJS exports found in bundle')
		} else {
			issues.push('❌ No CommonJS exports found in bundle')
		}

		// Check for handler export
		if (bundleContent.includes('handler')) {
			checks.push('✅ Handler export found in bundle')
		} else {
			issues.push('❌ No handler export found in bundle')
		}

		// Check 3: Module Loading Test
		console.log('\n🧪 3. Module Loading Test')
		try {
			// Use dynamic import for CommonJS modules in ES module context
			const { createRequire } = await import('module')
			const require = createRequire(import.meta.url)
			const lambdaModule = require(bundlePath)
			checks.push('✅ Module loads without errors')

			if (typeof lambdaModule.handler === 'function') {
				checks.push('✅ Handler is a function')
			} else {
				issues.push(
					'❌ Handler is not a function: ' + typeof lambdaModule.handler,
				)
			}

			const exports = Object.keys(lambdaModule)
			checks.push(`✅ Available exports: ${exports.join(', ')}`)
		} catch (error) {
			issues.push('❌ Module loading failed: ' + error.message)
			issues.push('📍 Stack: ' + error.stack.split('\n')[0])
		}

		// Check 4: Environment Variables Analysis
		console.log('\n🌍 4. Environment Variables Analysis')
		const requiredEnvVars = [
			'NODE_ENV',
			'AWS_LAMBDA_FUNCTION_NAME',
			'POWERTOOLS_SERVICE_NAME',
		]

		requiredEnvVars.forEach((envVar) => {
			if (process.env[envVar]) {
				checks.push(`✅ ${envVar}: ${process.env[envVar]}`)
			} else {
				issues.push(`❌ Missing environment variable: ${envVar}`)
			}
		})

		// Check 5: Dependencies Analysis
		console.log('\n📚 5. Dependencies Analysis')
		const packageJsonPath = path.join(__dirname, 'package.json')
		if (fs.existsSync(packageJsonPath)) {
			const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

			// Check for problematic dependencies
			const problematicDeps = ['pino-pretty']
			const dependencies = {
				...packageJson.dependencies,
				...packageJson.devDependencies,
			}

			problematicDeps.forEach((dep) => {
				if (dependencies[dep]) {
					issues.push(
						`⚠️ Problematic dependency found: ${dep}@${dependencies[dep]}`,
					)
				} else {
					checks.push(`✅ No ${dep} dependency found`)
				}
			})

			// Check for required dependencies
			const requiredDeps = ['serverless-http', 'express', 'pino']
			requiredDeps.forEach((dep) => {
				if (dependencies[dep]) {
					checks.push(`✅ Required dependency: ${dep}@${dependencies[dep]}`)
				} else {
					issues.push(`❌ Missing required dependency: ${dep}`)
				}
			})
		}

		// Check 6: Configuration Files
		console.log('\n⚙️ 6. Configuration Files Analysis')
		const configFiles = ['.env', '.env.example']
		configFiles.forEach((file) => {
			const filePath = path.join(__dirname, file)
			if (fs.existsSync(filePath)) {
				checks.push(`✅ Config file exists: ${file}`)
			} else {
				issues.push(`⚠️ Config file missing: ${file}`)
			}
		})

		// Check 7: Build Artifacts
		console.log('\n🏗️ 7. Build Artifacts Analysis')
		const distPath = path.join(__dirname, 'dist')
		if (fs.existsSync(distPath)) {
			const distFiles = fs.readdirSync(distPath)
			checks.push(`✅ Dist directory contains: ${distFiles.join(', ')}`)

			// Check for old artifacts
			const oldArtifacts = distFiles.filter((file) => file.includes('.mjs'))
			if (oldArtifacts.length > 0) {
				issues.push(`⚠️ Old .mjs artifacts found: ${oldArtifacts.join(', ')}`)
			} else {
				checks.push('✅ No old .mjs artifacts found')
			}
		} else {
			issues.push('❌ Dist directory missing')
		}
	} catch (error) {
		issues.push('💥 Debugging script error: ' + error.message)
	}

	return { issues, checks }
}

async function generateReport() {
	console.log('🚀 Starting Lambda Debugging Analysis...\n')

	const { issues, checks } = await debugLambdaIssues()

	console.log('\n📊 DEBUGGING REPORT')
	console.log('='.repeat(50))

	console.log('\n✅ SUCCESSFUL CHECKS:')
	if (checks.length === 0) {
		console.log('   No successful checks found')
	} else {
		checks.forEach((check) => console.log('   ' + check))
	}

	console.log('\n❌ ISSUES FOUND:')
	if (issues.length === 0) {
		console.log('   🎉 No issues detected!')
	} else {
		issues.forEach((issue) => console.log('   ' + issue))
	}

	console.log('\n🎯 RECOMMENDATIONS:')
	if (issues.length === 0) {
		console.log(
			'   ✅ Bundle appears healthy - check CloudWatch logs for runtime errors',
		)
		console.log('   ✅ Run local Lambda test: node local-lambda-test.js')
	} else {
		console.log('   🔧 Fix the issues listed above')
		console.log('   🔄 Rebuild Lambda bundle: pnpm run package:lambda')
		console.log('   🧪 Test locally: node local-lambda-test.js')
	}

	console.log('\n📋 NEXT STEPS:')
	console.log('   1. Fix any issues found above')
	console.log('   2. Run: node local-lambda-test.js')
	console.log('   3. Check CloudWatch logs for runtime errors')
	console.log('   4. Test API endpoints directly')

	return { issues: issues.length, checks: checks.length }
}

// Run the analysis
if (import.meta.url === `file://${process.argv[1]}`) {
	generateReport()
		.then(({ issues, checks }) => {
			console.log(
				`\n📈 Summary: ${checks} checks passed, ${issues} issues found`,
			)
			process.exit(issues > 0 ? 1 : 0)
		})
		.catch((error) => {
			console.error('\n💥 Analysis failed:', error)
			process.exit(1)
		})
}

export { debugLambdaIssues }
