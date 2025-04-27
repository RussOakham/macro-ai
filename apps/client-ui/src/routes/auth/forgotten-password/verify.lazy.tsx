import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
	confirmForgotPasswordSchema,
	TConfirmForgotPassword,
} from '@repo/types-macro-ai-api'
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router'
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
import { standardizeError } from '@/lib/errors/standardize-error'
import { logger } from '@/lib/logger/logger'
import { usePostForgotPasswordVerify } from '@/services/auth/hooks/usePostForgotPasswordVerify'

const RouteComponent = () => {
	const navigate = useNavigate({ from: '/auth/forgotten-password/verify' })
	const { mutateAsync: postForgotPasswordVerify, isPending } =
		usePostForgotPasswordVerify()

	const form = useForm<TConfirmForgotPassword>({
		resolver: zodResolver(confirmForgotPasswordSchema),
		defaultValues: {
			code: '',
			email: '',
			newPassword: '',
			confirmPassword: '',
		},
	})

	const onSubmit = async ({
		code,
		email,
		newPassword,
		confirmPassword,
	}: TConfirmForgotPassword) => {
		try {
			const response = await postForgotPasswordVerify({
				code,
				email,
				newPassword,
				confirmPassword,
			})

			logger.info('Forgot password verify success', response)
			toast.success('Password reset successfully! Please login.')
			await navigate({ to: '/auth/login' })
		} catch (error: unknown) {
			const err = standardizeError(error)
			logger.error(`Forgot password verifyerror: ${err.message}`)
			toast.error(err.message)
		}
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
								name="email"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Email</FormLabel>
										<FormControl>
											<Input placeholder="MaryPoppins@disney.com" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="newPassword"
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
