import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'

export const Route = createRootRoute({
	component: RootComponent,
})

function RootComponent() {
	return (
		<div
			className="min-h-screen bg-background font-sans antialiased"
			suppressHydrationWarning
		>
			<div className="relative flex min-h-screen flex-col">
				<header className="container">
					<nav className="p-2 flex gap-2">
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
					</nav>
				</header>

				<hr />
				<main className="flex-1 container">
					<Outlet />
				</main>
				<footer>
					<hr />
					<div className="container">
						<p className="p-2">Footer</p>
					</div>
				</footer>
			</div>
			<TanStackRouterDevtools />
		</div>
	)
}
