import { useState, useTransition } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { logger } from '@/lib/logger/logger'

import { ChatHistoryList } from '../chat-history-list/chat-history-list'
import { CreateChatForm } from '../create-chat-form/create-chat-form'

interface ChatSidebarProps {
	onMobileClose?: () => void
}

const ChatSidebar = ({ onMobileClose }: ChatSidebarProps) => {
	const navigate = useNavigate()

	const [showCreateForm, setShowCreateForm] = useState(false)

	// React 19 useTransition for better UX
	const [isPending, startTransition] = useTransition()

	const createNewChat = () => {
		setShowCreateForm(true)
		logger.info('[ChatSidebar]: Create new chat form opened')
	}

	const handleCreateChatSuccess = (chatId: string) => {
		setShowCreateForm(false)
		startTransition(() => {
			void navigate({ to: `/chat/${chatId}` })
			logger.info(
				'[ChatSidebar]: Chat created successfully, navigating to chat',
				{
					chatId,
				},
			)
		})
	}

	const handleCreateChatCancel = () => {
		setShowCreateForm(false)
		logger.info('[ChatSidebar]: Create chat form cancelled')
	}

	return (
		<div className="w-64 bg-card text-card-foreground flex flex-col h-full min-h-0 border-r border-border">
			{/* Header */}
			<div className="p-3 border-b border-border flex-shrink-0">
				<Button
					onClick={createNewChat}
					className="w-full justify-start gap-3"
					variant="outline"
				>
					<Plus className="h-4 w-4" />
					New chat
				</Button>
			</div>

			{/* Create Chat Form */}
			{showCreateForm ? (
				<div className="p-3 border-b border-border bg-muted flex-shrink-0">
					<CreateChatForm
						onSuccess={handleCreateChatSuccess}
						onCancel={handleCreateChatCancel}
						className="text-foreground"
					/>
				</div>
			) : null}

			{/* Chat List */}
			<div className="flex-1 overflow-y-auto min-h-0">
				<ChatHistoryList isPending={isPending} onMobileClose={onMobileClose} />
			</div>

			{/* Footer */}
			<div className="p-3 border-t border-gray-700">
				<div className="text-xs text-gray-400">ChatGPT Clone</div>
			</div>
		</div>
	)
}

export { ChatSidebar }
