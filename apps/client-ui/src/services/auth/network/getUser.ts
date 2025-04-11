import { axiosWithCredentials } from '@/lib/axios'
import { TGetUser } from '@/lib/types'

export interface IUserResponse {
	id: string
	email: string
	emailVerified: boolean
}

const getUser = async ({ accessToken }: TGetUser) => {
	const response = await axiosWithCredentials.get<IUserResponse>('/auth/user', {
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${accessToken}`,
		},
	})

	return response.data
}

export { getUser }
