import { createFileRoute, redirect } from '@tanstack/react-router'

import { attemptAuthenticationWithRefresh } from '@/lib/auth/auth-utils'

const Index = () => {
	// This component should never render as we redirect in beforeLoad
	return null
}

export const Route = createFileRoute('/')({
	component: Index,
	beforeLoad: async ({ context, location }) => {
		const { queryClient } = context

		// Attempt authentication with automatic refresh capability
		const authResult = await attemptAuthenticationWithRefresh(queryClient)

		if (!authResult.success) {
			// eslint-disable-next-line @typescript-eslint/only-throw-error
			throw redirect({
				to: '/auth/login',
				search: {
					redirect: location.pathname,
				},
			})
		}

		// If authenticated, redirect to chat
		// eslint-disable-next-line @typescript-eslint/only-throw-error
		throw redirect({
			to: '/chat',
		})
	},
})
