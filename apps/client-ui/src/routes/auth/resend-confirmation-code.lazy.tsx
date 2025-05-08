import { createLazyFileRoute } from '@tanstack/react-router'

import { ResendConfirmationCodeForm } from '@/components/auth/resend-confirmation-code-form'

const RouteComponent = () => {
	return (
		<div className="flex items-center justify-center h-full">
			<ResendConfirmationCodeForm />
		</div>
	)
}

export const Route = createLazyFileRoute('/auth/resend-confirmation-code')({
	component: RouteComponent,
})
