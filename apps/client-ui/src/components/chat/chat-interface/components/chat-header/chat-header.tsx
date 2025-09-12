import type React from 'react'

import { ChatActions } from './chat-actions'
import { ChatTitle } from './chat-title'

interface ChatHeaderProps extends React.ComponentPropsWithoutRef<'div'> {
	onMobileSidebarToggle?: () => void
	status: 'error' | 'ready' | 'streaming' | 'submitted'
	title: string
}

/**
 * Chat header component containing title and actions
 * Displays chat title and mobile sidebar toggle button
 */
const ChatHeader = ({
	className,
	onMobileSidebarToggle,
	status,
	title,
	...props
}: ChatHeaderProps): React.JSX.Element => {
	return (
		<div
			className={`border-b border-border p-4 flex-shrink-0 ${className ?? ''}`}
			{...props}
		>
			<div className="flex items-center justify-between w-full">
				<div className="flex items-center gap-3">
					<ChatActions onMobileSidebarToggle={onMobileSidebarToggle} />
					<ChatTitle title={title} />
				</div>

				{/* Connection Status Indicator */}
				<div className="flex items-center gap-2 text-xs">
					{status === 'streaming' ? (
						<div className="flex items-center gap-1 text-primary">
							<div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
							<span className="hidden sm:inline">Streaming</span>
						</div>
					) : null}{' '}
					{status === 'submitted' ? (
						<div className="flex items-center gap-1 text-muted-foreground">
							<div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" />
							<span className="hidden sm:inline">Processing</span>
						</div>
					) : null}{' '}
					{status === 'error' ? (
						<div className="flex items-center gap-1 text-destructive">
							<div className="w-2 h-2 bg-destructive rounded-full" />
							<span className="hidden sm:inline">Error</span>
						</div>
					) : null}
					{status === 'ready' ? (
						<div className="flex items-center gap-1 text-muted-foreground">
							<div className="w-2 h-2 bg-green-500 rounded-full" />
							<span className="hidden sm:inline">Ready</span>
						</div>
					) : null}
				</div>
			</div>
		</div>
	)
}

export { ChatHeader }
