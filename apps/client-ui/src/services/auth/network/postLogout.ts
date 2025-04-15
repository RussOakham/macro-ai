import { IAuthResponse } from '@repo/types-macro-ai-api'

import { axiosWithCredentials } from '@/lib/axios'

const postLogout = async () => {
	return axiosWithCredentials.post<IAuthResponse>('/auth/logout')
}

export { postLogout }
