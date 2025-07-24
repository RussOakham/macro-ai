import { Bot } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { IStandardizedError } from '@/lib/types'
import { router } from '@/main'

interface ChatInterfaceErrorProps {
	error: IStandardizedError
}

const ChatInterfaceError = ({ error }: ChatInterfaceErrorProps) => {
	return (
		<div className="flex-1 flex items-center justify-center h-full bg-background">
			<div className="text-center max-w-md">
				<Bot className="h-16 w-16 mx-auto mb-6 text-destructive" />
				<h2 className="text-2xl font-semibold mb-4 text-foreground">
					Error Loading Chat
				</h2>
				<p className="text-destructive mb-6">{error.message}</p>
				<Button
					onClick={async () => {
						await router.invalidate()
					}}
					variant="outline"
				>
					Try Again
				</Button>
			</div>
		</div>
	)
}

export { ChatInterfaceError }
