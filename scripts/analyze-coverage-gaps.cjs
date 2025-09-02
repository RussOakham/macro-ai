#!/usr/bin/env node

/**
 * Coverage Gap Analysis Tool
 * Analyzes coverage reports and identifies specific files and functions that need testing
 */

const fs = require('fs')
const path = require('path')

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

// Calculate coverage percentage from v8 coverage data
function calculateCoverage(map, hits) {
	if (!map || Object.keys(map).length === 0) return 100

	const total = Object.keys(map).length
	let covered = 0

	Object.keys(map).forEach((key) => {
		if (hits[key] > 0) {
			covered++
		}
	})

	return Math.round((covered / total) * 100)
}

// Analyze v8 coverage data for a single file
function analyzeV8FileCoverage(filePath, coverage) {
	const issues = []

	// Calculate coverage percentages
	const statementCoverage = calculateCoverage(coverage.statementMap, coverage.s)
	const branchCoverage = calculateCoverage(coverage.branchMap, coverage.b)
	const functionCoverage = calculateCoverage(coverage.fnMap, coverage.f)

	// Find issues based on thresholds
	if (statementCoverage < 80) {
		issues.push({
			type: 'statements',
			coverage: statementCoverage,
			threshold: 80,
			gap: 80 - statementCoverage,
		})
	}

	if (branchCoverage < 75) {
		issues.push({
			type: 'branches',
			coverage: branchCoverage,
			threshold: 75,
			gap: 75 - branchCoverage,
		})
	}

	if (functionCoverage < 80) {
		issues.push({
			type: 'functions',
			coverage: functionCoverage,
			threshold: 80,
			gap: 80 - functionCoverage,
		})
	}

	const overall = Math.round(
		(statementCoverage + branchCoverage + functionCoverage) / 3,
	)

	return {
		file: filePath.replace(process.cwd(), '').replace(/\\/g, '/'),
		statementCoverage,
		branchCoverage,
		functionCoverage,
		overall,
		issues,
		priority: issues.length > 2 ? 'high' : issues.length > 1 ? 'medium' : 'low',
	}
}

// Read and analyze coverage report
function analyzeCoverageReport(packageName) {
	const coveragePath = path.join(
		'apps',
		packageName,
		'coverage',
		'coverage-final.json',
	)
	const altCoveragePath = path.join(
		'packages',
		packageName,
		'coverage',
		'coverage-final.json',
	)

	let coverageFile = coveragePath
	if (!fs.existsSync(coverageFile)) {
		coverageFile = altCoveragePath
	}

	if (!fs.existsSync(coverageFile)) {
		console.warn(
			colorize(`⚠️  Coverage file not found for ${packageName}`, 'yellow'),
		)
		return null
	}

	try {
		const coverageData = JSON.parse(fs.readFileSync(coverageFile, 'utf8'))
		const analysis = []

		// v8 coverage format - analyze each file
		Object.entries(coverageData).forEach(([filePath, coverage]) => {
			// Skip non-file entries
			if (!coverage.statementMap) return

			const fileAnalysis = analyzeV8FileCoverage(filePath, coverage)
			if (fileAnalysis.issues.length > 0) {
				analysis.push(fileAnalysis)
			}
		})

		// Sort by priority and coverage
		analysis.sort((a, b) => {
			const priorityOrder = { high: 3, medium: 2, low: 1 }
			if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
				return priorityOrder[b.priority] - priorityOrder[a.priority]
			}
			return a.overall - b.overall // Lower coverage first
		})

		// Calculate overall stats
		const totalFiles = Object.keys(coverageData).filter(
			(key) => coverageData[key].statementMap,
		).length
		const totalStatements = Object.values(coverageData).reduce((sum, cov) => {
			if (!cov.statementMap) return sum
			return sum + Object.keys(cov.statementMap).length
		}, 0)
		const coveredStatements = Object.values(coverageData).reduce((sum, cov) => {
			if (!cov.statementMap) return sum
			return sum + Object.keys(cov.s).filter((key) => cov.s[key] > 0).length
		}, 0)

		const overallStatements =
			totalStatements > 0
				? Math.round((coveredStatements / totalStatements) * 100)
				: 100

		return {
			package: packageName,
			total: {
				files: totalFiles,
				statements: overallStatements,
			},
			files: analysis,
		}
	} catch (error) {
		console.error(
			colorize(
				`❌ Error reading coverage for ${packageName}: ${error.message}`,
				'red',
			),
		)
		return null
	}
}

