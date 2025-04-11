import { createFileRoute } from '@tanstack/react-router'
import Cookies from 'js-cookie'

import { standardizeError } from '@/lib/errors/standardize-error'
import { useGetUser } from '@/services/auth/hooks/useGetUser'

const Index = () => {
	const getAccessToken = (): string => {
		return Cookies.get('macro-ai-accessToken') ?? ''
	}
	const accessToken = getAccessToken()

	const {
		data: user,
		isFetching,
		isError,
		error,
		isSuccess,
	} = useGetUser({ accessToken })

	if (isFetching && !user) {
		return <div>Loading...</div>
	}

	if (isError || !isSuccess) {
		const err = standardizeError(error)

		return <div>Error: {err.message}</div>
	}

	// TODO: Implement refresh token logic
	// TODO: Implement logout logic

	return (
		<div className="p-2">
			<h3>Welcome Home!</h3>
			<p>{JSON.stringify(user)}</p>
		</div>
	)
}

export const Route = createFileRoute('/')({
	component: Index,
})
