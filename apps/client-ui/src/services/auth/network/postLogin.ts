import { axios } from '@/lib/axios'
import { TLoginForm } from '@/lib/types'

export interface ILoginResponse {
	message: string
}

const postLogin = async ({ email, password }: TLoginForm) => {
	const response = await axios.post<ILoginResponse>('/auth/login', {
		email,
		password,
	})

	return response
}

export { postLogin }
