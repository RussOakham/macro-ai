import type React from 'react'
import { useRef } from 'react'

import { MessageList } from './message-list'

interface ChatMessagesProps extends React.ComponentPropsWithoutRef<'div'> {
	messages: {
		id: string
		role: 'user' | 'assistant' | 'system' | 'data'
		content: string
	}[]
	status: 'ready' | 'submitted' | 'streaming' | 'error'
}

/**
 * Chat messages container component
 * Manages the scrollable messages area and auto-scroll behavior
 */
const ChatMessages = ({
	messages,
	status,
	className,
	...props
}: ChatMessagesProps): React.JSX.Element => {
	const messagesEndRef = useRef<HTMLDivElement>(null)

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
