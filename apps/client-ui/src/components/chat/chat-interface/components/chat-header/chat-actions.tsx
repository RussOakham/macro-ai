import type React from 'react'

import { Menu } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface ChatActionsProps extends React.ComponentPropsWithoutRef<'div'> {
	onMobileSidebarToggle?: () => void
}

/**
 * Chat header actions component
 * Contains action buttons like mobile sidebar toggle
 */
const ChatActions = ({
	onMobileSidebarToggle,
	className,
	...props
}: ChatActionsProps): React.JSX.Element => {
	return (
		<div className={className} {...props}>
			<Button
				variant="ghost"
				size="sm"
				className="md:hidden"
				onClick={onMobileSidebarToggle}
			>
				<Menu className="h-4 w-4" />
			</Button>
		</div>
	)
}

export { ChatActions }
