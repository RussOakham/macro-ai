import {
	confirmRegistrationSchema,
	IAuthResponse,
} from '@repo/types-macro-ai-api'
import { z } from 'zod'

import { axios } from '@/lib/axios'

export const confirmRegistrationSchemaClient = confirmRegistrationSchema.extend(
	{
		code: z.string().length(6),
	},
)
export type TConfirmRegistrationClient = z.infer<
	typeof confirmRegistrationSchemaClient
>

const postConfirmRegistration = async ({
	username,
	code,
}: TConfirmRegistrationClient) => {
	const parsedCode = z.coerce.number().parse(code)

	const response = await axios.post<IAuthResponse>(
		'/auth/confirm-registration',
		{
			username,
			code: parsedCode,
		},
	)

	return response
}

export { postConfirmRegistration }
