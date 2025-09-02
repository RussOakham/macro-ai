#!/usr/bin/env node

/**
 * Test Automation Utilities
 *
 * Provides utilities for enhanced test automation including:
 * - Test result aggregation and reporting
 * - Performance analysis and tracking
 * - Flaky test detection
 * - Coverage trend analysis
 * - Test execution optimization
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// Color codes for console output
const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m',
}

function colorize(text, color) {
	return `${colors[color]}${text}${colors.reset}`
}

/**
 * Parse JUnit XML test results
 * @param {string} xmlPath - Path to JUnit XML file
 * @returns {Object} Parsed test results
 */
function parseJUnitXML(xmlPath) {
	try {
		const xml = fs.readFileSync(xmlPath, 'utf8')

		// Simple regex-based parsing (for production, use a proper XML parser)
		const testsMatch = xml.match(/tests="(\d+)"/)
		const failuresMatch = xml.match(/failures="(\d+)"/)
		const errorsMatch = xml.match(/errors="(\d+)"/)
		const timeMatch = xml.match(/time="([\d.]+)"/)
		const nameMatch = xml.match(/name="([^"]+)"/)

		// Extract individual test cases
		const testCaseRegex =
			/<testcase[^>]*name="([^"]*)"[^>]*time="([\d.]*)"[^>]*>/g
		const testCases = []
		let match

		while ((match = testCaseRegex.exec(xml)) !== null) {
			testCases.push({
				name: match[1],
				duration: parseFloat(match[2]) || 0,
			})
		}

		return {
			suiteName: nameMatch ? nameMatch[1] : 'Unknown',
			totalTests: testsMatch ? parseInt(testsMatch[1]) : 0,
			failures: failuresMatch ? parseInt(failuresMatch[1]) : 0,
			errors: errorsMatch ? parseInt(errorsMatch[1]) : 0,
			duration: timeMatch ? parseFloat(timeMatch[1]) : 0,
			testCases,
			filePath: xmlPath,
		}
	} catch (error) {
		console.error(`Error parsing JUnit XML ${xmlPath}:`, error.message)
		return null
	}
}

/**
 * Parse coverage summary JSON
 * @param {string} jsonPath - Path to coverage summary JSON
 * @returns {Object} Parsed coverage data
 */
function parseCoverageSummary(jsonPath) {
	try {
		const coverage = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))

		return {
			statements: coverage.total?.statements?.pct || 0,
			branches: coverage.total?.branches?.pct || 0,
			functions: coverage.total?.functions?.pct || 0,
			lines: coverage.total?.lines?.pct || 0,
			overall:
				Math.round(
					(coverage.total?.statements?.pct +
						coverage.total?.branches?.pct +
						coverage.total?.functions?.pct +
						coverage.total?.lines?.pct) /
						4,
				) || 0,
			filePath: jsonPath,
		}
	} catch (error) {
		console.error(`Error parsing coverage summary ${jsonPath}:`, error.message)
		return null
	}
}

/**
 * Aggregate test results from multiple sources
 * @param {string} resultsDir - Directory containing test results
 * @returns {Object} Aggregated test results
 */
