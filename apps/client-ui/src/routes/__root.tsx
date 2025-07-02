import { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import Cookies from 'js-cookie'

import { ModeToggle } from '@/components/mode-toggle'
import { DesktopNav } from '@/components/ui/navigation/desktop-navigation/desktop-nav'
import { Toaster } from '@/components/ui/sonner'
import { QUERY_KEY } from '@/constants/query-keys'
import { getUser } from '@/services/network/user/getUser'

export interface IRouterContext {
	queryClient: QueryClient
}

const RootComponent = () => {
	return (
		<div
			className="h-screen bg-background font-sans antialiased prose-headings:font-poppins"
			suppressHydrationWarning
		>
			<div className="relative flex h-full flex-col">
				<header id="macro-ai-header" className="container flex-shrink-0">
					<DesktopNav />
				</header>

				<hr className="flex-shrink-0" />
				<main className="flex flex-1 container min-h-0">
					<div className="w-full flex-1 min-h-0">
						<div className="h-full">
							<Outlet />
							<Toaster
								position="bottom-left"
								duration={8000}
								closeButton
								richColors
							/>
						</div>
					</div>
				</main>
				<hr className="flex-shrink-0" />

				<footer id="marco-ai-footer" className="container flex-shrink-0">
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

export const Route = createRootRouteWithContext<IRouterContext>()({
	component: RootComponent,
	beforeLoad: async ({ context }) => {
		const { queryClient } = context
		const accessToken = Cookies.get('macro-ai-accessToken')
		if (accessToken) {
			await queryClient.prefetchQuery({
				queryKey: [QUERY_KEY.user],
				queryFn: () => getUser(),
			})
		}
	},
})
