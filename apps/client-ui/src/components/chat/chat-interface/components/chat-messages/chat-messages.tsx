import type React from 'react'

import { TChatMessage } from '@/services/hooks/chat/use-enhanced-chat-mutation'

import { MessageList } from './message-list'

interface ChatMessagesProps extends React.ComponentPropsWithoutRef<'div'> {
	messages: TChatMessage[]
	status: 'ready' | 'submitted' | 'streaming' | 'error'
	messagesEndRef: React.RefObject<HTMLDivElement | null>
}

/**
 * Chat messages container component
 * Manages the scrollable messages area and auto-scroll behavior
 * @param root0
 * @param root0.messages
 * @param root0.status
 * @param root0.messagesEndRef
 * @param root0.className
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
