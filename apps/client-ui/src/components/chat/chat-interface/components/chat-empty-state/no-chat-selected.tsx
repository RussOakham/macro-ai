import type React from 'react'
import { Bot } from 'lucide-react'

type NoChatSelectedProps = React.ComponentPropsWithoutRef<'div'>

/**
 * No chat selected component
 * Displays when no chat ID is provided in the route
 */
const NoChatSelected = ({
	className,
	...props
}: NoChatSelectedProps): React.JSX.Element => {
	return (
		<div
			className={`flex-1 flex items-center justify-center bg-background h-full ${className ?? ''}`}
			{...props}
		>
			<div className="text-center max-w-md">
				<Bot className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
				<h2 className="text-3xl font-semibold mb-4 text-foreground">
					ChatGPT Clone
				</h2>
				<p className="text-muted-foreground mb-6">
					Start a new conversation to begin chatting with AI
				</p>
				<div className="space-y-2 text-sm text-muted-foreground">
					<p>• Ask questions and get helpful answers</p>
					<p>• Have natural conversations</p>
					<p>• Get assistance with various topics</p>
				</div>
			</div>
		</div>
	)
}

export { NoChatSelected }