function aggregateTestResults(resultsDir = '.') {
	console.log(colorize('📊 Aggregating test results...', 'cyan'))

	const results = {
		testSuites: [],
		coverage: [],
		summary: {
			totalTests: 0,
			totalFailures: 0,
			totalErrors: 0,
			totalDuration: 0,
			overallCoverage: 0,
			successRate: 0,
		},
		performance: {
			slowestTests: [],
			fastestSuites: [],
			averageTestDuration: 0,
		},
	}

	// Find all JUnit XML files
	const findJUnitFiles = (dir) => {
		const files = []
		try {
			const entries = fs.readdirSync(dir, { withFileTypes: true })

			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name)

				if (entry.isDirectory()) {
					files.push(...findJUnitFiles(fullPath))
				} else if (
					entry.name.includes('test-results') &&
					entry.name.endsWith('.xml')
				) {
					files.push(fullPath)
				}
			}
		} catch (error) {
			// Directory might not exist or be accessible
		}

		return files
	}

	// Find all coverage summary files
	const findCoverageFiles = (dir) => {
		const files = []
		try {
			const entries = fs.readdirSync(dir, { withFileTypes: true })

			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name)

				if (entry.isDirectory()) {
					files.push(...findCoverageFiles(fullPath))
				} else if (entry.name === 'coverage-summary.json') {
					files.push(fullPath)
				}
			}
		} catch (error) {
			// Directory might not exist or be accessible
		}

		return files
	}

	// Process JUnit files
	const junitFiles = findJUnitFiles(resultsDir)
	console.log(`Found ${junitFiles.length} JUnit result files`)

	for (const file of junitFiles) {
		const parsed = parseJUnitXML(file)
		if (parsed) {
			results.testSuites.push(parsed)
			results.summary.totalTests += parsed.totalTests
			results.summary.totalFailures += parsed.failures
			results.summary.totalErrors += parsed.errors
			results.summary.totalDuration += parsed.duration

			// Track slowest individual tests
			for (const testCase of parsed.testCases) {
				results.performance.slowestTests.push({
					name: testCase.name,
					suite: parsed.suiteName,
					duration: testCase.duration,
				})
			}
		}
	}

	// Process coverage files
	const coverageFiles = findCoverageFiles(resultsDir)
	console.log(`Found ${coverageFiles.length} coverage summary files`)

	let totalCoverage = 0
	for (const file of coverageFiles) {
		const parsed = parseCoverageSummary(file)
		if (parsed) {
			results.coverage.push(parsed)
			totalCoverage += parsed.overall
		}
	}

	// Calculate summary metrics
	results.summary.successRate =
		results.summary.totalTests > 0
			? Math.round(
					((results.summary.totalTests -
						results.summary.totalFailures -
						results.summary.totalErrors) /
						results.summary.totalTests) *
						100,
				)
			: 100

	results.summary.overallCoverage =
		results.coverage.length > 0
			? Math.round(totalCoverage / results.coverage.length)
			: 0

	results.performance.averageTestDuration =
		results.summary.totalTests > 0
			? results.summary.totalDuration / results.summary.totalTests
			: 0

	// Sort performance data
	results.performance.slowestTests.sort((a, b) => b.duration - a.duration)
	results.performance.slowestTests = results.performance.slowestTests.slice(
		0,
		10,
	) // Top 10

	results.performance.fastestSuites = results.testSuites
		.map((suite) => ({
			name: suite.suiteName,
			averageDuration:
				suite.totalTests > 0 ? suite.duration / suite.totalTests : 0,
			totalTests: suite.totalTests,
		}))
		.sort((a, b) => a.averageDuration - b.averageDuration)
		.slice(0, 5) // Top 5

	console.log(colorize('✅ Test results aggregated successfully', 'green'))
	return results
}

/**
 * Generate detailed test report
 * @param {Object} results - Aggregated test results
 * @returns {string} Markdown report
 */
