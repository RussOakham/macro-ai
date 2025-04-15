import { TLoginResponse } from '@repo/types-macro-ai-api'

import { axiosWithCredentials } from '@/lib/axios'

const postRefreshToken = async () => {
	const response =
		await axiosWithCredentials.post<TLoginResponse>('/auth/refresh')

	return response.data
}

export { postRefreshToken }
