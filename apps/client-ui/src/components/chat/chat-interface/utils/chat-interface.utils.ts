/**
 * Chat interface utility functions
 * Helper functions for chat interface operations
 */

/**
 * Extracts chat ID from pathname using regex
 * @param pathname - The current route pathname
 * @returns Chat ID if found, null otherwise
 */
export const extractChatIdFromPath = (pathname: string): string | null => {
	const chatIdRegex = /^\/chat\/([^/]+)$/
	const chatIdMatch = chatIdRegex.exec(pathname)
	return chatIdMatch?.[1] ?? null
}

/**
 * Determines if the chat interface should show empty state
 * @param messagesLength - Number of messages in the chat
 * @param status - Current chat status
 * @returns True if empty state should be shown
 */
export const shouldShowEmptyState = (
	messagesLength: number,
	status: 'ready' | 'submitted' | 'streaming' | 'error',
): boolean => {
	return (
		messagesLength === 0 && status !== 'streaming' && status !== 'submitted'
	)
}

/**
 * Generates chat title fallback text
 * @param chatId - The current chat ID
 * @returns Fallback title string
 */
export const generateChatTitleFallback = (chatId: string): string => {
	return `Chat ${chatId}`
}

/**
 * Checks if form submission should be prevented
 * @param input - Current input value
 * @param chatId - Current chat ID
 * @param status - Current chat status
 * @returns True if submission should be prevented
 */
export const shouldPreventSubmission = (
	input: string,
	chatId: string | null,
	status: 'ready' | 'submitted' | 'streaming' | 'error',
): boolean => {
	return !input.trim() || !chatId || status === 'streaming'
}
