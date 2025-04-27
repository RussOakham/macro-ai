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

const forgotPasswordSchema = z.object({
	email: z.string().email({
		message: 'Invalid email address',
	}),
})

type TForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>

const RouteComponent = () => {
	const [isPending, setIsPending] = useState(false)
	const navigate = useNavigate({ from: '/auth/forgotten-password' })

	const form = useForm<TForgotPasswordSchema>({
		resolver: zodResolver(forgotPasswordSchema),
		defaultValues: {
			email: '',
		},
	})

	const onSubmit = (values: TForgotPasswordSchema) => {
		console.log(values)
	}

	return (
		<div className="container flex flex-col items-center justify-center min-h-screen py-12">
			<Card className="mx-auto w-full max-w-md">
				<CardHeader>
					<CardTitle>Forgot Password</CardTitle>
					<CardDescription>
						Enter your email address and we'll send you a verification code to
						reset your password.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
							<FormField
								control={form.control}
								name="email"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Email</FormLabel>
										<FormControl>
											<Input placeholder="GeorgeBanks@disney.com" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<Button type="submit" className="w-full" disabled={isPending}>
								{isPending ? 'Sending...' : 'Send verification code'}
							</Button>
						</form>
					</Form>
				</CardContent>
				<CardFooter className="flex justify-center">
					<Button
						variant="link"
						onClick={() => navigate({ to: '/auth/login' })}
					>
						Back to login
					</Button>
				</CardFooter>
			</Card>
		</div>
	)
}

export const Route = createLazyFileRoute('/auth/forgotten-password/')({
	component: RouteComponent,
})
