#!/usr/bin/env node

/**
 * Test script to verify streaming behavior works correctly
 * This script makes a request to the streaming endpoint and logs chunks as they arrive
 */

import http from 'http'

const testStreaming = () => {
	console.log('🧪 Testing streaming endpoint...')
	console.log('📡 Making request to /api/chats/test/stream')

	const postData = JSON.stringify({
		messages: [
			{ content: 'Tell me a short story about a robot', role: 'user' },
		],
	})

	const options = {
		hostname: 'localhost',
		port: 3001,
		path: '/api/chats/test-chat-id/stream',
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Content-Length': Buffer.byteLength(postData),
			Authorization: 'Bearer test-token', // You'll need a valid token
			'User-Agent': 'StreamingTest/1.0',
		},
	}

	const req = http.request(options, (res) => {
		console.log(`📊 Status: ${res.statusCode.toString()}`)
		console.log(`📋 Headers:`, res.headers)
		console.log('🔄 Streaming chunks:')
		console.log('─'.repeat(50))

		let chunkCount = 0
		let totalData = ''
		const startTime = Date.now()

		res.on('data', (chunk) => {
			chunkCount++
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
			const chunkStr = chunk.toString()
			// eslint-disable-next-line @typescript-eslint/restrict-plus-operands
			totalData += chunkStr
			const timestamp = Date.now() - startTime

			console.log(
				// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
				`[${timestamp.toString()}ms] Chunk ${chunkCount.toString()}: "${chunkStr}"`,
			)
		})

		res.on('end', () => {
			const endTime = Date.now() - startTime
			console.log('─'.repeat(50))
			console.log(`✅ Stream completed in ${endTime.toString()}ms`)
			console.log(`📦 Total chunks: ${chunkCount.toString()}`)
			console.log(
				`📝 Total data length: ${totalData.length.toString()} characters`,
			)
			console.log(
				`🎯 Average chunk size: ${Math.round(totalData.length / chunkCount).toString()} characters`,
			)

			if (chunkCount > 1) {
				console.log('🎉 SUCCESS: Data was streamed in multiple chunks!')
			} else {
				console.log(
					'⚠️  WARNING: All data came in a single chunk - streaming may not be working',
				)
			}
		})

		res.on('error', (err) => {
			console.error('❌ Stream error:', err.message)
		})
	})

	req.on('error', (err) => {
		console.error('❌ Request error:', err.message)
		console.log('💡 Make sure the server is running on port 3001')
	})

	req.write(postData)
	req.end()
}

// Run the test
console.log('🚀 Starting streaming test...')
console.log(
	'⚠️  Note: This requires a running server with valid authentication',
)
console.log('')

testStreaming()
