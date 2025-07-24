import type React from 'react'

interface ConnectionStatusProps extends React.ComponentPropsWithoutRef<'div'> {
	status: 'ready' | 'submitted' | 'streaming' | 'error'
}

/**
 * Connection status display component
 * Shows the current connection/processing status with visual indicators
 */
const ConnectionStatus = ({
	status,
	className,
	...props
}: ConnectionStatusProps): React.JSX.Element => {
	if (status === 'streaming') {
		return (
			<div
				className={`flex items-center gap-1 text-primary ${className ?? ''}`}
				{...props}
			>
				<div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
				<span className="hidden sm:inline">Streaming</span>
			</div>
		)
	}

	if (status === 'submitted') {
		return (
			<div
				className={`flex items-center gap-1 text-muted-foreground ${className ?? ''}`}
				{...props}
			>
				<div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" />
				<span className="hidden sm:inline">Processing</span>
			</div>
		)
	}

	// Default ready state
	return (
		<div
			className={`flex items-center gap-1 text-muted-foreground ${className ?? ''}`}
			{...props}
		>
			<div className="w-2 h-2 bg-green-500 rounded-full" />
			<span className="hidden sm:inline">Ready</span>
		</div>
	)
}

export { ConnectionStatus }
