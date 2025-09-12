import type React from 'react'

import type { TChatMessage } from '@/services/hooks/chat/use-enhanced-chat-mutation'

import { MessageList } from './message-list'

interface ChatMessagesProps extends React.ComponentPropsWithoutRef<'div'> {
	messages: TChatMessage[]
	messagesEndRef: React.RefObject<HTMLDivElement | null>
	status: 'error' | 'ready' | 'streaming' | 'submitted'
}

/**
 * Chat messages container component
 * Manages the scrollable messages area and auto-scroll behavior
 */
const ChatMessages = ({
	className,
	messages,
	messagesEndRef,
	status,
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
