import type React from 'react'

interface UseChatKeyboardOptions {
	onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>
	input: string
	currentChatId: string | null
	status: 'ready' | 'submitted' | 'streaming' | 'error'
}

interface UseChatKeyboardReturn {
	handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
	onFormSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>
}

/**
 * Chat keyboard shortcut handling hook
 * Manages keyboard interactions and form submission logic
 * @param options - Configuration options for keyboard handling
 * @param options.onSubmit - Function to call when form is submitted
 * @param options.input - Current input value
 * @param options.currentChatId - ID of the current active chat
 * @param options.status - Current chat status
 */
const useChatKeyboard = ({
	onSubmit,
	input,
	currentChatId,
	status,
}: UseChatKeyboardOptions): UseChatKeyboardReturn => {
	// Handle form submission with enhanced handler
	const onFormSubmit = async (
		e: React.FormEvent<HTMLFormElement>,
	): Promise<void> => {
		e.preventDefault()
		if (!input.trim() || !currentChatId || status === 'streaming') {
			return
		}
		await onSubmit(e)
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			// Create a synthetic form event for submission
			const formEvent = new Event('submit', {
				bubbles: true,
				cancelable: true,
			}) as unknown as React.FormEvent<HTMLFormElement>
			void onFormSubmit(formEvent)
		}
	}

	return {
		handleKeyDown,
		onFormSubmit,
	}
}

export { useChatKeyboard }
