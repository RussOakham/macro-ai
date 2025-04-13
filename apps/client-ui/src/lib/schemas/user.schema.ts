import { z } from 'zod'

export const userSchema = z.object({
	id: z.string().uuid(),
	email: z.string().email(),
	emailVerified: z.boolean(),
})
