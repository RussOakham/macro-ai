#!/usr/bin/env node

/**
 * Build-Time Environment Validation Script
 *
 * This script validates that all required environment variables are present
 * before the build process starts. It ensures that configuration issues
 * are caught early in the CI/CD pipeline.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Color codes for console output
const colors = {
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	reset: '\x1b[0m',
	bold: '\x1b[1m',
}

// Logging functions
function logInfo(message) {
	console.log(`${colors.blue}[INFO]${colors.reset} ${message}`)
}

function logSuccess(message) {
	console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`)
}

function logWarning(message) {
	console.log(`${colors.yellow}[WARNING]${colors.reset} ${message}`)
}

function logError(message) {
	console.log(`${colors.red}[ERROR]${colors.reset} ${message}`)
}

function logFatal(message) {
	console.log(`${colors.red}${colors.bold}[FATAL]${colors.reset} ${message}`)
}

// Required environment variables based on Zod schema
const requiredEnvVars = [
	// API
	'API_KEY',
	'NODE_ENV',
	'SERVER_PORT',

	// AWS Cognito
	'AWS_COGNITO_REGION',
	'AWS_COGNITO_USER_POOL_ID',
	'AWS_COGNITO_USER_POOL_CLIENT_ID',

	// Cookie Settings
	'COOKIE_ENCRYPTION_KEY',

	// Database
	'RELATIONAL_DATABASE_URL',
	'REDIS_URL',

	// OpenAI
	'OPENAI_API_KEY',

	// Rate Limiting
	'RATE_LIMIT_WINDOW_MS',
	'RATE_LIMIT_MAX_REQUESTS',
	'AUTH_RATE_LIMIT_WINDOW_MS',
	'AUTH_RATE_LIMIT_MAX_REQUESTS',
	'API_RATE_LIMIT_WINDOW_MS',
	'API_RATE_LIMIT_MAX_REQUESTS',
]

// Optional environment variables
const optionalEnvVars = [
	'CORS_ALLOWED_ORIGINS',
	'COOKIE_DOMAIN',
	'AWS_COGNITO_REFRESH_TOKEN_EXPIRY',
]

// Validation rules
const validationRules = {
	API_KEY: (value) => {
		if (!value || value.length < 32) {
			return 'API key must be at least 32 characters long'
		}
		return null
	},
	COOKIE_ENCRYPTION_KEY: (value) => {
		if (!value || value.length < 32) {
			return 'Cookie encryption key must be at least 32 characters long'
		}
		return null
	},
	OPENAI_API_KEY: (value) => {
		if (!value || !value.startsWith('sk-')) {
			return 'OpenAI API key must start with "sk-"'
		}
		return null
	},
	NODE_ENV: (value) => {
		const validEnvs = ['development', 'production', 'test']
		if (!validEnvs.includes(value)) {
			return `NODE_ENV must be one of: ${validEnvs.join(', ')}`
		}
		return null
	},
	APP_ENV: (value) => {
		if (!value) return null // Optional in some contexts
		const validEnvs = ['development', 'staging', 'production', 'test']
		const isPrEnv = /^pr-\d+$/.test(value)
		if (!validEnvs.includes(value) && !isPrEnv) {
			return 'APP_ENV must be a valid environment or match pr-{number} pattern'
		}
		return null
	},
	SERVER_PORT: (value) => {
		const port = parseInt(value)
		if (isNaN(port) || port < 1 || port > 65535) {
			return 'SERVER_PORT must be a valid port number (1-65535)'
		}
		return null
	},
}

/**
 * Load environment variables from .env file
 */
