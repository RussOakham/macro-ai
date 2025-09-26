#!/usr/bin/env node

/**
 * Custom YAML Linter
 * Comprehensive YAML validation with detailed error reporting
 */

import { readFileSync } from 'node:fs'
import { glob } from 'glob'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Get the directory name in ES modules
const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Configuration
const CONFIG = {
	// File patterns to lint
	patterns: [
		'**/*.yml',
		'**/*.yaml',
		'!**/node_modules/**',
		'!**/dist/**',
		'!**/coverage/**',
		'!**/build/**',
		'!**/cdk.out/**',
		'!**/infrastructure/dist/**',
		'!**/.git/**',
		'!**/pnpm-lock.yaml',
		'!**/package-lock.json',
		'!**/yarn.lock',
	],

	// Line length limits
	lineLength: {
		default: 120,
		dockerCompose: 200,
		githubActions: 200,
		amplify: 200,
	},

	// Indentation settings
	indent: 2,
}

// File type overrides
const FILE_TYPE_OVERRIDES = {
	'docker-compose': { lineLength: CONFIG.lineLength.dockerCompose },
	workflow: { lineLength: CONFIG.lineLength.githubActions },
	amplify: { lineLength: CONFIG.lineLength.amplify },
}

/**
 * Get file type based on filename
 */
const getFileType = function getFileType(filePath) {
	const basename = path.basename(filePath)

	if (basename.startsWith('docker-compose')) {
		return 'docker-compose'
	}

	if (
		basename.includes('workflow') ||
		filename.includes('/.github/workflows/')
	) {
		return 'workflow'
	}

	if (basename.startsWith('amplify')) {
		return 'amplify'
	}

	return 'default'
}

/**
 * Check if line exceeds length limit
 */
const checkLineLength = function checkLineLength(line, maxLength, lineNumber) {
	if (line.length > maxLength) {
		return {
			type: 'warning',
			line: lineNumber,
			message: `Line exceeds ${maxLength} characters (${line.length})`,
			rule: 'line-length',
		}
	}
	return null
}

/**
 * Check for trailing spaces
 */
const checkTrailingSpaces = function checkTrailingSpaces(line, lineNumber) {
	if (line.match(/\s+$/u)) {
		return {
			type: 'error',
			line: lineNumber,
			message: 'Trailing spaces found',
			rule: 'trailing-spaces',
		}
	}
	return null
}

/**
 * Check indentation consistency
 */
const checkIndentation = function checkIndentation(
	line,
	lineNumber,
	expectedIndent,
) {
	const indentMatch = line.match(/^(?<indent>\s*)/u)
	if (!indentMatch) {
		return null
	}

	const indent = indentMatch.groups.indent

	// Check if indentation is a multiple of expected spaces
	if (indent.length % expectedIndent !== 0) {
		return {
			type: 'error',
			line: lineNumber,
			message: `Inconsistent indentation. Expected multiple of ${expectedIndent} spaces`,
			rule: 'indentation',
		}
	}

	// Check for tabs
	if (indent.includes('\t')) {
		return {
			type: 'error',
			line: lineNumber,
			message: 'Tabs found. Use spaces only',
			rule: 'indentation',
		}
	}

	return null
}

/**
 * Check for empty lines at start/end
 */
const checkEmptyLines = function checkEmptyLines(lines, lineNumber) {
	const isEmpty = lines[lineNumber - 1].trim() === ''
	const prevLineEmpty = lineNumber > 1 && lines[lineNumber - 2].trim() === ''

	// Check for too many consecutive empty lines
	if (isEmpty && prevLineEmpty) {
		return {
			type: 'error',
			line: lineNumber,
			message: 'Multiple consecutive empty lines',
			rule: 'empty-lines',
		}
	}

	// Check for empty line at start of file
	if (lineNumber === 1 && isEmpty) {
		return {
			type: 'error',
			line: lineNumber,
			message: 'Empty line at start of file',
			rule: 'empty-lines',
		}
	}

	// Check for missing newline at end of file
	if (
		lineNumber === lines.length &&
		!isEmpty &&
		!lines[lineNumber - 1].endsWith('\n')
	) {
		return {
			type: 'error',
			line: lineNumber,
			message: 'Missing newline at end of file',
			rule: 'eof-newline',
		}
	}

	return null
}

/**
 * Lint a single YAML file
 */
const lintYamlFile = function lintYamlFile(filePath) {
	try {
		const content = readFileSync(filePath, 'utf8')
		const lines = content.split('\n')
		const fileType = getFileType(filePath)
		const maxLineLength =
			FILE_TYPE_OVERRIDES[fileType]?.lineLength || CONFIG.lineLength.default
		const issues = []

		for (let index = 0; index < lines.length; index++) {
			const line = lines[index]
			const lineNumber = index + 1

			// Check line length
			const lineLengthIssue = checkLineLength(line, maxLineLength, lineNumber)
			if (lineLengthIssue) {
				issues.push(lineLengthIssue)
			}

			// Check trailing spaces
			const trailingSpacesIssue = checkTrailingSpaces(line, lineNumber)
			if (trailingSpacesIssue) {
				issues.push(trailingSpacesIssue)
			}

			// Check indentation
			const indentationIssue = checkIndentation(line, lineNumber, CONFIG.indent)
			if (indentationIssue) {
				issues.push(indentationIssue)
			}

			// Check empty lines
			const emptyLinesIssue = checkEmptyLines(lines, lineNumber)
			if (emptyLinesIssue) {
				issues.push(emptyLinesIssue)
			}
		}

		return issues
	} catch (error) {
		return [
			{
				type: 'error',
				line: 0,
				message: `Failed to read file: ${error.message}`,
				rule: 'file-read',
			},
		]
	}
}

/**
 * Print issues in a formatted way
 */
const printIssues = function printIssues(filePath, issues) {
	if (issues.length === 0) {
		return
	}

	console.log(`\n${filePath}:`)
	issues.forEach((issue) => {
		const icon = issue.type === 'error' ? '❌' : '⚠️'
		console.log(
			`  ${icon} Line ${issue.line}: ${issue.message} (${issue.rule})`,
		)
	})
}

/**
 * Main linting function
 */
const runLinter = async function runLinter() {
	// const args = process.argv.slice(2)
	// const shouldFix = args.includes('--fix')

	console.log('🔍 Running YAML Linter...')

	try {
		const files = await glob(CONFIG.patterns, {
			cwd: path.join(dirname, '..'),
			absolute: true,
		})

		if (files.length === 0) {
			console.log('✅ No YAML files found to lint')
			return
		}

		let totalIssues = 0
		let filesWithIssues = 0

		for (const file of files) {
			const issues = lintYamlFile(file)
			if (issues.length > 0) {
				filesWithIssues += 1
				totalIssues += issues.length
				printIssues(file, issues)
			}
		}

		console.log(
			`\n📊 Summary: ${filesWithIssues} files with issues, ${totalIssues} total issues`,
		)

		if (filesWithIssues > 0) {
			process.exit(1)
		} else {
			console.log('✅ All YAML files passed linting!')
		}
	} catch (error) {
		console.error('❌ Error running linter:', error.message)
		process.exit(1)
	}
}

// Run the linter
runLinter()
