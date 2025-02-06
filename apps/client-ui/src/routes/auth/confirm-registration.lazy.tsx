import { createLazyFileRoute } from '@tanstack/react-router'

import { ConfirmRegistrationForm } from '@/components/auth/confirm-registration-form'

const RouteComponent = () => {
	return (
		<div className="flex items-center justify-center h-full">
			<ConfirmRegistrationForm />
		</div>
	)
}

export const Route = createLazyFileRoute('/auth/confirm-registration')({
	component: RouteComponent,
})
