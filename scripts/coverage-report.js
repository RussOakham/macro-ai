#!/usr/bin/env node

/**
 * Coverage Report Aggregator
 *
 * Collects and displays coverage reports from all packages in the monorepo.
 * Reads coverage-summary.json files from each package and displays a unified table.
 * Supports multiple output formats for different use cases.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ANSI color codes for terminal output
const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m',
	white: '\x1b[37m',
}

/**
 * Determine package type based on repository layout/structure
 * @param {string} packageName - The package name to classify
 * @returns {'app' | 'package'} - The package type
 */
function determinePackageType(packageName) {
	const repoRoot = path.join(__dirname, '..')

	// Check if package exists in apps/ directory
	const appsPath = path.join(repoRoot, 'apps', packageName)
	if (fs.existsSync(appsPath)) {
		const packageJsonPath = path.join(appsPath, 'package.json')
		if (fs.existsSync(packageJsonPath)) {
			return 'app'
		}
	}

	// Check if package exists in packages/ directory
	const packagesPath = path.join(repoRoot, 'packages', packageName)
	if (fs.existsSync(packagesPath)) {
		const packageJsonPath = path.join(packagesPath, 'package.json')
		if (fs.existsSync(packageJsonPath)) {
			return 'package'
		}
	}

	// Additional checks for packages that might have different directory structures
	// Look for express/ui subfolders or app-like characteristics
	const potentialPaths = [
		path.join(repoRoot, 'apps', packageName),
		path.join(repoRoot, 'packages', packageName),
		// Handle potential nested structures
		path.join(repoRoot, packageName),
	]

	for (const pkgPath of potentialPaths) {
		if (fs.existsSync(pkgPath)) {
			// Check if it contains express or ui subfolders (indicates app)
			const hasExpressFolder = fs.existsSync(path.join(pkgPath, 'express'))
			const hasUiFolder = fs.existsSync(path.join(pkgPath, 'ui'))

			if (hasExpressFolder || hasUiFolder) {
				return 'app'
			}

			// Check if the path indicates it's under apps/ directory
			if (pkgPath.includes(path.join(repoRoot, 'apps'))) {
				return 'app'
			}
		}
	}

	// Default to 'package' if we can't determine otherwise
	return 'package'
}

/**
 * Find all coverage-summary.json files in the monorepo
 */
function findCoverageReports() {
	const reports = []

	// Check coverage-reports directory first (used in CI)
	const coverageReportsDir = path.join(__dirname, '..', 'coverage-reports')
	const processedPackages = new Set()

	if (fs.existsSync(coverageReportsDir)) {
		const packages = fs.readdirSync(coverageReportsDir)
		for (const pkg of packages) {
			const coveragePath = path.join(
				coverageReportsDir,
				pkg,
				'coverage-summary.json',
			)
			if (fs.existsSync(coveragePath)) {
				// Determine type based on repository layout/structure
				const type = determinePackageType(pkg)
				reports.push({
					name: pkg,
					path: coveragePath,
					type: type,
				})
				processedPackages.add(pkg)
			}
		}
	}

	// Apps directory (fallback for local development, skip if already processed)
	const appsDir = path.join(__dirname, '..', 'apps')
	if (fs.existsSync(appsDir)) {
		const apps = fs.readdirSync(appsDir)
		for (const app of apps) {
			if (processedPackages.has(app)) continue // Skip if already processed from coverage-reports
			const coveragePath = path.join(
				appsDir,
				app,
				'coverage',
				'coverage-summary.json',
			)
			if (fs.existsSync(coveragePath)) {
				reports.push({
					name: app,
					path: coveragePath,
					type: 'app',
				})
			}
		}
	}

	// Packages directory (fallback for local development, skip if already processed)
	const packagesDir = path.join(__dirname, '..', 'packages')
	if (fs.existsSync(packagesDir)) {
		const packages = fs.readdirSync(packagesDir)
		for (const pkg of packages) {
			if (processedPackages.has(pkg)) continue // Skip if already processed from coverage-reports
			const coveragePath = path.join(
				packagesDir,
				pkg,
				'coverage',
				'coverage-summary.json',
			)
			if (fs.existsSync(coveragePath)) {
				reports.push({
					name: pkg,
					path: coveragePath,
					type: 'package',
				})
			}
		}
	}

	return reports
}

