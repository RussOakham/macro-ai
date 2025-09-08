#!/usr/bin/env node

/**
 * Coverage Path Sanitizer
 *
 * Removes absolute filesystem paths from coverage-summary.json files,
 * replacing them with project-root relative paths to prevent leaking
 * local filesystem structure in CI artifacts.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Get the project root directory
 */
function getProjectRoot() {
	return path.resolve(__dirname, '..')
}

/**
 * Convert absolute path to project-relative path
 * @param {string} absolutePath - The absolute filesystem path
 * @param {string} projectRoot - The project root directory
 * @returns {string} - Relative path from project root
 */
function makePathRelative(absolutePath, projectRoot) {
	// Normalize paths for cross-platform compatibility
	const normalizedAbsolute = path.normalize(absolutePath)
	const normalizedRoot = path.normalize(projectRoot)

	// If the path starts with the project root, make it relative
	if (normalizedAbsolute.startsWith(normalizedRoot)) {
		const relativePath = path.relative(normalizedRoot, normalizedAbsolute)
		// Convert Windows backslashes to forward slashes for consistency
		return relativePath.replace(/\\/g, '/')
	}

	// If it's not under project root, return as-is (shouldn't happen in normal cases)
	return absolutePath
}

/**
 * Sanitize a coverage-summary.json file
 * @param {string} filePath - Path to the coverage-summary.json file
 * @param {string} projectRoot - Project root directory
 */
function sanitizeCoverageFile(filePath, projectRoot) {
	try {
		const content = fs.readFileSync(filePath, 'utf-8')
		const coverage = JSON.parse(content)

		// Create a new coverage object with sanitized paths
		const sanitizedCoverage = { total: coverage.total }

		// Process each file entry
		for (const [filePath, data] of Object.entries(coverage)) {
			if (filePath === 'total') continue

			// Convert absolute path to relative
			const relativePath = makePathRelative(filePath, projectRoot)
			sanitizedCoverage[relativePath] = data
		}

		// Write the sanitized coverage back to file
		const sanitizedContent = JSON.stringify(sanitizedCoverage, null, 2)
		fs.writeFileSync(filePath, sanitizedContent, 'utf-8')

		console.log(`✅ Sanitized paths in ${filePath}`)
		return true
	} catch (error) {
		console.error(`❌ Error sanitizing ${filePath}:`, error.message)
		return false
	}
}

/**
 * Find and sanitize all coverage-summary.json files
 * @param {string} searchDir - Directory to search for coverage files
 * @param {string} projectRoot - Project root directory
 */
function sanitizeAllCoverageFiles(searchDir, projectRoot) {
	const coverageFiles = []

	// Look for coverage-summary.json files in the search directory
	function findCoverageFiles(dir) {
		try {
			const entries = fs.readdirSync(dir, { withFileTypes: true })

			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name)

				if (entry.isDirectory()) {
					findCoverageFiles(fullPath)
				} else if (entry.name === 'coverage-summary.json') {
					coverageFiles.push(fullPath)
				}
			}
		} catch (error) {
			// Ignore directories that can't be read
		}
	}

	findCoverageFiles(searchDir)

	console.log(`🔍 Found ${coverageFiles.length} coverage-summary.json files`)

	let successCount = 0
	for (const filePath of coverageFiles) {
		if (sanitizeCoverageFile(filePath, projectRoot)) {
			successCount++
		}
	}

	console.log(
		`✅ Successfully sanitized ${successCount}/${coverageFiles.length} coverage files`,
	)
	return successCount === coverageFiles.length
}

/**
 * Main function
 */
function main() {
	const args = process.argv.slice(2)
	const projectRoot = getProjectRoot()

	console.log('🧹 Coverage Path Sanitizer')
	console.log(`📁 Project root: ${projectRoot}`)

	if (args.length > 0) {
		// Sanitize specific file or directory
		const target = path.resolve(args[0])

		if (fs.existsSync(target)) {
			const stat = fs.statSync(target)

			if (stat.isFile() && target.endsWith('coverage-summary.json')) {
				// Sanitize single file
				console.log(`🎯 Sanitizing single file: ${target}`)
				const success = sanitizeCoverageFile(target, projectRoot)
				process.exit(success ? 0 : 1)
			} else if (stat.isDirectory()) {
				// Sanitize all files in directory
				console.log(`📂 Sanitizing all coverage files in: ${target}`)
				const success = sanitizeAllCoverageFiles(target, projectRoot)
				process.exit(success ? 0 : 1)
			} else {
				console.error(
					'❌ Target must be a coverage-summary.json file or directory',
				)
				process.exit(1)
			}
		} else {
			console.error(`❌ Target not found: ${target}`)
			process.exit(1)
		}
	} else {
		// Default: sanitize all coverage files in common locations
		const searchDirs = [
			path.join(projectRoot, 'apps'),
			path.join(projectRoot, 'packages'),
			path.join(projectRoot, 'coverage-reports'),
		]

		console.log('🔍 Searching for coverage files in default locations...')

		let totalSuccess = true
		for (const searchDir of searchDirs) {
			if (fs.existsSync(searchDir)) {
				console.log(`\n📂 Processing ${searchDir}...`)
				const success = sanitizeAllCoverageFiles(searchDir, projectRoot)
				totalSuccess = totalSuccess && success
			}
		}

		if (totalSuccess) {
			console.log('\n🎉 All coverage files sanitized successfully!')
			process.exit(0)
		} else {
			console.log('\n⚠️ Some coverage files could not be sanitized')
			process.exit(1)
		}
	}
}

main()
