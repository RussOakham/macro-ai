import { axios } from '@/lib/axios'
import { TConfirmationForm } from '@/lib/types'

export interface IConfirmRegisterResponse {
	message: string
}

const postConfirmRegistration = async ({
	username,
	code,
}: TConfirmationForm) => {
	const response = await axios.post<IConfirmRegisterResponse>(
		'/auth/confirm-registration',
		{
			username,
			code: parseInt(code),
		},
	)

	return response
}

export { postConfirmRegistration }
