/**
 * Coverage badge configuration for the monorepo
 * Generates coverage badges for each package
 */

const fs = require('fs')
const path = require('path')

// Coverage badge generator
function generateCoverageBadge(coverage, packageName) {
	const { statements, branches, functions, lines } = coverage
	const overall = Math.round((statements + branches + functions + lines) / 4)

	// Determine color based on coverage percentage
	let color = 'red'
	if (overall >= 90) color = 'brightgreen'
	else if (overall >= 80) color = 'green'
	else if (overall >= 70) color = 'yellowgreen'
	else if (overall >= 60) color = 'yellow'
	else if (overall >= 50) color = 'orange'

	const badgeUrl = `https://img.shields.io/badge/coverage-${overall}%25-${color}`

	return {
		package: packageName,
		overall,
		statements,
		branches,
		functions,
		lines,
		badgeUrl,
		markdown: `![Coverage](${badgeUrl})`,
	}
}

// Read coverage reports and generate badges
function generateCoverageBadges() {
	const packages = ['express-api', 'client-ui', 'macro-ai-api-client']
	const badges = []

	packages.forEach((pkg) => {
		const coveragePath = path.join(
			'apps',
			pkg,
			'coverage',
			'coverage-final.json',
		)
		const altCoveragePath = path.join(
			'packages',
			pkg,
			'coverage',
			'coverage-final.json',
		)

		let coverageFile = coveragePath
		if (!fs.existsSync(coverageFile)) {
			coverageFile = altCoveragePath
		}

		if (fs.existsSync(coverageFile)) {
			try {
				const coverageData = JSON.parse(fs.readFileSync(coverageFile, 'utf8'))
				const total = coverageData.total
				const badge = generateCoverageBadge(total, pkg)
				badges.push(badge)
			} catch (error) {
				console.warn(`Failed to read coverage for ${pkg}:`, error.message)
			}
		} else {
			console.warn(`Coverage file not found for ${pkg}`)
		}
	})

	return badges
}

// Generate coverage summary
function generateCoverageSummary() {
	const badges = generateCoverageBadges()

	if (badges.length === 0) {
		console.log('No coverage data found. Run tests with coverage first.')
		return
	}

	console.log('\n📊 Coverage Summary:')
	console.log('==================')

	badges.forEach((badge) => {
		console.log(`\n${badge.package}:`)
		console.log(`  Overall: ${badge.overall}%`)
		console.log(`  Statements: ${badge.statements}%`)
		console.log(`  Branches: ${badge.branches}%`)
		console.log(`  Functions: ${badge.functions}%`)
		console.log(`  Lines: ${badge.lines}%`)
		console.log(`  Badge: ${badge.markdown}`)
	})

	// Calculate overall project coverage
	const overallStats = badges.reduce(
		(acc, badge) => {
			acc.statements += badge.statements
			acc.branches += badge.branches
			acc.functions += badge.functions
			acc.lines += badge.lines
			return acc
		},
		{ statements: 0, branches: 0, functions: 0, lines: 0 },
	)

	const overallCoverage = Math.round(
		(overallStats.statements +
			overallStats.branches +
			overallStats.functions +
			overallStats.lines) /
			(4 * badges.length),
	)

	console.log(`\n🎯 Overall Project Coverage: ${overallCoverage}%`)

	return { badges, overallCoverage }
}

module.exports = {
	generateCoverageBadge,
	generateCoverageBadges,
	generateCoverageSummary,
}

// Run if called directly
if (require.main === module) {
	generateCoverageSummary()
}
