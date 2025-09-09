import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'

import { AuthRouteLoading } from '@/components/auth/auth-route-loading'
import { ChatInterface } from '@/components/chat/chat-interface/chat-interface'
import { ChatSidebar } from '@/components/chat/chat-sidebar/chat-sidebar'
import { attemptAuthenticationWithRefresh } from '@/lib/auth/auth-utils'
import { standardizeError } from '@/lib/errors/standardize-error'
import { useGetUser } from '@/services/hooks/user/get-user'

const ChatLayout = () => {
	const { data: user, isFetching, isError, error, isSuccess } = useGetUser()
	const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

	if (isFetching && !user) {
		return <div>Loading...</div>
	}

	if (isError || !isSuccess) {
		const err = standardizeError(error)

		return <div>Error: {err.message}</div>
	}

	return (
		<div className="flex h-full w-full min-h-0 relative">
			{/* Mobile Sidebar Overlay */}
			{isMobileSidebarOpen && (
				<div
					className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
					onClick={() => {
						setIsMobileSidebarOpen(false)
					}}
					onKeyDown={(e) => {
						if (e.key === 'Escape') {
							setIsMobileSidebarOpen(false)
						}
					}}
					tabIndex={-1}
				/>
			)}

			{/* Sidebar */}
			<div
				className={`${
					isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
				} fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:z-auto`}
			>
				<ChatSidebar
					onMobileClose={() => {
						setIsMobileSidebarOpen(false)
					}}
				/>
			</div>

			{/* Main Chat Interface */}
			<div className="flex-1 min-h-0">
				<ChatInterface
					onMobileSidebarToggle={() => {
						setIsMobileSidebarOpen(!isMobileSidebarOpen)
					}}
				/>
			</div>
		</div>
	)
}

export const Route = createFileRoute('/chat')({
	component: ChatLayout,
	pendingComponent: AuthRouteLoading,
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
	},
})
