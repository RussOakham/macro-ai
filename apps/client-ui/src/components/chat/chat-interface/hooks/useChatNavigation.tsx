import { useMemo } from 'react'
import { useRouterState } from '@tanstack/react-router'

interface UseChatNavigationReturn {
	currentChatId: string | null
	isChatError: boolean
	chatError: Error | null
}

/**
 * Chat navigation and routing logic hook
 * Manages chat ID extraction from route and error states
 */
const useChatNavigation = (): UseChatNavigationReturn => {
	// Use useRouterState to get the current location and extract chatId
	// This ensures we get updates when the route changes
	const routerState = useRouterState()

	const currentChatId = useMemo(() => {
		// Extract chatId from the current location pathname
		const pathname = routerState.location.pathname
		const chatIdRegex = /^\/chat\/([^/]+)$/
		const chatIdMatch = chatIdRegex.exec(pathname)
		return chatIdMatch?.[1] ?? null
	}, [routerState.location.pathname])

	// Handle case where no chat ID is provided
	const isChatError = !currentChatId
	const chatError = !currentChatId ? new Error('No chat ID provided') : null

	return {
		currentChatId,
		isChatError,
		chatError,
	}
}

export { useChatNavigation }
