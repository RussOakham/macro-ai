import { createFileRoute } from '@tanstack/react-router'

import { standardizeError } from '@/lib/errors/standardize-error'
import { useGetUser } from '@/services/hooks/user/getUser'

const Index = () => {
	const { data: user, isFetching, isError, error, isSuccess } = useGetUser()

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
