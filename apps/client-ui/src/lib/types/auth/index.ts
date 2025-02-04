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

const registerFormSchema = z
	.object({
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
		confirmPassword: z.string({
			required_error: 'Please confirm your password',
		}),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword'],
	})
type TRegisterForm = z.infer<typeof registerFormSchema>

export { loginFormSchema, registerFormSchema }
export type { TLoginForm, TRegisterForm }
