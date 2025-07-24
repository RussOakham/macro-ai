import type React from 'react'

type TypingIndicatorProps = React.ComponentPropsWithoutRef<'div'>

/**
 * AI typing indicator component
 * Shows when AI is actively typing/streaming a response
 */
const TypingIndicator = ({
	className,
	...props
}: TypingIndicatorProps): React.JSX.Element => {
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

export { TypingIndicator }
