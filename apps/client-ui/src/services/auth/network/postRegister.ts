import { axios } from '@/lib/axios'
import { TRegisterForm } from '@/lib/types'

export interface IRegisterResponse {
	message: string
}

async function postRegister({
	email,
	password,
	confirmPassword,
}: TRegisterForm) {
	const response = await axios.post<IRegisterResponse>('/auth/login', {
		email,
		password,
		confirmPassword,
	})

	return response
}

export { postRegister }