/**
 * Read and parse coverage summary JSON
 */
function readCoverageReport(reportPath) {
	try {
		const content = fs.readFileSync(reportPath, 'utf-8')
		return JSON.parse(content)
	} catch (error) {
		console.error(`Error reading coverage report ${reportPath}:`, error.message)
		return null
	}
}

/**
 * Get color based on coverage percentage
 */
function getCoverageColor(percentage) {
	if (percentage >= 80) return colors.green
	if (percentage >= 60) return colors.yellow
	if (percentage >= 40) return colors.magenta
	return colors.red
}

/**
 * Format percentage with color
 */
function formatPercentage(percentage) {
	const color = getCoverageColor(percentage)
	const formatted = percentage.toFixed(1)
	return `${color}${formatted}%${colors.reset}`
}

/**
 * Generate table row for a package
 */
function generateTableRow(name, type, total, coverage) {
	const typeIcon = type === 'app' ? '📱' : '📦'
	const statements = formatPercentage(coverage.statements.pct)
	const branches = formatPercentage(coverage.branches.pct)
	const functions = formatPercentage(coverage.functions.pct)
	const lines = formatPercentage(coverage.lines.pct)

	return `${typeIcon} ${name.padEnd(20)} ${total.toString().padStart(6)} ${statements.padStart(8)} ${branches.padStart(8)} ${functions.padStart(8)} ${lines.padStart(8)}`
}

/**
 * Calculate totals across all packages
 */
function calculateTotals(reports, testResults = null) {
	let totalTests = 0
	let totalStatements = 0
	let totalBranches = 0
	let totalFunctions = 0
	let totalLines = 0
	let totalStatementsCovered = 0
	let totalBranchesCovered = 0
	let totalFunctionsCovered = 0
	let totalLinesCovered = 0

	for (const report of reports) {
		const data = report.data
		if (!data || !data.total) continue

		// Get test count from JUnit results instead of coverage JSON
		const testResult = testResults?.get(report.name)
		const testCount = testResult?.tests || 0
		totalTests += testCount

		totalStatements += data.total.statements.total
		totalBranches += data.total.branches.total
		totalFunctions += data.total.functions.total
		totalLines += data.total.lines.total
		totalStatementsCovered += data.total.statements.covered
		totalBranchesCovered += data.total.branches.covered
		totalFunctionsCovered += data.total.functions.covered
		totalLinesCovered += data.total.lines.covered
	}

	const statementsPct =
		totalStatements > 0 ? (totalStatementsCovered / totalStatements) * 100 : 0
	const branchesPct =
		totalBranches > 0 ? (totalBranchesCovered / totalBranches) * 100 : 0
	const functionsPct =
		totalFunctions > 0 ? (totalFunctionsCovered / totalFunctions) * 100 : 0
	const linesPct = totalLines > 0 ? (totalLinesCovered / totalLines) * 100 : 0

	return {
		tests: totalTests,
		statements: statementsPct,
		branches: branchesPct,
		functions: functionsPct,
		lines: linesPct,
	}
}

/**
 * Find JUnit test results to extract test counts
 */
