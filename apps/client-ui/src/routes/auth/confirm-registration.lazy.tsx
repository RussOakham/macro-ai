import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createLazyFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

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
import { confirmationSchema, TConfirmationForm } from '@/lib/types'

const RouteComponent = () => {
	const [isLoading, setIsLoading] = useState(false)

	const form = useForm<TConfirmationForm>({
		resolver: zodResolver(confirmationSchema),
		defaultValues: {
			username: '',
			code: '',
		},
	})

	const onSubmit = async (values: z.infer<typeof confirmationSchema>) => {
		setIsLoading(true)
		// Here you would typically send the confirmation code to your backend
		const codeAsNumber = parseInt(values.code)
		console.log({
			username: values.username,
			code: codeAsNumber,
		})
		// Simulate API call
		await new Promise((resolve) => setTimeout(resolve, 2000))
		setIsLoading(false)
	}

	return (
		<div className="flex items-center justify-center h-full">
			<Card className="w-full max-w-md">
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
							<Button type="submit" className="w-full" disabled={isLoading}>
								{isLoading ? 'Confirming...' : 'Confirm Registration'}
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
		</div>
	)
}

export const Route = createLazyFileRoute('/auth/confirm-registration')({
	component: RouteComponent,
})