function generateTestReport(results) {
	console.log(colorize('📝 Generating detailed test report...', 'cyan'))

	const report = `# 🧪 Comprehensive Test Report

## 📊 Summary

| Metric | Value |
|--------|-------|
| **Total Tests** | ${results.summary.totalTests} |
| **Failures** | ${results.summary.totalFailures} |
| **Errors** | ${results.summary.totalErrors} |
| **Success Rate** | ${results.summary.successRate}% |
| **Overall Coverage** | ${results.summary.overallCoverage}% |
| **Total Duration** | ${results.summary.totalDuration.toFixed(2)}s |
| **Average Test Duration** | ${(results.performance.averageTestDuration * 1000).toFixed(2)}ms |

## 📋 Test Suites

${results.testSuites
	.map(
		(suite) => `
### ${suite.suiteName}

- **Tests**: ${suite.totalTests}
- **Failures**: ${suite.failures}
- **Errors**: ${suite.errors}
- **Duration**: ${suite.duration.toFixed(2)}s
- **Status**: ${suite.failures + suite.errors === 0 ? '✅ PASS' : '❌ FAIL'}
`,
	)
	.join('\n')}

## 📈 Coverage Report

${results.coverage
	.map(
		(cov) => `
### Coverage Summary

- **Statements**: ${cov.statements.toFixed(1)}%
- **Branches**: ${cov.branches.toFixed(1)}%
- **Functions**: ${cov.functions.toFixed(1)}%
- **Lines**: ${cov.lines.toFixed(1)}%
- **Overall**: ${cov.overall}%
`,
	)
	.join('\n')}

## ⚡ Performance Analysis

### Slowest Tests (Top 10)

${
	results.performance.slowestTests.length > 0
		? results.performance.slowestTests
				.map(
					(test, index) =>
						`${index + 1}. **${test.name}** (${test.suite}) - ${(test.duration * 1000).toFixed(2)}ms`,
				)
				.join('\n')
		: 'No performance data available'
}

### Fastest Test Suites (Top 5)

${
	results.performance.fastestSuites.length > 0
		? results.performance.fastestSuites
				.map(
					(suite, index) =>
						`${index + 1}. **${suite.name}** - ${(suite.averageDuration * 1000).toFixed(2)}ms avg (${suite.totalTests} tests)`,
				)
				.join('\n')
		: 'No suite performance data available'
}

## 🔍 Recommendations

${generateRecommendations(results)}

---

*Report generated on ${new Date().toISOString()} by Test Automation Utils*
`

	console.log(colorize('✅ Test report generated successfully', 'green'))
	return report
}

/**
 * Generate recommendations based on test results
 * @param {Object} results - Aggregated test results
 * @returns {string} Recommendations text
 */
function generateRecommendations(results) {
	const recommendations = []

	// Success rate recommendations
	if (results.summary.successRate < 95) {
		recommendations.push(
			'🚨 **Test Reliability**: Success rate is below 95%. Consider investigating and fixing flaky tests.',
		)
	}

	// Coverage recommendations
	if (results.summary.overallCoverage < 80) {
		recommendations.push(
			'📊 **Coverage**: Overall coverage is below 80%. Consider adding more unit tests to critical code paths.',
		)
	}

	// Performance recommendations
	if (results.performance.averageTestDuration > 1) {
		recommendations.push(
			'⚡ **Performance**: Average test duration is above 1 second. Consider optimizing slow tests or breaking them into smaller units.',
		)
	}

	// Slow test recommendations
	const slowTests = results.performance.slowestTests.filter(
		(test) => test.duration > 5,
	)
	if (slowTests.length > 0) {
		recommendations.push(
			`🐌 **Slow Tests**: ${slowTests.length} tests take longer than 5 seconds. Consider optimizing or marking as integration tests.`,
		)
	}

	// Suite balance recommendations
	const largeSuites = results.testSuites.filter(
		(suite) => suite.totalTests > 100,
	)
	if (largeSuites.length > 0) {
		recommendations.push(
			'📦 **Suite Organization**: Some test suites have over 100 tests. Consider breaking them into smaller, focused suites.',
		)
	}

	if (recommendations.length === 0) {
		recommendations.push(
			'✅ **Great Job!** Your test suite is performing well across all metrics.',
		)
	}

	return recommendations.join('\n\n')
}

/**
 * Detect flaky tests by analyzing historical results
 * @param {string} historyDir - Directory containing historical test results
 * @returns {Array} List of potentially flaky tests
 */
