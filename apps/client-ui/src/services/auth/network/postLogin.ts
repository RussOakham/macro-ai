import { axios } from '@/lib/axios'
import { TLoginForm } from '@/lib/types'

export interface ILoginResponse {
	message: string
}

async function postLogin({ email, password }: TLoginForm) {
	const response = await axios.post<ILoginResponse>('/auth/login', {
		email,
		password,
	})

	return response
}

export { postLogin }
