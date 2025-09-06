import type React from 'react'

import { WelcomeMessage } from './welcome-message'

type ChatEmptyStateProps = React.ComponentPropsWithoutRef<'div'>

/**
 * Empty chat state component
 * Displays when no messages are present in the chat
 * @param root0
 * @param root0.className
 */
const ChatEmptyState = ({
	className,
	...props
}: ChatEmptyStateProps): React.JSX.Element => {
	return (
		<div
			className={`flex-1 flex items-center justify-center h-full ${className ?? ''}`}
			{...props}
		>
			<WelcomeMessage />
		</div>
	)
}

export { ChatEmptyState }
