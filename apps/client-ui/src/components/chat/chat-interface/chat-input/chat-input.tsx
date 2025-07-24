import { useRef } from 'react'
import { Loader2, Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface ChatInputProps {
	onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>
	input: string
	handleInputChange: (
		e:
			| React.ChangeEvent<HTMLInputElement>
			| React.ChangeEvent<HTMLTextAreaElement>,
	) => void
	handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
	status: 'ready' | 'submitted' | 'streaming' | 'error'
}

const ChatInput = ({
	onSubmit,
	input,
	handleInputChange,
	handleKeyDown,
	status,
}: ChatInputProps) => {
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	return (
		<div className="border-t border-border bg-background flex-shrink-0">
			<div className="max-w-4xl mx-auto p-4">
				<form onSubmit={onSubmit} className="flex gap-3">
					<div className="flex-1 relative">
						<Textarea
							ref={textareaRef}
							value={input}
							onChange={handleInputChange}
							onKeyDown={handleKeyDown}
							placeholder="Send a message..."
							className="min-h-[44px] max-h-32 resize-none pr-12"
							disabled={status === 'streaming'}
							rows={1}
						/>
						<Button
							type="submit"
							disabled={!input.trim() || status === 'streaming'}
							size="sm"
							className={`absolute right-2 bottom-2 h-8 w-8 p-0 transition-all duration-200 ${
								status === 'streaming'
									? 'bg-primary hover:bg-primary/90'
									: 'bg-foreground hover:bg-foreground/90'
							}`}
						>
							{status === 'streaming' ? (
								<Loader2 className="h-3 w-3 animate-spin text-primary-foreground" />
							) : (
								<Send className="h-3 w-3 text-background" />
							)}
						</Button>
					</div>
				</form>
				<div className="text-xs text-muted-foreground text-center mt-2">
					ChatGPT Clone can make mistakes. Consider checking important
					information.
				</div>
			</div>
		</div>
	)
}

export { ChatInput }
