import { ModeToggle } from '@/components/mode-toggle'
import {
	NavigationMenu,
	NavigationMenuList,
	navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu'
import { Toaster } from '@/components/ui/sonner'
import { NavigationMenuItem } from '@radix-ui/react-navigation-menu'
import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'

export const Route = createRootRoute({
	component: RootComponent,
})

function RootComponent() {
	return (
		<div
			className="min-h-screen bg-background font-sans antialiased prose-headings:font-poppins"
			suppressHydrationWarning
		>
			<div className="relative flex min-h-screen flex-col">
				<header id="macro-ai-header" className="container">
					<nav className="p-2 flex gap-2">
						<div className="flex justify-between w-full">
							<NavigationMenu>
								<NavigationMenuList>
									<NavigationMenuItem asChild>
										<Link
											to="/"
											className={navigationMenuTriggerStyle({
												className: '[&.active]:font-bold',
											})}
										>
											Home
										</Link>
									</NavigationMenuItem>
								</NavigationMenuList>
							</NavigationMenu>

							<NavigationMenu>
								<NavigationMenuList>
									<NavigationMenuItem asChild>
										<Link
											to="/auth/login"
											className={navigationMenuTriggerStyle({
												className: '[&.active]:font-bold',
											})}
										>
											Login
										</Link>
									</NavigationMenuItem>
									<NavigationMenuItem asChild>
										<Link
											to="/auth/register"
											className={navigationMenuTriggerStyle({
												className: '[&.active]:font-bold',
											})}
										>
											Register
										</Link>
									</NavigationMenuItem>
								</NavigationMenuList>
							</NavigationMenu>
						</div>
					</nav>
				</header>

				<hr />
				<main className="flex-1 container">
					<Outlet />
					<Toaster
						position="bottom-left"
						duration={8000}
						closeButton
						richColors
					/>
				</main>
				<hr />

				<footer id="marco-ai-footer" className="container">
					<div className="p-2 flex justify-between">
						<p className="p-2">Footer</p>
						<ModeToggle />
					</div>
				</footer>
			</div>
			<TanStackRouterDevtools />
		</div>
	)
}
