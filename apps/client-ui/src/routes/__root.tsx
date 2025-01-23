import * as React from 'react'
import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'

export const Route = createRootRoute({
	component: RootComponent,
})

function RootComponent() {
	return (
		<div className="min-h-screen bg-gray-100">
			<div className="p-2 flex gap-2">
				<Link to="/" className="[&.active]:font-bold">
					Home
				</Link>{' '}
				<Link to="/about" className="[&.active]:font-bold">
					About
				</Link>
				<Link to="/auth/login" className="[&.active]:font-bold">
					Login
				</Link>
				<Link to="/auth/register" className="[&.active]:font-bold">
					Register
				</Link>
			</div>
			<hr />
			<div className="flex min-h-fit">
				<Outlet />
			</div>
			<TanStackRouterDevtools />
		</div>
	)
}
