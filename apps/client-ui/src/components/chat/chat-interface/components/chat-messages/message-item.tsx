import type React from 'react'

import { ChatMessage } from '@/components/chat/chat-message/chat-message'
import { TChatMessage } from '@/services/hooks/chat/useEnhancedChat'

interface MessageItemProps extends React.ComponentPropsWithoutRef<'div'> {
	message: TChatMessage
}

/**
 * Individual message component wrapper
 * Wraps the existing ChatMessage component for consistency
 */
const MessageItem = ({
	message,
	className,
	...props
}: MessageItemProps): React.JSX.Element => {
	return (
		<div className={className} {...props}>
			<ChatMessage message={message} />
		</div>
	)
}

export { MessageItem }