function findTestResults() {
	const testResults = new Map()

	// Check test-results-organized directory first (used in CI after artifact processing)
	const testResultsOrganizedDir = path.join(
		__dirname,
		'..',
		'test-results-organized',
	)
	if (fs.existsSync(testResultsOrganizedDir)) {
		const packages = fs.readdirSync(testResultsOrganizedDir)
		for (const pkg of packages) {
			const junitPath = path.join(
				testResultsOrganizedDir,
				pkg,
				'test-results.xml',
			)
			if (fs.existsSync(junitPath)) {
				const result = parseJUnitFile(junitPath)
				if (result) testResults.set(pkg, result)
			}
		}
	}

	// Fallback: Check test-results directory (used in CI before artifact processing)
	const testResultsDir = path.join(__dirname, '..', 'test-results')
	if (fs.existsSync(testResultsDir)) {
		const stack = [testResultsDir]
		while (stack.length) {
			const dir = stack.pop()
			const entries = fs.readdirSync(dir, { withFileTypes: true })
			for (const e of entries) {
				const full = path.join(dir, e.name)
				if (e.isDirectory()) {
					stack.push(full)
				} else if (e.isFile() && e.name === 'test-results.xml') {
					// Extract package name from the full path structure
					// Path structure: test-results/test-results-{package}-{run_id}-{name}/{package}/test-results.xml
					const pathParts = full.split(path.sep)
					const packageIndex = pathParts.findIndex(
						(part) =>
							part.startsWith('test-results-') && part !== 'test-results',
					)
					if (packageIndex !== -1) {
						// Extract package name from artifact name like "test-results-apps-express-api-123456-Unit-Tests"
						const artifactName = pathParts[packageIndex]
						let pkgName = artifactName
							.replace(/^test-results-/, '')
							.replace(/-\d+-.*$/, '')
						// If it starts with apps/ or packages/, extract the actual package name
						if (pkgName.startsWith('apps-') || pkgName.startsWith('packages-')) {
							pkgName = pkgName.replace(/^(apps|packages)-/, '')
						}
						const result = parseJUnitFile(full)
						if (result) testResults.set(pkgName, result)
					} else {
						// Fallback: use directory name
						const pkgName = path.basename(path.dirname(full))
						const result = parseJUnitFile(full)
						if (result) testResults.set(pkgName, result)
					}
				}
			}
		}
	}

	return testResults
}

/**
 * Parse JUnit XML file for test results
 */
function parseJUnitFile(filePath) {
	try {
		const content = fs.readFileSync(filePath, 'utf-8')

		// Extract basic test information
		const testsMatch = content.match(/tests="(\d+)"/)
		const failuresMatch = content.match(/failures="(\d+)"/)
		const errorsMatch = content.match(/errors="(\d+)"/)
		const timeMatch = content.match(/time="([\d.]+)"/)

		if (testsMatch) {
			const tests = parseInt(testsMatch[1]) || 0
			const failures = parseInt(failuresMatch?.[1] || '0') || 0
			const errors = parseInt(errorsMatch?.[1] || '0') || 0
			const time = parseFloat(timeMatch?.[1] || '0') || 0

			return {
				tests,
				failures: failures + errors,
				passed: tests - (failures + errors),
				time,
				success: failures + errors === 0,
			}
		}
	} catch (error) {
		console.warn(`Failed to parse JUnit file ${filePath}:`, error.message)
	}

	return null
}

/**
 * Generate PR-friendly Markdown output
 */
