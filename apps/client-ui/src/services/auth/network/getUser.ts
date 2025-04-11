import { axiosWithCredentials } from '@/lib/axios'
import { TGetUser } from '@/lib/types'
import { TUser } from '@/lib/types/user'

const getUser = async ({ accessToken }: TGetUser) => {
	const response = await axiosWithCredentials.get<TUser>('/auth/user', {
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${accessToken}`,
		},
	})

	return response.data
}

export { getUser }
