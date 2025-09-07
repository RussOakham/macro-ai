import type React from 'react'

interface ChatTitleProps extends React.ComponentPropsWithoutRef<'h1'> {
	title: string
}

/**
 * Chat title component
 * Displays the chat title with proper typography and styling
 * @param root0
 * @param root0.title
 * @param root0.className
 */
const ChatTitle = ({
	title,
	className,
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
