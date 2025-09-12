import { type QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import Cookies from 'js-cookie'

import { ModeToggle } from '@/components/mode-toggle'
import { DesktopNav } from '@/components/ui/navigation/desktop-navigation/desktop-nav'
import { Toaster } from '@/components/ui/sonner'
import { QUERY_KEY } from '@/constants/query-keys'
import { getUser } from '@/services/network/user/get-user'
interface IRouterContext {
	queryClient: QueryClient
}

const RootComponent = () => {
	return (
		<div
			className="h-screen bg-background font-sans antialiased prose-headings:font-poppins"
			suppressHydrationWarning
		>
			<div className="relative flex h-full flex-col">
				<header className="container flex-shrink-0" id="macro-ai-header">
					<DesktopNav />
				</header>

				<hr className="flex-shrink-0" />
				<main className="flex flex-1 container min-h-0">
					<div className="w-full flex-1 min-h-0">
						<div className="h-full">
							<Outlet />
							<Toaster
								closeButton
								duration={8000}
								position="bottom-left"
								richColors
							/>
						</div>
					</div>
				</main>
				<hr className="flex-shrink-0" />

				<footer className="container flex-shrink-0" id="marco-ai-footer">
					<div className="p-2 flex justify-between">
						<p className="p-2">Footer</p>
						<ModeToggle />
					</div>
				</footer>
			</div>
			<TanStackRouterDevtools position="bottom-left" />
		</div>
	)
}

const Route = createRootRouteWithContext<IRouterContext>()({
	beforeLoad: async ({ context }) => {
		const { queryClient } = context
		const accessToken = Cookies.get('macro-ai-accessToken')
		if (accessToken) {
			await queryClient.prefetchQuery({
				queryFn: () => getUser(),
				queryKey: [QUERY_KEY.user],
			})
		}
	},
	component: RootComponent,
})

export { Route }
export type { IRouterContext }
