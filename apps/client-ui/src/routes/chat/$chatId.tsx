import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import Cookies from 'js-cookie'
import { z } from 'zod'

import { ChatInterface } from '@/components/chat/chat-interface/chat-interface'
import { ChatSidebar } from '@/components/chat/chat-sidebar/chat-sidebar'
import { QUERY_KEY } from '@/constants/query-keys'
import { standardizeError } from '@/lib/errors/standardize-error'
import { logger } from '@/lib/logger/logger'
import { useGetUser } from '@/services/hooks/user/getUser'
import {
	getAuthUser,
	TGetAuthUserResponse,
} from '@/services/network/auth/getAuthUser'

// Route parameter validation schema
const chatParamsSchema = z.object({
	chatId: z.string().uuid('Invalid chat ID format'),
})

const ChatPage = () => {
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

export const Route = createFileRoute('/chat/$chatId')({
	component: ChatPage,
	params: {
		parse: (params) => chatParamsSchema.parse(params),
		stringify: ({ chatId }) => ({ chatId }),
	},
	beforeLoad: async ({ context, location, params }) => {
		const { queryClient } = context
		const accessToken = Cookies.get('macro-ai-accessToken')

		// If no access token, redirect to login
		if (!accessToken) {
			// eslint-disable-next-line @typescript-eslint/only-throw-error
			throw redirect({
				to: '/auth/login',
				search: {
					redirect: location.pathname,
				},
			})
		}

		// Validate chatId parameter
		try {
			chatParamsSchema.parse(params)
		} catch (error) {
			logger.error('Invalid chat ID parameter', { params, error })
			// eslint-disable-next-line @typescript-eslint/only-throw-error
			throw redirect({
				to: '/chat',
			})
		}

		// Try to get authenticated user data to verify token validity
		try {
			// Check if we already have cached auth user data
			const cachedAuthUser = queryClient.getQueryData<TGetAuthUserResponse>([
				QUERY_KEY.authUser,
			])

			if (!cachedAuthUser) {
				// If no cached data, fetch auth user to validate token
				const authUser = await getAuthUser()

				// Cache the auth user data
				queryClient.setQueryData([QUERY_KEY.authUser], authUser)

				// If auth user doesn't have an ID, redirect to login
				if (!authUser.id) {
					// eslint-disable-next-line @typescript-eslint/only-throw-error
					throw redirect({
						to: '/auth/login',
						search: {
							redirect: location.pathname,
						},
					})
				}
				return
			}
		} catch (error: unknown) {
			// If auth check fails, redirect to login

			const err = standardizeError(error)

			logger.error(`Auth check failed: ${err.message}`)
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
