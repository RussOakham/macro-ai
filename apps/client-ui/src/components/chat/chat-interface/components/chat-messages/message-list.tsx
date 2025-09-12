import type React from 'react'

import { ChatMessage } from '@/components/chat/chat-message/chat-message'
import { ChatMessageLoadingIndicator } from '@/components/chat/chat-message/chat-message-loading-indicator'
import { ChatMessageStreamingIndicator } from '@/components/chat/chat-message/chat-message-streaming-indicator'

import { ChatEmptyState } from '../chat-empty-state/chat-empty-state'

interface MessageListProps extends React.ComponentPropsWithoutRef<'div'> {
	messages: {
		content: string
		id: string
		role: 'assistant' | 'data' | 'system' | 'user'
	}[]
	status: 'error' | 'ready' | 'streaming' | 'submitted'
}

/**
 * Scrollable message list component
 * Renders messages, loading states, and empty state
 */
const MessageList = ({
	className,
	messages,
	status,
	...props
}: MessageListProps): React.JSX.Element => {
	// Show empty state when no messages and not processing
	if (
		messages.length === 0 &&
		status !== 'streaming' &&
		status !== 'submitted'
	) {
		return (
			<div className={className} {...props}>
				<ChatEmptyState />
			</div>
		)
	}

	return (
		<div className={className} {...props}>
			{messages.map((message) => (
				<ChatMessage key={message.id} message={message} />
			))}

			{/* Loading state indicator - appears after message submission */}
			{status === 'submitted' ? <ChatMessageLoadingIndicator /> : null}

			{/* Enhanced streaming indicator */}
			{status === 'streaming' ? <ChatMessageStreamingIndicator /> : null}
		</div>
	)
}

export { MessageList }
