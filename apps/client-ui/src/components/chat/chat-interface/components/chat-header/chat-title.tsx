import type React from 'react'

interface ChatTitleProps extends React.ComponentPropsWithoutRef<'h1'> {
	title: string
}

/**
 * Chat title component
 * Displays the chat title with proper typography and styling
 */
const ChatTitle = ({
	className,
	title,
	...props
}: ChatTitleProps): React.JSX.Element => {
	return (
		<h1
			className={`font-semibold text-foreground ${className ?? ''}`}
			{...props}
		>
			{title}
		</h1>
	)
}

export { ChatTitle }
