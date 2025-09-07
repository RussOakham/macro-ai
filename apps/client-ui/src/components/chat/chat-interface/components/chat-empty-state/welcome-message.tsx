import type React from 'react'

import { Bot } from 'lucide-react'

type WelcomeMessageProps = React.ComponentPropsWithoutRef<'div'>

/**
 * Welcome message component
 * Displays introductory message when chat is empty
 * @param root0
 * @param root0.className
 */
const WelcomeMessage = ({
	className,
	...props
}: WelcomeMessageProps): React.JSX.Element => {
	return (
		<div className={`text-center max-w-md ${className ?? ''}`} {...props}>
			<Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
			<h3 className="text-xl font-medium mb-2 text-foreground">
				Start the conversation
			</h3>
			<p className="text-muted-foreground">
				Send a message to begin chatting with AI
			</p>
		</div>
	)
}

export { WelcomeMessage }
