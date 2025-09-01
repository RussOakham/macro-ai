import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { QUERY_KEY } from '@/constants/query-keys'
import { standardizeError } from '@/lib/errors/standardize-error'
import { logger } from '@/lib/logger/logger'
import { cn } from '@/lib/utils'
import { usePostResendConfirmRegistrationCodeMutation } from '@/services/hooks/auth/usePostResendConfirmRegistrationCode'
import { GetAuthUserResponse } from '@/services/network/auth/getAuthUser'
import {
	ResendConfirmationCode,
	zResendConfirmationCode,
} from '@/services/network/auth/postResendConfirmRegistrationCode'

const ResendConfirmationCodeForm = ({
	className,
	...props
}: React.ComponentPropsWithoutRef<'div'>) => {
	const [isPending, setIsPending] = useState(false)
	const { mutateAsync: postResentConfirmRegistrationCodeMutation } =
		usePostResendConfirmRegistrationCodeMutation()
	const navigate = useNavigate({ from: '/auth/resend-confirmation-code' })
	const queryClient = useQueryClient()

	const authUser = queryClient.getQueryData<GetAuthUserResponse>([
		QUERY_KEY.authUser,
	])

	const form = useForm<ResendConfirmationCode>({
		resolver: zodResolver(zResendConfirmationCode),
		defaultValues: {
			email: authUser?.email ?? '',
		},
	})

	const onSubmit = async ({ email }: ResendConfirmationCode) => {
		try {
			setIsPending(true)

			await postResentConfirmRegistrationCodeMutation({ email })

			logger.info('Resend confirmation code success')
			toast.success(
				'Confirmation code resent successfully! Please check your email.',
			)
			await navigate({ to: '/auth/confirm-registration' })
		} catch (err: unknown) {
			// Show error message
			const error = standardizeError(err)
			logger.error(error, 'Error resending confirmation code')
			toast.error(error.message)
		} finally {
			setIsPending(false)
		}
	}

	return (
		<Card className={cn('w-full max-w-md', className)} {...props}>
			<CardHeader>
				<CardTitle>Resend Confirmation Code</CardTitle>
				<CardDescription>
					Enter your email address to resend the confirmation code.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
						<FormField
							control={form.control}
							name="email"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Email</FormLabel>
									<FormControl>
										<Input {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<Button type="submit" className="w-full" disabled={isPending}>
							{isPending ? 'Confirming...' : 'Resend Code'}
						</Button>
					</form>
				</Form>
			</CardContent>
			<CardFooter className="flex justify-center">
				<p className="text-sm text-gray-600">
					Go back to{' '}
					<Link
						className="text-blue-600 hover:underline"
						to="/auth/confirm-registration"
					>
						Confirm Registration
					</Link>
				</p>
			</CardFooter>
		</Card>
	)
}

export { ResendConfirmationCodeForm }
