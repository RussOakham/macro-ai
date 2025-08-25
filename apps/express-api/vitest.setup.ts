/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-empty-function */
import { afterAll, beforeAll, vi } from 'vitest'

beforeAll(() => {
	// Suppress non-error logs
	vi.spyOn(console, 'log').mockImplementation(() => {})
	vi.spyOn(console, 'info').mockImplementation(() => {})
	vi.spyOn(console, 'debug').mockImplementation(() => {})
	vi.spyOn(console, 'warn').mockImplementation(() => {})
	// Leave console.error intact so you still see errors
})

afterAll(() => {
	// Restore everything after tests, just in case
	;(console.log as any).mockRestore?.()
	;(console.info as any).mockRestore?.()
	;(console.debug as any).mockRestore?.()
	;(console.warn as any).mockRestore?.()
})
