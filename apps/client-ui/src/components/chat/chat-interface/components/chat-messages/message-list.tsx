import type React from 'react'

import { ChatMessage } from '@/components/chat/chat-message/chat-message'
import { ChatMessageLoadingIndicator } from '@/components/chat/chat-message/chat-message-loading-indicator'
import { ChatMessageStreamingIndicator } from '@/components/chat/chat-message/chat-message-streaming-indicator'

import { ChatEmptyState } from '../chat-empty-state/chat-empty-state'

interface MessageListProps extends React.ComponentPropsWithoutRef<'div'> {
	messages: {
		id: string
		role: 'user' | 'assistant' | 'system' | 'data'
		content: string
	}[]
	status: 'ready' | 'submitted' | 'streaming' | 'error'
}

/**
 * Scrollable message list component
 * Renders messages, loading states, and empty state
 * @param root0
 * @param root0.messages
 * @param root0.status
 * @param root0.className
 */
const MessageList = ({
	messages,
	status,
	className,
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
