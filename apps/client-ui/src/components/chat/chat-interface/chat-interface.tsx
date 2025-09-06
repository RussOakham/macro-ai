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
	const { currentChatId, isChatError, chatError } = useChatNavigation()

	// Extract interface logic
	const {
		messages,
		input,
		handleInputChange,
		handleSubmit,
		status,
		isChatLoading,
		chatData,
		messagesEndRef,
	} = useChatInterface({
		chatId: currentChatId,
	})

	// Extract keyboard handling logic
	const { handleKeyDown, onFormSubmit } = useChatKeyboard({
		onSubmit: handleSubmit,
		input,
		currentChatId,
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
				title={chatTitle}
				onMobileSidebarToggle={onMobileSidebarToggle}
				status={status}
			/>

			{/* Messages */}
			<ChatMessages
				messages={messages}
				status={status}
				messagesEndRef={messagesEndRef}
			/>

			{/* Chat Input */}
			<ChatInput
				onSubmit={onFormSubmit}
				input={input}
				handleInputChange={handleInputChange}
				handleKeyDown={handleKeyDown}
				status={status}
			/>
		</div>
	)
}

export { ChatInterface }