function generateMarkdownOutput(reportData, totals) {
	const testResults = findTestResults()

	let output = '# 🧪 Test Execution & Coverage Report\n\n'

	// Test Results Section
	output += '## Test Results Summary\n\n'
	output += '| Package | Type | Status | Tests | Passed | Failed | Duration |\n'
	output += '|---------|------|--------|-------|--------|--------|----------|\n'

	let totalTests = 0
	let totalPassed = 0
	let totalFailed = 0
	let allTestsPass = true

	for (const report of reportData) {
		const testResult = testResults.get(report.name)
		const tests = testResult?.tests || report.data.total.tests || 0
		const passed = testResult?.passed || tests
		const failed = testResult?.failures || 0
		const duration = testResult?.time ? `${testResult.time.toFixed(1)}s` : 'N/A'
		const status = testResult?.success !== false ? '✅ PASS' : '❌ FAIL'

		if (failed > 0) allTestsPass = false

		totalTests += tests
		totalPassed += passed
		totalFailed += failed

		output += `| ${report.name} | ${report.type === 'app' ? '📱 App' : '📦 Package'} | ${status} | ${tests} | ${passed} | ${failed} | ${duration} |\n`
	}

	output += `| **TOTAL** | **Overall** | ${allTestsPass ? '**✅ PASS**' : '**❌ FAIL**'} | **${totalTests}** | **${totalPassed}** | **${totalFailed}** | **-** |\n\n`

	// Coverage Section
	output += '## Coverage Summary\n\n'
	output += '| Package | Type | Statements | Branches | Functions | Lines |\n'
	output += '|---------|------|------------|----------|-----------|-------|\n'

	for (const report of reportData) {
		output += `| ${report.name} | ${report.type === 'app' ? '📱 App' : '📦 Package'} | `
		output += `${report.data.total.statements.pct.toFixed(1)}% | `
		output += `${report.data.total.branches.pct.toFixed(1)}% | `
		output += `${report.data.total.functions.pct.toFixed(1)}% | `
		output += `${report.data.total.lines.pct.toFixed(1)}% |\n`
	}

	// Add coverage totals row
	output += `| **TOTAL** | **Overall** | `
	output += `**${totals.statements.toFixed(1)}%** | `
	output += `**${totals.branches.toFixed(1)}%** | `
	output += `**${totals.functions.toFixed(1)}%** | `
	output += `**${totals.lines.toFixed(1)}%** |\n\n`

	output += '## Coverage Thresholds\n\n'
	output += '- **Express API**: 80% (Statements, Branches, Functions, Lines)\n'
	output += '- **API Client**: 80% (Statements, Branches, Functions, Lines)  \n'
	output += '- **Client UI**: 30% (Statements, Branches, Functions, Lines)\n\n'

	output += '## Files\n\n'
	output +=
		"- 📁 Coverage reports saved in each package's `coverage/` directory\n"
	output += '- 📄 Individual reports: `coverage/coverage-summary.json`\n'
	output += '- 📊 Detailed reports: `coverage/lcov-report/index.html`\n'
	output += '- 🧪 Test results: `test-results.xml` (JUnit format)\n\n'

	output += '---\n'
	output += `*Generated on ${new Date().toISOString()} by Enhanced Testing Workflow*`

	return output
}

/**
 * Generate JSON output for CI/CD integration
 */
function generateJsonOutput(reportData, totals, testResults = null) {
	const output = {
		summary: {
			totalPackages: reportData.length,
			totalTests: totals.tests,
			overallCoverage: {
				statements: totals.statements,
				branches: totals.branches,
				functions: totals.functions,
				lines: totals.lines,
			},
		},
		packages: reportData.map((report) => {
			// Get test count from JUnit results instead of coverage JSON
			const testResult = testResults?.get(report.name)
			const testCount = testResult?.tests || 0

			return {
				name: report.name,
				type: report.type,
				tests: testCount,
				coverage: {
					statements: report.data.total.statements.pct,
					branches: report.data.total.branches.pct,
					functions: report.data.total.functions.pct,
					lines: report.data.total.lines.pct,
				},
			}
		}),
		generatedAt: new Date().toISOString(),
	}

	return JSON.stringify(output, null, 2)
}

/**
 * Main function
 */
