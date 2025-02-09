import { axiosWithCredentials } from '@/lib/axios'
import { TGetUser } from '@/lib/types'

export interface IUserResponse {
	message: string
}

const getUser = async ({ accessToken }: TGetUser) => {
	const response = await axiosWithCredentials.post<IUserResponse>(
		'/auth/user',
		{
			accessToken,
		},
	)

	return response
}

export { getUser }
