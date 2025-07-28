import { schemas } from '@repo/macro-ai-api-client'
import { z } from 'zod'

import { authClient } from '@/lib/api/clients'

type TConfirmForgotPassword = z.infer<
	typeof schemas.postAuthconfirmForgotPassword_Body
>

const postForgotPasswordVerify = async ({
	code,
	email,
	newPassword,
	confirmPassword,
}: TConfirmForgotPassword) => {
	const parsedData = schemas.postAuthconfirmForgotPassword_Body.safeParse({
		code,
		email,
		newPassword,
		confirmPassword,
	})

	if (!parsedData.success) {
		throw new Error(
			`[auth/forgot-password/verify]: ${parsedData.error.message}]`,
		)
	}

	const {
		code: parsedCode,
		email: parsedEmail,
		newPassword: parsedNewPassword,
	} = parsedData.data

	const requestBody: TConfirmForgotPassword = {
		code: parsedCode,
		email: parsedEmail,
		newPassword: parsedNewPassword,
		confirmPassword: confirmPassword,
	}

	const response = await authClient.post(
		'/auth/confirm-forgot-password',
		requestBody,
	)

	return response
}

export { postForgotPasswordVerify, type TConfirmForgotPassword }
