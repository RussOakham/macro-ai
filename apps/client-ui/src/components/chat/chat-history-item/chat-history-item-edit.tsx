import { useTransition } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { logger } from '@/lib/logger/logger'
import { ChatWithDates } from '@/lib/types'
import { useUpdateChatMutation } from '@/services/hooks/chat/useUpdateChatMutation'

interface ChatHistoryItemEditProps {
	chat: ChatWithDates
	isPending: boolean
	editTitle: string
	editingChatId: string | null
	setEditingChatId: (chatId: string | null) => void
	setEditTitle: (title: string) => void
}

const ChatHistoryItemEdit = ({
	chat,
	isPending,
	editTitle,
	editingChatId,
	setEditingChatId,
	setEditTitle,
}: ChatHistoryItemEditProps) => {
	// Update chat mutation
	const { mutateAsync: updateChatMutation } = useUpdateChatMutation()

	const [isPendingInternal, startTransition] = useTransition()

	const cancelEdit = () => {
		setEditingChatId(null)
		setEditTitle('')
	}

	const saveEdit = () => {
		if (!editingChatId || !editTitle.trim() || isPendingInternal) return

		const trimmedTitle = editTitle.trim()

		// Don't update if title hasn't changed
		if (chat.title === trimmedTitle) {
			setEditingChatId(null)
			setEditTitle('')
			return
		}

		startTransition(async () => {
			try {
				await updateChatMutation({
					chatId: editingChatId,
					title: trimmedTitle,
				})

				logger.info('[ChatSidebar]: Chat updated successfully', {
					chatId: editingChatId,
					newTitle: trimmedTitle,
				})

				toast.success('Chat title updated successfully!')

				// Reset editing state
				setEditingChatId(null)
				setEditTitle('')
			} catch (error: unknown) {
				logger.error('[ChatSidebar]: Error updating chat', {
					chatId: editingChatId,
					newTitle: trimmedTitle,
					error: error instanceof Error ? error.message : 'Unknown error',
				})

				toast.error('Failed to update chat title. Please try again.')
				// Keep editing state active on error so user can retry
			}
		})
	}

	return (
		<div className="flex items-center gap-2">
			<Input
				value={editTitle}
				onChange={(e) => {
					setEditTitle(e.target.value)
				}}
				disabled={isPending}
				className="h-8 text-sm disabled:opacity-50"
				onKeyDown={(e) => {
					if (e.key === 'Enter') {
						saveEdit()
					}
					if (e.key === 'Escape') {
						cancelEdit()
					}
				}}
				autoFocus
			/>
			<Button
				size="sm"
				variant="ghost"
				onClick={() => {
					saveEdit()
				}}
				disabled={isPending}
				className="h-6 w-6 p-0 text-green-500 hover:text-green-600 disabled:opacity-50"
			>
				{isPending ? (
					<Loader2 className="h-3 w-3 animate-spin" />
				) : (
					<Check className="h-3 w-3" />
				)}
			</Button>
			<Button
				size="sm"
				variant="ghost"
				onClick={cancelEdit}
				disabled={isPending}
				className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground disabled:opacity-50"
			>
				<X className="h-3 w-3" />
			</Button>
		</div>
	)
}

export { ChatHistoryItemEdit }
