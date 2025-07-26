/* eslint-disable @typescript-eslint/no-unused-vars */
import { z } from 'zod'

const postAuthregister_Body = z
	.object({
		email: z.string().email(),
		password: z.string().min(8).max(15).regex(/\d/),
		confirmPassword: z.string().min(8).max(15).regex(/\d/),
	})
	.passthrough()
const postAuthconfirmRegistration_Body = z
	.object({ email: z.string().email(), code: z.number() })
	.passthrough()
const postAuthlogin_Body = z
	.object({
		email: z.string().email(),
		password: z.string().min(8).max(15).regex(/\d/),
	})
	.passthrough()
const postAuthconfirmForgotPassword_Body = z
	.object({
		email: z.string().email(),
		code: z.string().min(6).max(6),
		newPassword: z.string().min(8).max(15).regex(/\d/),
		confirmPassword: z.string().min(8).max(15).regex(/\d/),
	})
	.passthrough()
export const authSchemas = {
	// Schemas will be exported individually
}
