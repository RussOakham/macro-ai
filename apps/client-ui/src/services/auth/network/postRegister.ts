import { axios } from '@/lib/axios'
import { TRegisterForm } from '@/lib/types'

export interface IRegisterResponse {
	message: string
}

const postRegister = async ({
	email,
	password,
	confirmPassword,
}: TRegisterForm) => {
	const response = await axios.post<IRegisterResponse>('/auth/login', {
		email,
		password,
		confirmPassword,
	})

	return response
}

export { postRegister }
