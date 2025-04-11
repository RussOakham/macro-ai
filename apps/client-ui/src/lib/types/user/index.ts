import { z } from 'zod'

const userSchema = z.object({
	id: z.string().uuid(),
	email: z.string().email(),
	emailVerified: z.boolean(),
})

export interface IUserResponse {
	id: string
	email: string
	emailVerified: boolean
}

type TUser = z.infer<typeof userSchema>

export { userSchema }
export type { TUser }
