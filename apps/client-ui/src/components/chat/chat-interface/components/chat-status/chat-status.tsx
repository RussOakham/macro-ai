import type React from 'react'

import { ConnectionStatus } from './connection-status'
import { TypingIndicator } from './typing-indicator'

interface ChatStatusProps extends React.ComponentPropsWithoutRef<'div'> {
	status: 'ready' | 'submitted' | 'streaming' | 'error'
}

/**
 * Chat status indicator component
 * Displays current chat status with appropriate visual indicators
 */
const ChatStatus = ({
	status,
	className,
	...props
}: ChatStatusProps): React.JSX.Element => {
	return (
		<div
			className={`flex items-center gap-2 text-xs ${className ?? ''}`}
			{...props}
		>
			<ConnectionStatus status={status} />
			{status === 'streaming' && <TypingIndicator />}
		</div>
	)
}

export { ChatStatus }
