#!/usr/bin/env node

/**
 * ESBuild configuration for AWS Lambda deployment
 *
 * This configuration ensures proper ES module exports for Lambda runtime
 */

import { build } from 'esbuild'
import { writeFileSync } from 'fs'
import { join } from 'path'

const isDev = process.argv.includes('--dev')

const config = {
	entryPoints: ['src/lambda.ts'],
	bundle: true,
	platform: 'node',
	target: 'node20',
	format: 'cjs',
	outfile: 'dist/lambda.bundle.cjs',
	external: ['aws-sdk'],
	minify: !isDev,
	sourcemap: true,
	keepNames: true,
	treeShaking: false,
	metafile: true,
	banner: {
		js: '// AWS Lambda CommonJS Handler\n',
	},
}

async function buildLambda() {
	try {
		console.log('🔨 Building Lambda function...')
		console.log(`📦 Mode: ${isDev ? 'development' : 'production'}`)
		console.log(`📁 Entry: ${config.entryPoints[0]}`)
		console.log(`📄 Output: ${config.outfile}`)

		const result = await build(config)

		// Write metafile for analysis
		if (result.metafile) {
			writeFileSync(
				join('dist', 'lambda.meta.json'),
				JSON.stringify(result.metafile, null, 2),
			)
		}

		console.log('✅ Lambda build completed successfully!')
		console.log(
			`📊 Bundle size: ${(result.metafile?.outputs?.[config.outfile]?.bytes || 0) / 1024 / 1024} MB`,
		)
	} catch (error) {
		console.error('❌ Lambda build failed:', error)
		process.exit(1)
	}
}

buildLambda()
