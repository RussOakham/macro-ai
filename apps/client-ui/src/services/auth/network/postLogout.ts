import { axios } from '@/lib/axios'
import { ILogoutResponse } from '@/lib/types'

const postLogout = async () => {
	return axios.post<ILogoutResponse>('/auth/logout')
}

export { postLogout }