// Generate testing recommendations
function generateRecommendations(analysis) {
	const recommendations = []

	analysis.files.forEach((file) => {
		const fileRec = {
			file: file.file,
			priority: file.priority,
			overall: file.overall,
			recommendations: [],
		}

		file.issues.forEach((issue) => {
			switch (issue.type) {
				case 'statements':
					fileRec.recommendations.push(
						`Add unit tests to cover ${issue.gap}% more statements (currently ${issue.coverage}%)`,
					)
					break
				case 'branches':
					fileRec.recommendations.push(
						`Add tests for conditional branches (need ${issue.gap}% more, currently ${issue.coverage}%)`,
					)
					break
				case 'functions':
					fileRec.recommendations.push(
						`Add tests for uncovered functions (need ${issue.gap}% more, currently ${issue.coverage}%)`,
					)
					break
			}
		})

		recommendations.push(fileRec)
	})

	return recommendations
}

// Main analysis function
function analyzeCoverageGaps() {
	console.log(colorize('\n🔍 Coverage Gap Analysis', 'bright'))
	console.log(colorize('========================', 'bright'))

	const packages = ['express-api', 'client-ui', 'macro-ai-api-client']
	const allAnalysis = []

	packages.forEach((pkg) => {
		console.log(colorize(`\n📦 Analyzing ${pkg}...`, 'cyan'))
		const analysis = analyzeCoverageReport(pkg)
		if (analysis) {
			allAnalysis.push(analysis)
		}
	})

	if (allAnalysis.length === 0) {
		console.log(
			colorize(
				'\n❌ No coverage data found. Run tests with coverage first.',
				'red',
			),
		)
		return
	}

	// Generate recommendations for each package
	allAnalysis.forEach((analysis) => {
		console.log(
			colorize(
				`\n📊 ${analysis.package.toUpperCase()} Coverage Analysis:`,
				'magenta',
			),
		)
		console.log(
			`Files analyzed: ${analysis.total.files}, Overall statements: ${analysis.total.statements}%`,
		)

		if (analysis.files.length === 0) {
			console.log(colorize('✅ All files meet coverage thresholds!', 'green'))
			return
		}

		console.log(
			colorize(
				`\n🎯 Files needing attention (${analysis.files.length} total):`,
				'yellow',
			),
		)

		const recommendations = generateRecommendations(analysis)
		recommendations.slice(0, 10).forEach((rec) => {
			// Show top 10
			const priorityColor =
				rec.priority === 'high'
					? 'red'
					: rec.priority === 'medium'
						? 'yellow'
						: 'blue'
			console.log(
				colorize(`\n  ${rec.priority.toUpperCase()} PRIORITY`, priorityColor),
			)
			console.log(`  File: ${rec.file}`)
			console.log(`  Coverage: ${rec.overall}%`)
			rec.recommendations.forEach((rec) => {
				console.log(`  • ${rec}`)
			})
		})

		if (recommendations.length > 10) {
			console.log(
				colorize(
					`\n  ... and ${recommendations.length - 10} more files`,
					'blue',
				),
			)
		}
	})

	// Summary recommendations
	console.log(colorize('\n📋 Summary Recommendations:', 'bright'))
	console.log('1. Focus on HIGH priority files first')
	console.log('2. Add unit tests for uncovered functions and branches')
	console.log('3. Consider integration tests for complex workflows')
	console.log('4. Use parameterized tests for similar test cases')
	console.log('5. Add error handling tests for edge cases')

	// Generate action items
	const highPriorityFiles = allAnalysis
		.flatMap((a) => a.files.filter((f) => f.priority === 'high'))
		.slice(0, 5)

	if (highPriorityFiles.length > 0) {
		console.log(colorize('\n🚀 Top 5 Action Items:', 'green'))
		highPriorityFiles.forEach((file, index) => {
			console.log(`${index + 1}. ${file.file} (${file.overall}% coverage)`)
		})
	}
}

// Run if called directly
if (require.main === module) {
	analyzeCoverageGaps()
}

module.exports = {
	analyzeCoverageGaps,
	analyzeCoverageReport,
	generateRecommendations,
}
