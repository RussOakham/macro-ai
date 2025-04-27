import {
	confirmForgotPasswordSchema,
	IAuthResponse,
	TConfirmForgotPassword,
} from '@repo/types-macro-ai-api'

import { axios } from '@/lib/axios'

const postForgotPasswordVerify = async ({
	code,
	email,
	newPassword,
	confirmPassword,
}: TConfirmForgotPassword) => {
	const parsedData = confirmForgotPasswordSchema.safeParse({
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

	const response = await axios.post<IAuthResponse>(
		'/auth/confirm-forgot-password',
		requestBody,
	)

	return response
}

export { postForgotPasswordVerify }
