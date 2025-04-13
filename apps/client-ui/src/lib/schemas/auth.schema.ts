import { z } from 'zod'

export const loginSchema = z.object({
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

export const registerSchema = loginSchema
  .extend({
    confirmPassword: z.string({
      required_error: 'Please confirm your password',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const confirmationSchema = z.object({
  username: z
    .string()
    .email({ message: 'Please enter the email address you used to register.' }),
  code: z
    .string({
      required_error: 'Please enter the 6-digit code we sent to your email.',
    })
    .length(6, {
      message: 'Please enter all 6 digits.',
    })
    .regex(/^\d+$/, {
      message: 'Code must only contain numbers.',
    }),
})

export const getUserSchema = z.object({
  accessToken: z.string({
    message: 'Invalid access token',
    required_error: 'Access token is required',
  }),
  enabled: z.boolean().optional(),
})