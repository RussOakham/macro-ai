import { build } from 'esbuild'
import { readFileSync } from 'fs'

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'))

const isProduction = process.env.NODE_ENV === 'production'

const config = {
	entryPoints: ['src/lambda.ts'],
	bundle: true,
	platform: 'node',
	target: 'node20',
	format: 'esm',
	outfile: 'dist/lambda.js',
	sourcemap: !isProduction,
	minify: isProduction,
	keepNames: true,
	metafile: true,

	// External dependencies (provided by Lambda runtime or layers)
	external: [
		'aws-sdk',
		'@aws-sdk/*',
		// Keep these external as they're provided by Lambda runtime
		'crypto',
		'fs',
		'path',
		'os',
		'util',
		'events',
		'stream',
		'buffer',
		'querystring',
		'url',
		'http',
		'https',
		'zlib',
	],

	// Define environment variables for build
	define: {
		'process.env.NODE_ENV': JSON.stringify(
			process.env.NODE_ENV || 'production',
		),
		'process.env.AWS_LAMBDA_FUNCTION_NAME': JSON.stringify(
			process.env.AWS_LAMBDA_FUNCTION_NAME || 'macro-ai-lambda',
		),
		'process.env.AWS_REGION': JSON.stringify(
			process.env.AWS_REGION || 'us-east-1',
		),
	},

	// Banner to add Node.js ESM compatibility
	banner: {
		js: `
      import { createRequire } from 'module';
      import { fileURLToPath } from 'url';
      import { dirname } from 'path';
      
      const require = createRequire(import.meta.url);
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
    `,
	},

	// Resolve configuration
	resolveExtensions: ['.ts', '.js', '.json'],

	// Tree shaking configuration
	treeShaking: true,

	// Loader configuration
	loader: {
		'.json': 'json',
		'.txt': 'text',
	},

	// Log level
	logLevel: 'info',

	// Color output
	color: true,
}

// Build function
async function buildLambda() {
	try {
		console.log('🔨 Building Lambda function...')
		console.log(`📦 Mode: ${isProduction ? 'production' : 'development'}`)

		const result = await build(config)

		if (result.metafile) {
			console.log('📊 Bundle analysis:')
			const bundleSize = Object.values(result.metafile.outputs)[0]?.bytes || 0
			console.log(`   Bundle size: ${(bundleSize / 1024 / 1024).toFixed(2)} MB`)

			// Log largest dependencies
			const inputs = Object.entries(result.metafile.inputs)
				.sort(([, a], [, b]) => b.bytes - a.bytes)
				.slice(0, 10)

			console.log('   Largest dependencies:')
			inputs.forEach(([path, info]) => {
				const size = (info.bytes / 1024).toFixed(1)
				console.log(`     ${path}: ${size} KB`)
			})
		}

		console.log('✅ Lambda function built successfully!')
	} catch (error) {
		console.error('❌ Build failed:', error)
		process.exit(1)
	}
}

// Run build if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	buildLambda()
}

export { config, buildLambda }