function main() {
	const args = process.argv.slice(2)
	const format = args.includes('--json')
		? 'json'
		: args.includes('--markdown')
			? 'markdown'
			: 'console'

	const reports = findCoverageReports()

	if (reports.length === 0) {
		if (format === 'console') {
			console.log(`${colors.yellow}No coverage reports found.${colors.reset}`)
			console.log(
				`Run tests with coverage in each package to generate reports.`,
			)
		} else if (format === 'json') {
			console.log(JSON.stringify({ error: 'No coverage reports found' }))
		} else {
			console.log(
				'# 📊 Test Coverage Report\n\nNo coverage reports found. Run tests with coverage first.',
			)
		}
		process.exit(0)
	}

	// Read all reports
	const reportData = []
	for (const report of reports) {
		const data = readCoverageReport(report.path)
		if (data && data.total) {
			reportData.push({
				...report,
				data,
			})
		}
	}

	// Debug: Show what coverage reports were found
	if (format === 'markdown') {
		console.error('🔍 Debug: Coverage reports found:')
		for (const report of reportData) {
			console.error(`  - ${report.name} (${report.type}): ${report.path}`)
		}
		console.error(`Total packages with coverage: ${reportData.length}`)
	}

	if (reportData.length === 0) {
		if (format === 'console') {
			console.log(
				`${colors.red}No valid coverage reports found.${colors.reset}`,
			)
		} else if (format === 'json') {
			console.log(JSON.stringify({ error: 'No valid coverage reports found' }))
		} else {
			console.log(
				'# 📊 Test Coverage Report\n\nNo valid coverage reports found.',
			)
		}
		process.exit(1)
	}

	// Get test results from JUnit files for accurate test counts
	const testResults = findTestResults()

	// Debug: Show what test results were found
	if (format === 'markdown') {
		console.error('🔍 Debug: Test results found:')
		for (const [pkg, result] of testResults) {
			console.error(
				`  - ${pkg}: ${result.tests} tests, ${result.passed} passed, ${result.failures} failed`,
			)
		}
		console.error(`Total packages with test results: ${testResults.size}`)
	}

	const totals = calculateTotals(reportData, testResults)

	// Output based on format
	if (format === 'json') {
		console.log(generateJsonOutput(reportData, totals, testResults))
	} else if (format === 'markdown') {
		console.log(generateMarkdownOutput(reportData, totals))
	} else {
		// Console output (default)
		console.log(
			`${colors.bright}${colors.cyan}📊 Monorepo Coverage Report${colors.reset}\n`,
		)

		// Print header
		console.log(
			`${colors.bright}Package/Type${colors.reset}`.padEnd(22) +
				`${colors.bright}Tests${colors.reset}`.padStart(6) +
				`${colors.bright}Statements${colors.reset}`.padStart(10) +
				`${colors.bright}Branches${colors.reset}`.padStart(10) +
				`${colors.bright}Functions${colors.reset}`.padStart(10) +
				`${colors.bright}Lines${colors.reset}`.padStart(10),
		)
		console.log('─'.repeat(70))

		// Print each package
		for (const report of reportData) {
			// Get test count from JUnit results instead of coverage JSON
			const testResult = testResults.get(report.name)
			const testCount = testResult?.tests || 0

			const row = generateTableRow(
				report.name,
				report.type,
				testCount,
				report.data.total,
			)
			console.log(row)
		}

		// Print totals
		console.log('─'.repeat(70))
		const totalRow = generateTableRow('TOTAL', 'total', totals.tests, {
			statements: { pct: totals.statements },
			branches: { pct: totals.branches },
			functions: { pct: totals.functions },
			lines: { pct: totals.lines },
		})
		console.log(`${colors.bright}${totalRow}${colors.reset}`)

		console.log(
			`\n${colors.blue}📁 Coverage reports saved in each package's coverage/ directory${colors.reset}`,
		)
		console.log(
			`${colors.blue}📄 Individual reports: coverage/coverage-summary.json${colors.reset}`,
		)
		console.log(
			`${colors.blue}📊 Detailed reports: coverage/lcov-report/index.html${colors.reset}`,
		)

		if (args.includes('--pr-comment')) {
			console.log(
				`\n${colors.yellow}💡 Use --markdown flag to generate PR-friendly output${colors.reset}`,
			)
		}
	}
}

main()