function loadEnvFile() {
	const nodeEnv = process.env.NODE_ENV || 'development'
	const appEnv = process.env.APP_ENV

	// Determine environment type
	let envType = 'development'
	if (appEnv?.match(/^pr-\d+$/)) {
		envType = 'preview'
	} else if (nodeEnv === 'production') {
		envType = appEnv === 'staging' ? 'staging' : 'production'
	} else if (nodeEnv === 'test') {
		envType = 'test'
	}

	// Environment file loading order (higher priority files first)
	const envFiles = []

	// Environment-specific files (highest priority)
	switch (envType) {
		case 'development': {
			envFiles.push(
				{
					path: '.env.development',
					description: 'Development environment file',
				},
				{
					path: '.env.local',
					description: 'Local development environment file',
				},
			)
			break
		}
		case 'test': {
			envFiles.push({ path: '.env.test', description: 'Test environment file' })
			break
		}
		case 'staging': {
			envFiles.push({
				path: '.env.staging',
				description: 'Staging environment file',
			})
			break
		}
		case 'production':
		case 'preview': {
			// Production and preview environments should use pre-set environment variables
			logInfo(
				`${envType} environment detected - using pre-set environment variables`,
			)
			return {}
		}
	}

	// Base .env file (lowest priority)
	envFiles.push({ path: '.env', description: 'Base environment file' })

	logInfo(`Environment type: ${envType}`)

	const allEnvVars = {}
	let loadedCount = 0

	// Load files in reverse order so later files in array override earlier ones
	for (let i = envFiles.length - 1; i >= 0; i--) {
		const envFile = envFiles[i]
		const envPath = resolve(__dirname, '..', envFile.path)

		if (existsSync(envPath)) {
			try {
				const envContent = readFileSync(envPath, 'utf8')
				const fileVars = {}

				envContent.split('\n').forEach((line) => {
					const trimmed = line.trim()
					if (trimmed && !trimmed.startsWith('#')) {
						const [key, ...valueParts] = trimmed.split('=')
						if (key && valueParts.length > 0) {
							const value = valueParts.join('=').replace(/^["']|["']$/g, '')
							// Allow higher-priority values to replace lower-priority ones
							allEnvVars[key] = value
							fileVars[key] = value
						}
					}
				})

				if (Object.keys(fileVars).length > 0) {
					loadedCount++
					logInfo(
						`Loaded ${Object.keys(fileVars).length} variables from ${envFile.description}`,
					)
				}
			} catch (error) {
				logWarning(`Failed to read ${envFile.path}: ${error.message}`)
			}
		}
	}

	if (loadedCount === 0) {
		logInfo(
			'No environment files found - using system environment variables only',
		)
	} else {
		logInfo(
			`Total loaded: ${Object.keys(allEnvVars).length} variables from ${loadedCount} file(s)`,
		)
	}

	return allEnvVars
}

/**
 * Validate environment variables
 */
function validateEnvironment() {
	logInfo('Starting environment validation...')

	// Load environment variables from .env file and system
	const envFileVars = loadEnvFile()
	const systemVars = process.env

	// Merge environment variables (system takes precedence)
	const allEnvVars = { ...envFileVars, ...systemVars }

	const missingVars = []
	const invalidVars = []
	const warnings = []

	// Check required variables
	for (const varName of requiredEnvVars) {
		const value = allEnvVars[varName]

		if (!value) {
			missingVars.push(varName)
		}

		// Apply validation rules if they exist
		if (validationRules[varName]) {
			const validationError = validationRules[varName](value)
			if (validationError) {
				invalidVars.push({
					name: varName,
					error: validationError,
					// Don't log sensitive values for security
				})
			}
		}
	}

	// Check optional variables for warnings
	for (const varName of optionalEnvVars) {
		const value = allEnvVars[varName]
		if (!value) {
			warnings.push(`Optional variable ${varName} is not set`)
		}
	}

	// Conditional validation: APP_ENV is required for production, staging, and preview environments
	const nodeEnv = allEnvVars['NODE_ENV']
	const appEnv = allEnvVars['APP_ENV']

	// Check if APP_ENV is required based on NODE_ENV
	const requiresAppEnv = nodeEnv && ['production', 'staging'].includes(nodeEnv)
	const isPreviewEnv = appEnv && appEnv.match(/^pr-\d+$/)

	if (requiresAppEnv || isPreviewEnv) {
		if (!appEnv) {
			missingVars.push('APP_ENV')
			logError(
				`APP_ENV is required when NODE_ENV is '${nodeEnv}' or for preview environments`,
			)
		} else if (validationRules['APP_ENV']) {
			const validationError = validationRules['APP_ENV'](appEnv)
			if (validationError) {
				invalidVars.push({
					name: 'APP_ENV',
					error: validationError,
					// Don't log sensitive values for security
				})
			}
		}
	}

	// Report results
	if (missingVars.length > 0) {
		logError(
			`Missing required environment variables: ${missingVars.join(', ')}`,
		)
	}

	if (invalidVars.length > 0) {
		logError('Invalid environment variables:')
		invalidVars.forEach(({ name, error }) => {
			logError(`  ${name}: ${error}`)
		})
	}

	if (warnings.length > 0) {
		logWarning('Environment warnings:')
		warnings.forEach((warning) => logWarning(`  ${warning}`))
	}

	// Summary
	const totalVars = requiredEnvVars.length + optionalEnvVars.length
	const presentVars =
		requiredEnvVars.filter((v) => allEnvVars[v]).length +
		optionalEnvVars.filter((v) => allEnvVars[v]).length

	logInfo(
		`Environment validation complete: ${presentVars}/${totalVars} variables present`,
	)

	if (missingVars.length > 0 || invalidVars.length > 0) {
		logFatal('Environment validation failed!')
		process.exit(1)
	}

	if (warnings.length > 0) {
		logWarning('Environment validation passed with warnings')
	} else {
		logSuccess('Environment validation passed!')
	}
}

/**
 * Main execution
 */
function main() {
	// Skip validation if explicitly requested (e.g., during Docker build)
	if (process.env.SKIP_ENV_VALIDATION === 'true') {
		logInfo('Environment validation skipped (SKIP_ENV_VALIDATION=true)')
		logSuccess('Environment validation bypassed for build process')
		return
	}

	try {
		validateEnvironment()
	} catch (error) {
		logFatal(`Validation script failed: ${error.message}`)
		process.exit(1)
	}
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main()
}
