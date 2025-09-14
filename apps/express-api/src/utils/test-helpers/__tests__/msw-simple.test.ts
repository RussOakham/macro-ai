import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { describe, expect, it } from 'vitest'

/**
 * Simple MSW test to verify basic functionality
 */

const server = setupServer(
	http.get('http://localhost:3000/test', () => {
		return HttpResponse.json({ message: 'Hello from MSW!' })
	}),
)

describe('Simple MSW Test', () => {
	it('should work with basic MSW setup', async () => {
		server.listen()

		try {
			const response = await fetch('http://localhost:3000/test')
			const data = (await response.json()) as { message: string }

			expect(response.ok).toBe(true)
			expect(data.message).toBe('Hello from MSW!')
		} finally {
			server.close()
		}
	})
})
