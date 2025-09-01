import { z } from 'zod'

export const envSchema = z.object({
	VITE_API_URL: z.url('Invalid API URL'),
	VITE_API_KEY: z
		.string({
			error: 'API key is required',
		})
		.min(32, 'API key must be at least 32 characters long'),
})

export type TEnv = z.infer<typeof envSchema>
