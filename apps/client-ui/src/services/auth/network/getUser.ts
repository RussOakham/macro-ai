import { axiosWithCredentials } from '@/lib/axios'
import { TGetUser } from '@/lib/types'

export interface IUserResponse {
	message: string
}

const getUser = async ({ accessToken }: TGetUser) => {
	const response = await axiosWithCredentials.get('/auth/user', {
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${accessToken}`,
		},
	})

	return response
}

export { getUser }
