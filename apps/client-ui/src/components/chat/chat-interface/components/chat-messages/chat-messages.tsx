import type React from 'react'

import { MessageList } from './message-list'

interface ChatMessagesProps extends React.ComponentPropsWithoutRef<'div'> {
	messages: {
		id: string
		role: 'user' | 'assistant' | 'system' | 'data'
		content: string
	}[]
	status: 'ready' | 'submitted' | 'streaming' | 'error'
	messagesEndRef: React.RefObject<HTMLDivElement | null>
}

/**
 * Chat messages container component
 * Manages the scrollable messages area and auto-scroll behavior
 */
const ChatMessages = ({
	messages,
	status,
	messagesEndRef,
	className,
	...props
}: ChatMessagesProps): React.JSX.Element => {
	return (
		<div
			className={`flex-1 overflow-y-auto min-h-0 ${className ?? ''}`}
			{...props}
		>
			<MessageList messages={messages} status={status} />
			<div ref={messagesEndRef} />
		</div>
	)
}

export { ChatMessages }
