import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { standardizeError } from '@/lib/errors/standardize-error'
import { logger } from '@/lib/logger/logger'
import { cn } from '@/lib/utils'
import { useCreateChatMutation } from '@/services/hooks/chat/use-create-chat-mutation'
import {
	type CreateChatRequest,
	zCreateChatRequest,
} from '@/services/network/chat/create-chat'

import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '../../ui/form'

interface CreateChatFormProps {
	className?: string
	onSuccess?: (chatId: string) => void
	onCancel?: () => void
}

const CreateChatForm = ({
	className,
	onSuccess,
	onCancel,
	...props
}: CreateChatFormProps & React.ComponentPropsWithoutRef<'div'>) => {
	const [isPending, setIsPending] = useState(false)
	const { mutateAsync: createChatMutation } = useCreateChatMutation()

	const form = useForm<CreateChatRequest>({
		resolver: zodResolver(zCreateChatRequest),
		defaultValues: {
			title: '',
		},
	})

	const onSubmit = async (values: CreateChatRequest) => {
		if (isPending) {
			return
		}

		setIsPending(true)

		try {
			const response = await createChatMutation(values)

			if (response.success) {
				logger.info(
					{
						chatId: response.data.id,
						title: values.title,
					},
					'[CreateChatForm]: Chat created successfully',
				)

				toast.success('Chat created successfully!')

				// Reset form
				form.reset()

				// Call success callback with the new chat ID
				onSuccess?.(response.data.id)
			} else {
				throw new Error('Failed to create chat')
			}
		} catch (error: unknown) {
			const err = standardizeError(error)
			logger.error(
				{
					error: err.message,
					title: values.title,
				},
				'[CreateChatForm]: Error creating chat',
			)

			toast.error(err.message || 'Failed to create chat')
		} finally {
			setIsPending(false)
		}
	}

	return (
		<div className={cn('flex flex-col gap-4', className)} {...props}>
			<div className="flex flex-col gap-2">
				<h3 className="text-lg font-semibold">Create New Chat</h3>
				<p className="text-sm text-gray-400">
					Enter a title for your new conversation
				</p>
			</div>
			<div className="grid gap-4">
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">
						<FormField
							control={form.control}
							name="title"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="text-white">Chat Title</FormLabel>
									<FormControl>
										<Input
											placeholder="e.g., Help with React components"
											{...field}
											disabled={isPending}
											className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:border-gray-500"
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<div className="flex gap-2 justify-end">
							{onCancel && (
								<Button
									type="button"
									variant="outline"
									onClick={onCancel}
									disabled={isPending}
									className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
								>
									Cancel
								</Button>
							)}
							<Button
								type="submit"
								disabled={isPending || !form.formState.isValid}
								className="min-w-[100px] bg-blue-600 hover:bg-blue-700 text-white"
							>
								{isPending ? 'Creating...' : 'Create Chat'}
							</Button>
						</div>
					</form>
				</Form>
			</div>
		</div>
	)
}

export { CreateChatForm }
