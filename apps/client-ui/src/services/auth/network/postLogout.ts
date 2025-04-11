import { axiosWithCredentials } from '@/lib/axios'

interface ILogoutResponse {
	message: string
}

// Logout reads accessToken and refreshToken from cookies header
const postLogout = async () => {
	const response =
		await axiosWithCredentials.post<ILogoutResponse>('/auth/logout')

	return response
}

export { type ILogoutResponse, postLogout }
