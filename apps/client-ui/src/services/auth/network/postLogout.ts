import { axiosWithCredentials } from '@/lib/axios'
import { ILogoutResponse } from '@/lib/types'

const postLogout = async () => {
	return axiosWithCredentials.post<ILogoutResponse>('/auth/logout')
}

export { postLogout }
