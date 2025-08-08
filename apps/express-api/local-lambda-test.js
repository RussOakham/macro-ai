#!/usr/bin/env node

/**
 * Local Lambda Testing Script
 * Simulates AWS Lambda environment for debugging staging issues
 */

const fs = require('fs')
const path = require('path')

// Simulate Lambda environment variables
process.env.AWS_LAMBDA_FUNCTION_NAME = 'macro-ai-staging-api'
process.env.AWS_LAMBDA_RUNTIME_API = 'localhost:9001'
process.env.LAMBDA_RUNTIME_DIR = '/var/runtime'
process.env.NODE_ENV = 'production'
process.env.ENVIRONMENT = 'staging'

// Add staging-specific environment variables
process.env.LOG_LEVEL = 'INFO'
process.env.POWERTOOLS_SERVICE_NAME = 'macro-ai-api'
process.env.POWERTOOLS_LOG_LEVEL = 'INFO'

// Mock AWS context
const mockContext = {
	functionName: 'macro-ai-staging-api',
	functionVersion: '$LATEST',
	invokedFunctionArn:
		'arn:aws:lambda:us-east-1:123456789012:function:macro-ai-staging-api',
	memoryLimitInMB: '512',
	awsRequestId: 'test-request-id-' + Date.now(),
	logGroupName: '/aws/lambda/macro-ai-staging-api',
	logStreamName: '2025/01/07/[$LATEST]test-stream',
	getRemainingTimeInMillis: () => 30000,
	callbackWaitsForEmptyEventLoop: true,
}

// Mock API Gateway event
const mockEvent = {
	httpMethod: 'GET',
	path: '/health',
	pathParameters: null,
	queryStringParameters: null,
	headers: {
		'Content-Type': 'application/json',
		'User-Agent': 'test-agent',
	},
	body: null,
	isBase64Encoded: false,
	requestContext: {
		requestId: 'test-request-id',
		stage: 'staging',
		httpMethod: 'GET',
		path: '/health',
	},
}

async function testLambdaBundle() {
	console.log('🧪 Starting Local Lambda Test...')
	console.log('📍 Environment:', process.env.NODE_ENV)
	console.log('🔧 Lambda Function:', process.env.AWS_LAMBDA_FUNCTION_NAME)

	try {
		// Test 1: Bundle Loading
		console.log('\n1️⃣ Testing Bundle Loading...')
		const bundlePath = path.join(__dirname, 'dist', 'lambda.bundle.cjs')

		if (!fs.existsSync(bundlePath)) {
			throw new Error(`Lambda bundle not found at: ${bundlePath}`)
		}

		console.log('✅ Bundle file exists')
		console.log(
			'📦 Bundle size:',
			(fs.statSync(bundlePath).size / 1024 / 1024).toFixed(2),
			'MB',
		)

		// Test 2: Module Import
		console.log('\n2️⃣ Testing Module Import...')
		const lambdaModule = require(bundlePath)
		console.log('✅ Module imported successfully')
		console.log('📋 Available exports:', Object.keys(lambdaModule))

		// Test 3: Handler Function
		console.log('\n3️⃣ Testing Handler Function...')
		if (typeof lambdaModule.handler !== 'function') {
			throw new Error(
				'Handler is not a function: ' + typeof lambdaModule.handler,
			)
		}
		console.log('✅ Handler function available')
		console.log(
			'🔧 Handler signature:',
			lambdaModule.handler.length,
			'parameters',
		)

		// Test 4: Cold Start Simulation
		console.log('\n4️⃣ Testing Cold Start (Handler Invocation)...')
		const startTime = Date.now()

		const result = await lambdaModule.handler(mockEvent, mockContext)

		const duration = Date.now() - startTime
		console.log('✅ Handler executed successfully')
		console.log('⏱️ Execution time:', duration, 'ms')
		console.log('📤 Response status:', result.statusCode)
		console.log('📋 Response headers:', Object.keys(result.headers || {}))

		// Test 5: Response Validation
		console.log('\n5️⃣ Validating Response...')
		if (!result.statusCode) {
			throw new Error('Missing statusCode in response')
		}

		if (result.statusCode >= 400) {
			console.log('⚠️ Error response detected')
			console.log('📄 Response body:', result.body)
		} else {
			console.log('✅ Success response')
		}

		// Test 6: Warm Invocation
		console.log('\n6️⃣ Testing Warm Invocation...')
		const warmStartTime = Date.now()
		const warmResult = await lambdaModule.handler(mockEvent, {
			...mockContext,
			awsRequestId: 'warm-request-id-' + Date.now(),
		})
		const warmDuration = Date.now() - warmStartTime

		console.log('✅ Warm invocation completed')
		console.log('⏱️ Warm execution time:', warmDuration, 'ms')
		console.log('📤 Warm response status:', warmResult.statusCode)

		console.log('\n🎉 All tests completed successfully!')

		return {
			success: true,
			coldStartDuration: duration,
			warmStartDuration: warmDuration,
			response: result,
		}
	} catch (error) {
		console.error('\n❌ Test failed:')
		console.error('🔥 Error:', error.message)
		console.error('📍 Stack trace:')
		console.error(error.stack)

		return {
			success: false,
			error: error.message,
			stack: error.stack,
		}
	}
}

// Run the test
if (require.main === module) {
	testLambdaBundle()
		.then((result) => {
			if (result.success) {
				console.log('\n✅ Local Lambda test PASSED')
				process.exit(0)
			} else {
				console.log('\n❌ Local Lambda test FAILED')
				process.exit(1)
			}
		})
		.catch((error) => {
			console.error('\n💥 Unexpected error:', error)
			process.exit(1)
		})
}

module.exports = { testLambdaBundle }
