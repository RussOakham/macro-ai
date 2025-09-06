import { Bot, User } from 'lucide-react'

import { TChatMessage } from '@/services/hooks/chat/use-enhanced-chat-mutation'

interface ChatMessageProps {
	message: TChatMessage
}

const ChatMessage = ({ message }: ChatMessageProps) => {
	return (
		<div
			className={`border-b border-border ${message.role === 'assistant' ? 'bg-muted/50' : 'bg-background'}`}
		>
			<div className="max-w-4xl mx-auto p-6">
				<div className="flex gap-6">
					<div className="flex-shrink-0">
						<div
							className={`w-8 h-8 rounded-full flex items-center justify-center ${
								message.role === 'assistant' ? 'bg-primary' : 'bg-secondary'
							}`}
						>
							{message.role === 'assistant' ? (
								<Bot className="h-4 w-4 text-primary-foreground" />
							) : (
								<User className="h-4 w-4 text-secondary-foreground" />
							)}
						</div>
					</div>
					<div className="flex-1 min-w-0">
						<div className="prose prose-sm max-w-none">
							<div className="whitespace-pre-wrap break-words text-foreground">
								{message.content}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export { ChatMessage }
