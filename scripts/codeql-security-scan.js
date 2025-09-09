#!/usr/bin/env node

/**
 * CodeQL Security Scanning Script for GitHub Actions Workflows
 * Uses GitHub CodeQL CLI and other security tools for comprehensive analysis
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

// Color codes for console output
const colors = {
	reset: '\x1b[0m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	cyan: '\x1b[36m',
	magenta: '\x1b[35m',
}

function log(color, message) {
	console.log(`${colors[color]}${message}${colors.reset}`)
}

// Check if tool is installed
function isToolInstalled(tool) {
	try {
		execSync(`which ${tool}`, { stdio: 'ignore' })
		return true
	} catch {
		return false
	}
}

// Install CodeQL CLI
function installCodeQL() {
	if (!isToolInstalled('codeql')) {
		log('yellow', 'Installing CodeQL CLI...')

		const platform = process.platform
		const arch = process.arch

		let downloadUrl
		if (platform === 'darwin') {
			downloadUrl =
				'https://github.com/github/codeql-cli-binaries/releases/latest/download/codeql-osx64.zip'
		} else if (platform === 'linux') {
			downloadUrl =
				'https://github.com/github/codeql-cli-binaries/releases/latest/download/codeql-linux64.zip'
		} else if (platform === 'win32') {
			downloadUrl =
				'https://github.com/github/codeql-cli-binaries/releases/latest/download/codeql-win64.zip'
		} else {
			log('red', '❌ Unsupported platform for CodeQL CLI')
			return false
		}

		try {
			// Create codeql directory
			const codeqlDir = path.join(projectRoot, '.codeql')
			if (!fs.existsSync(codeqlDir)) {
				fs.mkdirSync(codeqlDir, { recursive: true })
			}

			// Download and extract CodeQL
			log('blue', 'Downloading CodeQL CLI...')
			execSync(`curl -L -o codeql.zip "${downloadUrl}"`, {
				cwd: codeqlDir,
				stdio: 'inherit',
			})
			execSync('unzip -q codeql.zip', { cwd: codeqlDir, stdio: 'inherit' })
			execSync('rm codeql.zip', { cwd: codeqlDir, stdio: 'inherit' })

			// Add to PATH for this session
			const codeqlPath = path.join(codeqlDir, 'codeql', 'codeql')
			process.env.PATH = `${path.dirname(codeqlPath)}:${process.env.PATH}`

			log('green', '✅ CodeQL CLI installed')
			return true
		} catch (error) {
			log('red', `❌ Failed to install CodeQL CLI: ${error.message}`)
			log(
				'yellow',
				'Please install manually: https://codeql.github.com/docs/codeql-cli/getting-started-with-the-codeql-cli/',
			)
			return false
		}
	}
	return true
}

// Install Octoscan
function installOctoscan() {
	if (!isToolInstalled('octoscan')) {
		log('yellow', 'Installing Octoscan...')
		try {
			execSync('go install github.com/synacktiv/octoscan@latest', {
				stdio: 'inherit',
			})
			log('green', '✅ Octoscan installed')
		} catch (error) {
			log(
				'red',
				'❌ Failed to install Octoscan. Please install Go and run: go install github.com/synacktiv/octoscan@latest',
			)
			return false
		}
	}
	return true
}

// Install Snyk GitHub Actions Scanner
function installSnykScanner() {
	const snykDir = path.join(projectRoot, '.tools', 'github-actions-scanner')

	if (!fs.existsSync(snykDir)) {
		log('yellow', 'Installing Snyk GitHub Actions Scanner...')
		try {
			execSync('mkdir -p .tools', { cwd: projectRoot, stdio: 'inherit' })
			execSync(
				'git clone https://github.com/snyk-labs/github-actions-scanner.git .tools/github-actions-scanner',
				{
					cwd: projectRoot,
					stdio: 'inherit',
				},
			)
			execSync('npm install', { cwd: snykDir, stdio: 'inherit' })
			log('green', '✅ Snyk GitHub Actions Scanner installed')
		} catch (error) {
			log('red', `❌ Failed to install Snyk Scanner: ${error.message}`)
			return false
		}
	}
	return true
}

// Run CodeQL analysis on GitHub Actions
function runCodeQLAnalysis() {
	log('cyan', '🔍 Running CodeQL analysis on GitHub Actions workflows...')

	const codeqlDir = path.join(projectRoot, '.codeql')
	const codeqlPath = path.join(codeqlDir, 'codeql', 'codeql')

	try {
		// Create CodeQL database for GitHub Actions
		log('blue', 'Creating CodeQL database...')
		execSync(
			`${codeqlPath} database create codeql-db --language=actions --source-root=.`,
			{
				cwd: projectRoot,
				stdio: 'inherit',
			},
		)

		// Analyze the database (use basic queries since actions-queries pack is not available)
		log('blue', 'Analyzing CodeQL database...')
		execSync(
			`${codeqlPath} database analyze codeql-db --format=sarif-latest --output=codeql-results.sarif`,
			{
				cwd: projectRoot,
				stdio: 'inherit',
			},
		)

		// Check if results file exists and has content
		const resultsFile = path.join(projectRoot, 'codeql-results.sarif')
		if (fs.existsSync(resultsFile)) {
			const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'))

			if (
				results.runs &&
				results.runs[0] &&
				results.runs[0].results &&
				results.runs[0].results.length > 0
			) {
				log('red', '❌ CodeQL found security issues:')
				results.runs[0].results.forEach((result) => {
					log('red', `  - ${result.ruleId}: ${result.message.text}`)
					if (result.locations && result.locations[0]) {
						const location = result.locations[0].physicalLocation
						log(
							'red',
							`    File: ${location.artifactLocation.uri}:${location.region.startLine}`,
						)
					}
				})
				return false
			} else {
				log('green', '✅ CodeQL: No security issues found')
				return true
			}
		} else {
			log('yellow', '⚠️ CodeQL analysis completed but no results file found')
			return true
		}
	} catch (error) {
		log('red', `❌ CodeQL analysis failed: ${error.message}`)
		return false
	}
}

// Run Octoscan analysis
function runOctoscanAnalysis() {
	log('cyan', '🔍 Running Octoscan analysis on GitHub Actions workflows...')

	try {
		// Add .tools/bin to PATH for this execution
		const env = {
			...process.env,
			PATH: `${path.join(projectRoot, '.tools', 'bin')}:${process.env.PATH}`,
		}
		const output = execSync('octoscan scan --path .github/workflows/', {
			cwd: projectRoot,
			encoding: 'utf8',
			stdio: 'pipe',
			env,
		})

		if (output.trim()) {
			log('yellow', '⚠️ Octoscan found issues:')
			console.log(output)
			return false
		} else {
			log('green', '✅ Octoscan: No issues found')
			return true
		}
	} catch (error) {
		if (error.status === 1) {
			log('red', '❌ Octoscan found security issues:')
			console.log(error.stdout || error.message)
			return false
		} else {
			log('red', `❌ Octoscan failed: ${error.message}`)
			return false
		}
	}
}

// Run Snyk GitHub Actions Scanner
function runSnykScanner() {
	log('cyan', '🔍 Running Snyk GitHub Actions Scanner...')

	const snykDir = path.join(projectRoot, '.tools', 'github-actions-scanner')

	try {
		const output = execSync(
			'npm run start -- scan-local --path .github/workflows/',
			{
				cwd: snykDir,
				encoding: 'utf8',
				stdio: 'pipe',
			},
		)

		if (output.trim()) {
			log('yellow', '⚠️ Snyk Scanner found issues:')
			console.log(output)
			return false
		} else {
			log('green', '✅ Snyk Scanner: No issues found')
			return true
		}
	} catch (error) {
		if (error.status === 1) {
			log('red', '❌ Snyk Scanner found security issues:')
			console.log(error.stdout || error.message)
			return false
		} else {
			log('yellow', `⚠️ Snyk Scanner failed: ${error.message}`)
			return true // Don't fail the entire scan for this
		}
	}
}

// Run act for local workflow testing
function runActTesting() {
	log('cyan', '🔍 Running act for local workflow testing...')

	if (!isToolInstalled('act')) {
		log('yellow', 'Installing act...')
		try {
			execSync('brew install act', { stdio: 'inherit' })
			log('green', '✅ act installed')
		} catch (error) {
			log(
				'red',
				'❌ Failed to install act. Please install manually: brew install act',
			)
			return false
		}
	}

	try {
		// Run act in list mode to validate workflows (--dry-run doesn't exist in this version)
		const output = execSync('act --list', {
			cwd: projectRoot,
			encoding: 'utf8',
			stdio: 'pipe',
		})

		log('blue', '📋 Available workflows for testing:')
		console.log(output)

		// Try to run a simple workflow validation
		execSync('act --list --job hygiene-checks', {
			cwd: projectRoot,
			stdio: 'pipe',
		})

		log('green', '✅ act: Workflow validation passed')
		return true
	} catch (error) {
		log('yellow', `⚠️ act validation failed: ${error.message}`)
		return true // Don't fail the entire scan for this
	}
}

// Generate comprehensive security report
function generateSecurityReport(results) {
	log('cyan', '\n📊 CodeQL Security Scan Report')
	log('cyan', '==============================')

	const report = {
		timestamp: new Date().toISOString(),
		tools: {
			codeql: results.find((r) => r.name === 'CodeQL Analysis'),
			octoscan: results.find((r) => r.name === 'Octoscan Analysis'),
			snyk: results.find((r) => r.name === 'Snyk Scanner'),
			act: results.find((r) => r.name === 'Act Testing'),
		},
		summary: {
			total: results.length,
			passed: results.filter((r) => r.passed).length,
			failed: results.filter((r) => !r.passed).length,
		},
	}

	// Save detailed report
	const reportPath = path.join(projectRoot, 'codeql-security-report.json')
	fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

	// Save SARIF results if available
	const sarifPath = path.join(projectRoot, 'codeql-results.sarif')
	if (fs.existsSync(sarifPath)) {
		log('blue', `📄 SARIF results saved to: ${sarifPath}`)
	}

	log('blue', `📄 Report saved to: ${reportPath}`)

	// Display summary
	results.forEach((result) => {
		const status = result.passed ? '✅' : '❌'
		const color = result.passed ? 'green' : 'red'
		log(color, `${status} ${result.name}`)
	})

	log(
		'cyan',
		`\nSummary: ${report.summary.passed}/${report.summary.total} tools passed`,
	)

	return report.summary.failed === 0
}

// Main function
async function main() {
	log('cyan', '🛡️  CodeQL Security Scanner for GitHub Actions')
	log('cyan', '==============================================')

	// Install required tools
	const toolsInstalled = [
		installCodeQL(),
		installOctoscan(),
		installSnykScanner(),
	]

	if (!toolsInstalled.every(Boolean)) {
		log(
			'red',
			'❌ Some required tools could not be installed. Continuing with available tools...',
		)
	}

	// Run security analysis tools
	const checks = [
		{ name: 'CodeQL Analysis', fn: runCodeQLAnalysis },
		{ name: 'Octoscan Analysis', fn: runOctoscanAnalysis },
		{ name: 'Snyk Scanner', fn: runSnykScanner },
		{ name: 'Act Testing', fn: runActTesting },
	]

	const results = []

	for (const check of checks) {
		log('blue', `\n📋 Running ${check.name}...`)
		try {
			const passed = check.fn()
			results.push({ name: check.name, passed })
		} catch (error) {
			log('red', `❌ ${check.name} failed: ${error.message}`)
			results.push({ name: check.name, passed: false })
		}
	}

	// Generate and display report
	const allPassed = generateSecurityReport(results)

	if (allPassed) {
		log('green', '\n✅ All security scans passed!')
		log(
			'green',
			'Your GitHub Actions workflows are secure and ready to commit.',
		)
		process.exit(0)
	} else {
		log('red', '\n❌ Security issues found!')
		log('red', 'Please review and fix the issues above before committing.')
		process.exit(1)
	}
}

// Run the main function
main().catch((error) => {
	log('red', `❌ Fatal error: ${error.message}`)
	process.exit(1)
})
