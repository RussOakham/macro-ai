import { zodResolver } from '@hookform/resolvers/zod'
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
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
import { usePostForgotPasswordVerify } from '@/services/hooks/auth/use-post-forgot-password-verify'
import { zConfirmForgotPasswordRequest } from '@/services/network/auth/post-forgot-password-verify'
import type { ConfirmForgotPasswordRequest } from '@/services/network/auth/post-forgot-password-verify'

const RouteComponent = () => {
	const navigate = useNavigate({ from: '/auth/forgotten-password/verify' })
	const { isPending, mutateAsync: postForgotPasswordVerify } =
		usePostForgotPasswordVerify()

	const form = useForm<ConfirmForgotPasswordRequest>({
		defaultValues: {
			code: '',
			confirmPassword: '',
			email: '',
			newPassword: '',
		},
		resolver: zodResolver(zConfirmForgotPasswordRequest),
	})

	const onSubmit = async ({
		code,
		confirmPassword,
		email,
		newPassword,
	}: ConfirmForgotPasswordRequest) => {
		try {
			const response = await postForgotPasswordVerify({
				code,
				confirmPassword,
				email,
				newPassword,
			})

			logger.info(response, 'Forgot password verify success')
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
						<form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
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
												placeholder="Enter new password"
												type="password"
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
												placeholder="Confirm new password"
												type="password"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<Button className="w-full" disabled={isPending} type="submit">
								{isPending ? 'Resetting...' : 'Reset Password'}
							</Button>
						</form>
					</Form>
				</CardContent>
				<CardFooter className="flex justify-center">
					<Button
						onClick={() => navigate({ to: '/auth/forgotten-password' })}
						type="button"
						variant="link"
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
