import { z } from 'zod'

const loginFormSchema = z.object({
	email: z
		.string({
			required_error: 'Please enter your email address',
		})
		.email({
			message: 'Please enter a valid email address',
		}),
	password: z
		.string({
			required_error: 'Please enter your password',
		})
		.min(8, {
			message: 'Password must be at least 8 characters long',
		}),
})
type TLoginForm = z.infer<typeof loginFormSchema>

export { loginFormSchema }
export type { TLoginForm }
