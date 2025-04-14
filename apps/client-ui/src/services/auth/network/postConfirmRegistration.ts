import { z } from 'zod'

import { axios } from '@/lib/axios'
import { TConfirmationForm } from '@/lib/types'

export interface IConfirmRegisterResponse {
	message: string
}

const postConfirmRegistration = async ({
	username,
	code,
}: TConfirmationForm) => {
	const parsedCode = z.coerce.number().parse(code)

	const response = await axios.post<IConfirmRegisterResponse>(
		'/auth/confirm-registration',
		{
			username,
			code: parsedCode,
		},
	)

	return response
}

export { postConfirmRegistration }
