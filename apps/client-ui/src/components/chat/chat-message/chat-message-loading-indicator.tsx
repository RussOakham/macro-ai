import { Bot } from 'lucide-react'

const ChatMessageLoadingIndicator: React.FC = () => {
	return (
		<div className="border-b border-border bg-muted/30">
			<div className="max-w-4xl mx-auto p-6">
				<div className="flex gap-6">
					<div className="flex-shrink-0">
						<div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
							<Bot className="h-4 w-4 text-primary-foreground" />
						</div>
					</div>
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-3">
							<div className="flex gap-1">
								<div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-pulse" />
								<div
									className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-pulse"
									style={{ animationDelay: '0.2s' }}
								/>
								<div
									className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-pulse"
									style={{ animationDelay: '0.4s' }}
								/>
							</div>
							<span className="text-sm text-muted-foreground">
								Preparing response...
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export { ChatMessageLoadingIndicator }
