import { axiosWithCredentials } from '@/lib/axios'
import { TLoginForm } from '@/lib/types'

interface ILoginResponse {
	accessToken: string
	refreshToken: string
	expiresIn: number
}

// TODO: Update API response schemas with Cognito types, and generate via swagger
const postLogin = async ({ email, password }: TLoginForm) => {
	const response = await axiosWithCredentials.post<ILoginResponse>(
		'/auth/login',
		{
			email,
			password,
		},
	)

	return response
}

export { type ILoginResponse, postLogin }
