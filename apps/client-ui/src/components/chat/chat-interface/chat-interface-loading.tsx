import { Loader2 } from 'lucide-react'

const ChatInterfaceLoading: React.FC = () => {
	return (
		<div className="flex-1 flex items-center justify-center bg-background h-full">
			<div className="text-center">
				<Loader2 className="h-8 w-8 mx-auto mb-4 text-foreground animate-spin" />
				<p className="text-muted-foreground">Loading chat...</p>
			</div>
		</div>
	)
}

export { ChatInterfaceLoading }
