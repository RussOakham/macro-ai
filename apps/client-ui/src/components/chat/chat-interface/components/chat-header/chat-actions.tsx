import { Menu } from 'lucide-react'
import type React from 'react'

import { Button } from '@/components/ui/button'

interface ChatActionsProps extends React.ComponentPropsWithoutRef<'div'> {
	onMobileSidebarToggle?: () => void
}

/**
 * Chat header actions component
 * Contains action buttons like mobile sidebar toggle
 */
const ChatActions = ({
	className,
	onMobileSidebarToggle,
	...props
}: ChatActionsProps): React.JSX.Element => {
	return (
		<div className={className} {...props}>
			<Button
				className="md:hidden"
				onClick={onMobileSidebarToggle}
				size="sm"
				variant="ghost"
			>
				<Menu className="h-4 w-4" />
			</Button>
		</div>
	)
}

export { ChatActions }
