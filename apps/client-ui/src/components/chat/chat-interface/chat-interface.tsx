import type React from 'react'

import { standardizeError } from '@/lib/errors/standardize-error'

import { ChatInput } from './chat-input/chat-input'
import { ChatInterfaceError } from './chat-interface-error'
import { ChatInterfaceLoading } from './chat-interface-loading'
import { NoChatSelected } from './components/chat-empty-state/no-chat-selected'
import { ChatHeader } from './components/chat-header/chat-header'
import { ChatMessages } from './components/chat-messages/chat-messages'
import { useChatInterface } from './hooks/use-chat-interface'
import { useChatKeyboard } from './hooks/use-chat-keyboard'
import { useChatNavigation } from './hooks/use-chat-navigation'
import { generateChatTitleFallback } from './utils/chat-interface.utils'

interface ChatInterfaceProps {
	onMobileSidebarToggle?: () => void
}

const ChatInterface = ({
	onMobileSidebarToggle,
}: ChatInterfaceProps): React.JSX.Element => {
	// Extract navigation logic
	const { chatError, currentChatId, isChatError } = useChatNavigation()

	// Extract interface logic
	const {
		chatData,
		handleInputChange,
		handleSubmit,
		input,
		isChatLoading,
		messages,
		messagesEndRef,
		status,
	} = useChatInterface({
		chatId: currentChatId,
	})

	// Extract keyboard handling logic
	const { handleKeyDown, onFormSubmit } = useChatKeyboard({
		currentChatId,
		input,
		onSubmit: handleSubmit,
		status,
	})

	// Handle no chat selected
	if (!currentChatId) {
		return <NoChatSelected />
	}

	// Handle loading state for chat data
	if (isChatLoading) {
		return <ChatInterfaceLoading />
	}

	// Handle error state for chat data
	if (isChatError) {
		const err = standardizeError(chatError)
		return <ChatInterfaceError error={err} />
	}

	// Generate chat title with fallback
	const chatTitle =
		chatData?.data.title ?? generateChatTitleFallback(currentChatId)

	return (
		<div className="flex-1 flex flex-col h-full bg-background min-h-0">
			{/* Header */}
			<ChatHeader
				onMobileSidebarToggle={onMobileSidebarToggle}
				status={status}
				title={chatTitle}
			/>

			{/* Messages */}
			<ChatMessages
				messages={messages}
				messagesEndRef={messagesEndRef}
				status={status}
			/>

			{/* Chat Input */}
			<ChatInput
				handleInputChange={handleInputChange}
				handleKeyDown={handleKeyDown}
				input={input}
				onSubmit={onFormSubmit}
				status={status}
			/>
		</div>
	)
}

export { ChatInterface }
