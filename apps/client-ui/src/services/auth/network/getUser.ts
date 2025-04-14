import { axiosWithCredentials } from '@/lib/axios'
import { TUser } from '@/lib/types/user'

const getUser = async () => {
	const response = await axiosWithCredentials.get<TUser>('/auth/user')

	return response.data
}

export { getUser }
