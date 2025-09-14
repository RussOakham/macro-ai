import { Bot } from 'lucide-react'

const ChatMessageStreamingIndicator: React.FC = () => {
	return (
		<div className="border-b border-border bg-gradient-to-r from-muted/50 to-accent/50">
			<div className="max-w-4xl mx-auto p-6">
				<div className="flex gap-6">
					<div className="flex-shrink-0">
						<div className="w-8 h-8 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center animate-pulse">
							<Bot className="h-4 w-4 text-primary-foreground" />
						</div>
					</div>
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-3">
							<div className="flex gap-1">
								<div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
								<div
									className="w-2 h-2 bg-primary rounded-full animate-bounce"
									style={{ animationDelay: '0.1s' }}
								/>
								<div
									className="w-2 h-2 bg-primary rounded-full animate-bounce"
									style={{ animationDelay: '0.2s' }}
								/>
							</div>
							<span className="text-sm text-primary font-medium">
								AI is thinking...
							</span>
							<div className="flex items-center gap-1 text-xs text-muted-foreground">
								<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
								<span>Connected</span>
							</div>
						</div>
						<div className="mt-2">
							<div className="w-full bg-muted rounded-full h-1">
								<div className="bg-gradient-to-r from-primary to-accent h-1 rounded-full animate-pulse w-3/4" />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export { ChatMessageStreamingIndicator }
