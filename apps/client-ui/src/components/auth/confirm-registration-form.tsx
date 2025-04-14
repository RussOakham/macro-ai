import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
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
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from '@/components/ui/input-otp'
import { QUERY_KEY } from '@/constants/query-keys'
import { standardizeError } from '@/lib/errors/standardize-error'
import { logger } from '@/lib/logger/logger'
import { confirmationSchema } from '@/lib/schemas/auth.schema'
import { TConfirmationForm } from '@/lib/types'
import { TUser } from '@/lib/types/user'
import { cn } from '@/lib/utils'
import { usePostConfirmRegisterMutation } from '@/services/auth/hooks/usePostConfirmRegisterMutation'

const ConfirmRegistrationForm = ({
	className,
	...props
}: React.ComponentPropsWithoutRef<'div'>) => {
	const [isPending, setIsPending] = useState(false)
	const { mutateAsync: postConfirmRegistration } =
		usePostConfirmRegisterMutation()
	const navigate = useNavigate({ from: '/auth/confirm-registration' })
	const queryClient = useQueryClient()

	const user = queryClient.getQueryData<TUser>([QUERY_KEY.user])

	const form = useForm<TConfirmationForm>({
		resolver: zodResolver(confirmationSchema),
		defaultValues: {
			username: user?.email ?? '',
			code: '',
		},
	})

	const onSubmit = async ({ username, code }: TConfirmationForm) => {
		try {
			setIsPending(true)

			await postConfirmRegistration({ username, code })

			logger.info('Confirm registration success')
			toast.success('Account confirmed successfully! Please login.')
			await navigate({ to: '/auth/login' })
		} catch (err: unknown) {
			// Show error message
			const error = standardizeError(err)
			logger.error('Confirm registration error', error)
			toast.error(error.message)
		} finally {
			setIsPending(false)
		}
	}

	return (
		<Card className={cn('w-full max-w-md', className)} {...props}>
			<CardHeader>
				<CardTitle>Confirm Registration</CardTitle>
				<CardDescription>
					Enter the 6-digit code sent to your email.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
						<FormField
							control={form.control}
							name="username"
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
						<FormField
							control={form.control}
							name="code"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Confirmation Code</FormLabel>
									<FormControl>
										<InputOTP maxLength={6} {...field}>
											<InputOTPGroup>
												<InputOTPSlot index={0} />
												<InputOTPSlot index={1} />
												<InputOTPSlot index={2} />
												<InputOTPSlot index={3} />
												<InputOTPSlot index={4} />
												<InputOTPSlot index={5} />
											</InputOTPGroup>
										</InputOTP>
									</FormControl>
									<FormDescription>
										Please enter the 6-digit code we sent to your email.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
						<Button type="submit" className="w-full" disabled={isPending}>
							{isPending ? 'Confirming...' : 'Confirm Registration'}
						</Button>
					</form>
				</Form>
			</CardContent>
			<CardFooter className="flex justify-center">
				<p className="text-sm text-gray-600">
					Didn't receive a code?{' '}
					<button
						className="text-blue-600 hover:underline"
						onClick={() => {
							console.log('Resend code')
						}}
					>
						Resend code
					</button>
				</p>
			</CardFooter>
		</Card>
	)
}

export { ConfirmRegistrationForm }
