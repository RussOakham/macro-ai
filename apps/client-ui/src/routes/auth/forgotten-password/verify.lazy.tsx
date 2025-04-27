import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router'
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
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const verifyForgotPasswordSchema = z
	.object({
		code: z.string().min(6, {
			message: 'Verification code must be at least 6 characters.',
		}),
		password: z.string().min(8, {
			message: 'Password must be at least 8 characters.',
		}),
		confirmPassword: z.string().min(8, {
			message: 'Confirm password must be at least 8 characters.',
		}),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword'],
	})

type TVerifyForgotPasswordSchema = z.infer<typeof verifyForgotPasswordSchema>

const RouteComponent = () => {
	const [isPending, setIsPending] = useState(false)
	const navigate = useNavigate({ from: '/auth/forgotten-password/verify' })

	const form = useForm<TVerifyForgotPasswordSchema>({
		resolver: zodResolver(verifyForgotPasswordSchema),
		defaultValues: {
			code: '',
			password: '',
			confirmPassword: '',
		},
	})

	const onSubmit = (values: TVerifyForgotPasswordSchema) => {
		console.log(values)
	}

	return (
		<div className="container flex flex-col items-center justify-center min-h-screen py-12">
			<Card className="mx-auto w-full max-w-md">
				<CardHeader>
					<CardTitle>Reset Your Password</CardTitle>
					<CardDescription className="pt-1">
						Enter the verification code sent to your email and create a new
						password.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
							<FormField
								control={form.control}
								name="code"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Verification Code</FormLabel>
										<FormControl>
											<Input placeholder="Enter verification code" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="password"
								render={({ field }) => (
									<FormItem>
										<FormLabel>New Password</FormLabel>
										<FormControl>
											<Input
												type="password"
												placeholder="Enter new password"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="confirmPassword"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Confirm New Password</FormLabel>
										<FormControl>
											<Input
												type="password"
												placeholder="Confirm new password"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<Button type="submit" className="w-full" disabled={isPending}>
								{isPending ? 'Resetting...' : 'Reset Password'}
							</Button>
						</form>
					</Form>
				</CardContent>
				<CardFooter className="flex justify-center">
					<Button
						type="button"
						variant="link"
						onClick={() => navigate({ to: '/auth/forgotten-password' })}
					>
						Resend code
					</Button>
				</CardFooter>
			</Card>
		</div>
	)
}

export const Route = createLazyFileRoute('/auth/forgotten-password/verify')({
	component: RouteComponent,
})
