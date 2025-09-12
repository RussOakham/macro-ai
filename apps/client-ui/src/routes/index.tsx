import type { QueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'

import { AuthRouteLoading } from '@/components/auth/auth-route-loading'
import { attemptAuthenticationWithRefresh } from '@/lib/auth/auth-utils'

const Index = () => {
	// This component should never render as we redirect in beforeLoad
	return null
}

export const Route = createFileRoute('/')({
	beforeLoad: async ({ context, location }) => {
		const { queryClient } = context as { queryClient: QueryClient }

		// Attempt authentication with automatic refresh capability
		const authResult = await attemptAuthenticationWithRefresh(queryClient)

		if (!authResult.success) {
			// eslint-disable-next-line @typescript-eslint/only-throw-error
			throw redirect({
				search: {
					redirect: location.pathname,
				},
				to: '/auth/login',
			})
		}

		// If authenticated, redirect to chat
		// eslint-disable-next-line @typescript-eslint/only-throw-error
		throw redirect({
			to: '/chat',
		})
	},
	component: Index,
	pendingComponent: AuthRouteLoading,
})
