import { axiosWithCredentials } from '@/lib/axios'

import { ILoginResponse } from './postLogin'

const postRefreshToken = async () => {
	const response =
		await axiosWithCredentials.post<ILoginResponse>('/auth/refresh')

	return response.data
}

export { postRefreshToken }