function detectFlakyTests(historyDir = './test-history') {
	console.log(colorize('🔍 Analyzing test history for flaky tests...', 'cyan'))

	const flakyTests = []

	try {
		// This would analyze multiple test runs to identify tests that
		// sometimes pass and sometimes fail

		// For now, return placeholder data
		console.log(
			colorize('⚠️  Flaky test detection requires historical data', 'yellow'),
		)
		console.log('To enable flaky test detection:')
		console.log('1. Store test results in ./test-history directory')
		console.log('2. Run tests multiple times to build history')
		console.log('3. Analyze patterns of intermittent failures')
	} catch (error) {
		console.error('Error analyzing test history:', error.message)
	}

	return flakyTests
}

/**
 * Generate test execution optimization suggestions
 * @param {Object} results - Aggregated test results
 * @returns {Object} Optimization suggestions
 */
function generateOptimizationSuggestions(results) {
	console.log(
		colorize(
			'🚀 Generating test execution optimization suggestions...',
			'cyan',
		),
	)

	const suggestions = {
		parallelization: [],
		caching: [],
		splitting: [],
		performance: [],
	}

	// Parallelization suggestions
	const sequentialSuites = results.testSuites.filter(
		(suite) => suite.duration > 30,
	)
	if (sequentialSuites.length > 0) {
		suggestions.parallelization.push(
			'Consider running slow test suites in parallel to reduce overall execution time',
		)
	}

	// Caching suggestions
	suggestions.caching.push(
		'Cache node_modules and build artifacts between test runs',
	)
	suggestions.caching.push(
		'Use test database snapshots for faster integration test setup',
	)

	// Test splitting suggestions
	const largeSuites = results.testSuites.filter(
		(suite) => suite.totalTests > 50,
	)
	if (largeSuites.length > 0) {
		suggestions.splitting.push(
			'Split large test suites across multiple CI jobs for better parallelization',
		)
	}

	// Performance suggestions
	if (results.performance.averageTestDuration > 0.5) {
		suggestions.performance.push(
			'Optimize slow tests by reducing setup/teardown overhead',
		)
	}

	return suggestions
}

/**
 * Main CLI function
 */
function main() {
	const args = process.argv.slice(2)
	const command = args[0] || 'report'

	console.log(colorize('🧪 Test Automation Utils', 'bright'))
	console.log(colorize('========================', 'bright'))

	switch (command) {
		case 'aggregate':
			const resultsDir = args[1] || '.'
			const results = aggregateTestResults(resultsDir)
			console.log(JSON.stringify(results, null, 2))
			break

		case 'report':
			const reportDir = args[1] || '.'
			const reportResults = aggregateTestResults(reportDir)
			const report = generateTestReport(reportResults)

			const outputPath = args[2] || 'test-report.md'
			fs.writeFileSync(outputPath, report)
			console.log(colorize(`📝 Report written to ${outputPath}`, 'green'))
			break

		case 'flaky':
			const historyDir = args[1] || './test-history'
			const flakyTests = detectFlakyTests(historyDir)
			console.log('Flaky tests detected:', flakyTests)
			break

		case 'optimize':
			const optimizeDir = args[1] || '.'
			const optimizeResults = aggregateTestResults(optimizeDir)
			const suggestions = generateOptimizationSuggestions(optimizeResults)
			console.log(colorize('🚀 Optimization Suggestions:', 'bright'))
			console.log(JSON.stringify(suggestions, null, 2))
			break

		case 'help':
		default:
			console.log(`
Usage: node test-automation-utils.js <command> [options]

Commands:
  aggregate [dir]     Aggregate test results from directory (default: .)
  report [dir] [out]  Generate comprehensive test report (default: test-report.md)
  flaky [historyDir]  Detect flaky tests from historical data
  optimize [dir]      Generate optimization suggestions
  help               Show this help message

Examples:
  node test-automation-utils.js report ./test-results
  node test-automation-utils.js aggregate ./apps/express-api
  node test-automation-utils.js optimize
      `)
			break
	}
}

// Run if called directly
if (require.main === module) {
	main()
}

module.exports = {
	parseJUnitXML,
	parseCoverageSummary,
	aggregateTestResults,
	generateTestReport,
	detectFlakyTests,
	generateOptimizationSuggestions,
}
