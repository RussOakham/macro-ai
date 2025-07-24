import type React from 'react'

import { ChatActions } from './chat-actions'
import { ChatTitle } from './chat-title'

interface ChatHeaderProps extends React.ComponentPropsWithoutRef<'div'> {
	title: string
	onMobileSidebarToggle?: () => void
	status: 'ready' | 'submitted' | 'streaming' | 'error'
}

/**
 * Chat header component containing title and actions
 * Displays chat title and mobile sidebar toggle button
 */
const ChatHeader = ({
	title,
	onMobileSidebarToggle,
	status,
	className,
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
					) : status === 'submitted' ? (
						<div className="flex items-center gap-1 text-muted-foreground">
							<div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" />
							<span className="hidden sm:inline">Processing</span>
						</div>
					) : status === 'error' ? (
						<div className="flex items-center gap-1 text-destructive">
							<div className="w-2 h-2 bg-destructive rounded-full" />
							<span className="hidden sm:inline">Error</span>
						</div>
					) : (
						<div className="flex items-center gap-1 text-muted-foreground">
							<div className="w-2 h-2 bg-green-500 rounded-full" />
							<span className="hidden sm:inline">Ready</span>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

export { ChatHeader }
