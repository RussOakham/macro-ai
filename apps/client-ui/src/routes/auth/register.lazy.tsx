import { Link, createLazyFileRoute } from '@tanstack/react-router'
import { GalleryVerticalEnd } from 'lucide-react'
import { useLayoutEffect, useState } from 'react'

import { RegisterForm } from '@/components/auth/register-form'

const RouteComponent = () => {
	const [headerHeight, setHeaderHeight] = useState(52)
	const [footerHeight, setFooterHeight] = useState(56)
	const minHeight = `calc(100svh - ${headerHeight.toString()}px - ${footerHeight.toString()}px)`

	useLayoutEffect(() => {
		const header = document.getElementById('macro-ai-header')
		const footer = document.getElementById('macro-ai-footer')

		if (header) {
			setHeaderHeight(header.clientHeight)
		}

		if (footer) {
			setFooterHeight(footer.clientHeight)
		}
	}, [])

	return (
		<div className="grid lg:grid-cols-2" style={{ minHeight }}>
			<div className="flex flex-col gap-4 p-6 md:p-10">
				<div className="flex justify-center gap-2 md:justify-start">
					<Link to="/" className="flex items-center gap-2 font-medium">
						<div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
							<GalleryVerticalEnd className="size-4" />
						</div>
						Acme Inc.
					</Link>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-xs">
						<RegisterForm />
					</div>
				</div>
			</div>
			<div className="relative hidden bg-muted lg:block">
				<img
					src="/vite.svg"
					alt=""
					aria-hidden="true"
					className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
				/>
			</div>
		</div>
	)
}

export const Route = createLazyFileRoute('/auth/register')({
	component: RouteComponent,
})
