import { createFileRoute } from '@tanstack/react-router'

import { standardizeError } from '@/lib/errors/standardize-error'
import { useGetAuthUser } from '@/services/hooks/auth/useGetAuthUser'

const Index = () => {
	const { data: user, isFetching, isError, error, isSuccess } = useGetAuthUser()

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
