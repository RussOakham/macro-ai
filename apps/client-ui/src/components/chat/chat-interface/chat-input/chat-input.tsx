import { Loader2, Send } from 'lucide-react'
import { useRef } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface ChatInputProps {
	handleInputChange: (
		e:
			| React.ChangeEvent<HTMLInputElement>
			| React.ChangeEvent<HTMLTextAreaElement>,
	) => void
	handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
	input: string
	onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>
	status: 'error' | 'ready' | 'streaming' | 'submitted'
}

const ChatInput = ({
	handleInputChange,
	handleKeyDown,
	input,
	onSubmit,
	status,
}: ChatInputProps) => {
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	return (
		<div className="border-t border-border bg-background flex-shrink-0">
			<div className="max-w-4xl mx-auto p-4">
				<form className="flex gap-3" onSubmit={onSubmit}>
					<div className="flex-1 relative">
						<Textarea
							className="min-h-[44px] max-h-32 resize-none pr-12"
							disabled={status === 'streaming'}
							onChange={handleInputChange}
							onKeyDown={handleKeyDown}
							placeholder="Send a message..."
							ref={textareaRef}
							rows={1}
							value={input}
						/>
						<Button
							className={`absolute right-2 bottom-2 h-8 w-8 p-0 transition-all duration-200 ${
								status === 'streaming'
									? 'bg-primary hover:bg-primary/90'
									: 'bg-foreground hover:bg-foreground/90'
							}`}
							disabled={!input.trim() || status === 'streaming'}
							size="sm"
							type="submit"
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
