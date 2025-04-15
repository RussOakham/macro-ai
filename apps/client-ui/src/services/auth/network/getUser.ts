import { TGetUserResponse } from '@repo/types-macro-ai-api'

import { axiosWithCredentials } from '@/lib/axios'

const getUser = async () => {
	const response =
		await axiosWithCredentials.get<TGetUserResponse>('/auth/user')

	return response.data
}

export { getUser }
