import { IAuthResponse, TRegister } from '@repo/types-macro-ai-api'

import { axios } from '@/lib/axios'

const postRegister = async ({
	email,
	password,
	confirmPassword,
}: TRegister) => {
	const response = await axios.post<IAuthResponse>('/auth/register', {
		email,
		password,
		confirmPassword,
	})

	return response
}

export { postRegister }
