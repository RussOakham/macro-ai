import { z } from 'zod'

const userSchema = z.object({
	email: z.string().email(),
})

type TUser = z.infer<typeof userSchema>

export { userSchema }
export type { TUser }
